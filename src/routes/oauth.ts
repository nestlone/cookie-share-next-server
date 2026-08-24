import type { Request, Response } from "express";
import { toAuthUser } from "./auth";
import { HttpError } from "../errors";
import { sendJson } from "../http";
import { createPkce } from "../oauth/pkce";
import type { OAuthProvider, OAuthIdentity } from "../oauth/providers";
import type { OAuthProviderId, RuntimeConfig } from "../types";
import type { OAuthExchangeStore } from "../store/oauth-exchange";
import type { OAuthStateStore } from "../store/oauth-states";
import type { ProviderAccountStore } from "../store/provider-accounts";
import type { SessionStore } from "../store/sessions";
import type { UserStore } from "../store/users";

function providerId(value: string): OAuthProviderId {
  if (value !== "github" && value !== "google" && value !== "linuxdo") throw new HttpError(404, "OAuth provider not found", { success: false, message: "OAuth provider not found" });
  return value;
}

function routeProvider(request: Request): OAuthProviderId {
  const value = request.params.provider;
  if (typeof value !== "string") throw new HttpError(404, "OAuth provider not found", { success: false, message: "OAuth provider not found" });
  return providerId(value);
}

function requirePayload(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Invalid payload", { success: false, message: "Invalid payload" });
  return body as Record<string, unknown>;
}

function validateRedirectUri(value: unknown): string {
  if (typeof value !== "string") throw new HttpError(400, "Invalid redirectUri", { success: false, message: "Invalid redirectUri" });
  let url: URL;
  try { url = new URL(value); } catch { throw new HttpError(400, "Invalid redirectUri", { success: false, message: "Invalid redirectUri" }); }
  const chromiumRedirect = url.protocol === "https:" && url.hostname.endsWith(".chromiumapp.org");
  const localTestRedirect = url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  if (!chromiumRedirect && !localTestRedirect) throw new HttpError(400, "Unsupported redirectUri", { success: false, message: "Unsupported redirectUri" });
  return url.toString();
}

function redirect(response: Response, redirectUri: string, params: Record<string, string>): void {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  response.redirect(302, url.toString());
}

function getProvider(providers: Map<OAuthProviderId, OAuthProvider>, id: OAuthProviderId): OAuthProvider {
  const provider = providers.get(id);
  if (!provider) throw new HttpError(404, "OAuth provider is not configured", { success: false, message: "OAuth provider is not configured" });
  return provider;
}

function accountForIdentity(users: UserStore, accounts: ProviderAccountStore, config: RuntimeConfig, provider: OAuthProviderId, identity: OAuthIdentity): number {
  const existing = accounts.find(provider, identity.subject);
  if (existing) return existing.user_id;
  const user = users.create({ displayName: identity.login, quotaBytes: config.defaultQuotaBytes, dailyRequestLimit: config.defaultDailyRequestLimit });
  accounts.create(user.id, provider, identity.subject, identity.login);
  return user.id;
}

export function listProviders(_request: Request, response: Response, providers: Map<OAuthProviderId, OAuthProvider>): void {
  sendJson(response, 200, { providers: [...providers.values()].map(({ id, name }) => ({ id, name })) });
}

export function startOAuth(request: Request, response: Response, config: RuntimeConfig, sessions: SessionStore, states: OAuthStateStore, providers: Map<OAuthProviderId, OAuthProvider>): void {
  const provider = getProvider(providers, providerId(routeProvider(request)));
  const body = requirePayload(request.body);
  const mode = body.mode === "link" ? "link" : body.mode === "login" ? "login" : undefined;
  if (!mode) throw new HttpError(400, "Invalid OAuth mode", { success: false, message: "Invalid OAuth mode" });
  let userId: number | undefined;
  if (mode === "link") {
    const token = request.header("Authorization")?.match(/^Bearer (.+)$/)?.[1];
    userId = token ? sessions.verify(token) : undefined;
    if (userId === undefined) throw new HttpError(401, "Unauthorized", { success: false, message: "Unauthorized" });
  }
  const { verifier, challenge } = createPkce();
  const state = states.create({ provider: provider.id, mode, userId, redirectUri: validateRedirectUri(body.redirectUri), codeVerifier: verifier });
  const callback = `${config.publicBaseUrl}/api/v1/auth/oauth/${provider.id}/callback`;
  sendJson(response, 200, { authorizeUrl: provider.authorizeUrl({ redirectUri: callback, state: state.state, codeChallenge: challenge }) });
}

