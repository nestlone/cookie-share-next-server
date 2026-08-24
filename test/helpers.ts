import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "../src/app";
import { openDatabase } from "../src/db";
import type { OAuthIdentity, OAuthProvider } from "../src/oauth/providers";
import type { OAuthProviderId, RuntimeConfig } from "../src/types";

export interface TestServer { baseUrl: string; close(): Promise<void>; }

export class FakeProvider implements OAuthProvider {
  public readonly id: OAuthProviderId;
  public readonly name: string;
  public identity: OAuthIdentity;

  public constructor(id: OAuthProviderId, identity: OAuthIdentity) {
    this.id = id;
    this.name = id === "github" ? "GitHub" : id === "google" ? "Google" : "LinuxDo";
    this.identity = identity;
  }

  public authorizeUrl(params: { redirectUri: string; state: string; codeChallenge: string }): string {
    return `${params.redirectUri}?state=${encodeURIComponent(params.state)}&code=fake-code`;
  }

  public async exchangeCode(params: { code: string }): Promise<OAuthIdentity> {
    const login = params.code.startsWith("fake-user-") ? params.code.slice(10) : undefined;
    return login ? { subject: `${this.id}-${login}`, login } : this.identity;
  }
}

export async function createTestServer(overrides: Partial<RuntimeConfig> = {}, providers: OAuthProvider[] = [new FakeProvider("github", { subject: "github-alice", login: "alice" }), new FakeProvider("google", { subject: "google-alice", login: "alice@example.com" })]): Promise<TestServer> {
  const config: RuntimeConfig = {
    host: "127.0.0.1", port: 0, serverRoot: process.cwd(), dbPath: ":memory:", publicBaseUrl: "http://127.0.0.1:3000", adminToken: "test-admin-token", defaultQuotaBytes: 1024 * 1024, defaultDailyRequestLimit: 100, sessionTtlHours: 24, loginRateLimit: 100, loginRateWindowMin: 1, requestLogRetentionDays: 7, oauthProviders: [], ...overrides,
  };
  const db = openDatabase(":memory:");
  const app = createApp(config, db, providers);
  const server = app.listen(0, config.host);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  return { baseUrl: `http://${config.host}:${address.port}/api/v1`, close: async () => { await new Promise<void>((resolve, reject) => (server as Server).close((error) => error ? reject(error) : resolve())); db.close(); } };
}

export async function requestJson(baseUrl: string, path: string, options: RequestInit = {}): Promise<{ response: Response; body: Record<string, unknown> | null }> {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) as Record<string, unknown> : null };
}

export async function followAuthorization(baseUrl: string, authorizeUrl: string, providerCode = "fake-code"): Promise<Response> {
  const callbackUrl = new URL(authorizeUrl);
  callbackUrl.searchParams.set("code", providerCode);
  return await fetch(`${baseUrl}${callbackUrl.pathname.replace("/api/v1", "")}${callbackUrl.search}`, { redirect: "manual" });
}

export async function signIn(baseUrl: string, provider = "github", login?: string, redirectUri = "http://127.0.0.1/oauth-result"): Promise<string> {
  const started = await requestJson(baseUrl, `/auth/oauth/${provider}/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "login", redirectUri }) });
  if (started.response.status !== 200 || typeof started.body?.authorizeUrl !== "string") throw new Error("OAuth start failed");
  const authorization = new URL(started.body.authorizeUrl);
  const callback = await followAuthorization(baseUrl, started.body.authorizeUrl, login ? `fake-user-${login}` : undefined);
  const destination = callback.headers.get("location");
  const code = destination ? new URL(destination).searchParams.get("code") : null;
  if (callback.status !== 302 || !code) throw new Error(`OAuth callback failed: ${callback.status} ${await callback.text()}`);
  const exchanged = await requestJson(baseUrl, "/auth/oauth/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
  if (exchanged.response.status !== 200 || typeof exchanged.body?.token !== "string") throw new Error("OAuth exchange failed");
  return exchanged.body.token;
}

export async function register(baseUrl: string, username = "alice"): Promise<string> { return await signIn(baseUrl, "github", username); }
export function authHeaders(token: string): Record<string, string> { return { Authorization: `Bearer ${token}` }; }