export async function oauthCallback(request: Request, response: Response, config: RuntimeConfig, users: UserStore, accounts: ProviderAccountStore, states: OAuthStateStore, exchanges: OAuthExchangeStore, providers: Map<OAuthProviderId, OAuthProvider>): Promise<void> {
  const providerIdValue = providerId(routeProvider(request));
  const stateValue = typeof request.query.state === "string" ? request.query.state : "";
  const state = states.consume(stateValue);
  if (!state || state.provider !== providerIdValue) throw new HttpError(400, "Invalid or expired OAuth state", { success: false, message: "Invalid or expired OAuth state" });
  const error = typeof request.query.error === "string" ? request.query.error : undefined;
  if (error) { redirect(response, state.redirectUri, { error: "provider_denied" }); return; }
  const code = typeof request.query.code === "string" ? request.query.code : undefined;
  if (!code) { redirect(response, state.redirectUri, { error: "missing_code" }); return; }
  let identity: OAuthIdentity;
  try {
    identity = await getProvider(providers, providerIdValue).exchangeCode({ code, redirectUri: `${config.publicBaseUrl}/api/v1/auth/oauth/${providerIdValue}/callback`, codeVerifier: state.codeVerifier });
  } catch {
    redirect(response, state.redirectUri, { error: "provider_exchange_failed" });
    return;
  }
  if (state.mode === "link") {
    const existing = accounts.find(providerIdValue, identity.subject);
    if (existing && existing.user_id !== state.userId) { redirect(response, state.redirectUri, { error: "provider_already_linked" }); return; }
    if (!existing) accounts.create(state.userId as number, providerIdValue, identity.subject, identity.login);
    redirect(response, state.redirectUri, { linked: "1" });
    return;
  }
  redirect(response, state.redirectUri, { code: exchanges.create(accountForIdentity(users, accounts, config, providerIdValue, identity)) });
}

export function exchangeOAuth(request: Request, response: Response, users: UserStore, accounts: ProviderAccountStore, exchanges: OAuthExchangeStore, sessions: SessionStore): void {
  const code = requirePayload(request.body).code;
  if (typeof code !== "string" || !code) throw new HttpError(400, "Invalid exchange code", { success: false, message: "Invalid exchange code" });
  const userId = exchanges.consume(code);
  if (userId === undefined) throw new HttpError(401, "Invalid or expired exchange code", { success: false, message: "Invalid or expired exchange code" });
  const user = users.findById(userId);
  if (!user) throw new HttpError(401, "User not found", { success: false, message: "User not found" });
  sendJson(response, 200, { token: sessions.create(user.id), user: toAuthUser({ id: user.id, displayName: user.display_name, quotaBytes: user.quota_bytes, dailyRequestLimit: user.daily_request_limit, created_at: user.created_at, updated_at: user.updated_at }, accounts) });
}

export function unlinkOAuth(request: Request, response: Response, accounts: ProviderAccountStore): void {
  if (request.userId === undefined) throw new HttpError(401, "Unauthorized", { success: false, message: "Unauthorized" });
  const provider = providerId(routeProvider(request));
  if (accounts.listForUser(request.userId).length < 2) throw new HttpError(409, "Cannot unlink the last sign-in provider", { success: false, message: "Cannot unlink the last sign-in provider" });
  if (!accounts.delete(request.userId, provider)) throw new HttpError(404, "Provider is not linked", { success: false, message: "Provider is not linked" });
  sendJson(response, 200, { providers: accounts.listForUser(request.userId).map(({ provider: id, login }) => ({ id, login })) });
}
