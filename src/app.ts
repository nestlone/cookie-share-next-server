import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";
import express from "express";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { getMe, logout } from "./routes/auth";
import { listUsers, requireAdmin, updateUserQuota } from "./routes/admin";
import { createBucket, deleteBucket, getBucket, listBuckets, updateBucket } from "./routes/buckets";
import { exchangeOAuth, listProviders, oauthCallback, startOAuth, unlinkOAuth } from "./routes/oauth";
import { HttpError } from "./errors";
import { applyCorsHeaders, applyCorsOrigin, applySecurityHeaders, sendCorsPreflight, sendJson } from "./http";
import { dailyRateLimit, loginRateLimit, requireAuth } from "./middleware";
import { createProvider, type OAuthProvider } from "./oauth/providers";
import { ensureSchema } from "./schema";
import { BucketStore } from "./store/buckets";
import { OAuthExchangeStore } from "./store/oauth-exchange";
import { OAuthStateStore } from "./store/oauth-states";
import { ProviderAccountStore } from "./store/provider-accounts";
import { RequestLogStore } from "./store/request-log";
import { SessionStore } from "./store/sessions";
import { UserStore } from "./store/users";
import type { ErrorPayload, OAuthProviderId, RuntimeConfig } from "./types";

function handleRoute(handler: (request: Request, response: Response, next: NextFunction) => Promise<void> | void): RequestHandler {
  return (request, response, next) => { Promise.resolve(handler(request, response, next)).catch(next); };
}

function buildError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (error && typeof error === "object") {
    const candidate = error as { status?: unknown; message?: unknown; type?: unknown };
    if (candidate.status === 400 && candidate.type === "entity.parse.failed") return new HttpError(400, "Invalid JSON payload", { success: false, message: "Invalid JSON payload" });
    if (typeof candidate.status === "number" && typeof candidate.message === "string") return new HttpError(candidate.status, candidate.message, { success: false, message: candidate.message });
  }
  console.error("Unhandled server error", error);
  return new HttpError(500, "Internal Server Error", { success: false, message: "Internal Server Error" });
}

export function createApp(config: RuntimeConfig, db: DatabaseSync, configuredProviders?: OAuthProvider[]): express.Express {
  ensureSchema(db);
  const users = new UserStore(db);
  const sessions = new SessionStore(db, config.sessionTtlHours);
  const buckets = new BucketStore(db);
  const accounts = new ProviderAccountStore(db);
  const states = new OAuthStateStore(db);
  const exchanges = new OAuthExchangeStore(db);
  const requestLog = new RequestLogStore(db);
  const providers = new Map<OAuthProviderId, OAuthProvider>((configuredProviders ?? config.oauthProviders.map(createProvider)).map((provider) => [provider.id, provider]));
  sessions.pruneExpired();
  requestLog.pruneOlderThan(new Date(Date.now() - config.requestLogRetentionDays * 86_400_000).toISOString());
  const authRequired = requireAuth(sessions);
  const authRateLimit = loginRateLimit(config);
  const userRateLimit = dailyRateLimit(requestLog, users);
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.use((request, response, next) => {
    applySecurityHeaders(response);
    applyCorsHeaders(response);
    applyCorsOrigin(response, request.header("Origin"), config.allowedExtensionIds);
    next();
  });
  app.use(express.json({ limit: "10mb" }));
  app.use((request, response, next) => { if (request.method === "OPTIONS") { sendCorsPreflight(response); return; } next(); });
  app.get("/api/v1/health", (_request, response) => sendJson(response, 200, { status: "ok", version: 1 }));
  app.get("/api/v1/auth/providers", (request, response) => listProviders(request, response, providers));
  app.post("/api/v1/auth/oauth/:provider/start", authRateLimit, (request, response) => startOAuth(request, response, config, sessions, states, providers));
  app.get("/api/v1/auth/oauth/:provider/callback", authRateLimit, handleRoute((request, response) => oauthCallback(request, response, config, users, accounts, states, exchanges, providers)));
  app.post("/api/v1/auth/oauth/exchange", authRateLimit, (request, response) => exchangeOAuth(request, response, users, accounts, exchanges, sessions));
  app.delete("/api/v1/auth/oauth/:provider", authRequired, (request, response) => unlinkOAuth(request, response, accounts));
  app.post("/api/v1/auth/logout", authRequired, (request, response) => logout(request, response, sessions));
  app.get("/api/v1/me", authRequired, userRateLimit, (request, response) => getMe(request, response, users, accounts, buckets, requestLog));
  app.post("/api/v1/buckets", authRequired, userRateLimit, (request, response) => createBucket(request, response, users, buckets));
  app.get("/api/v1/buckets", authRequired, userRateLimit, (request, response) => listBuckets(request, response, buckets));
  app.get("/api/v1/buckets/:id", authRequired, userRateLimit, (request, response) => getBucket(request, response, buckets));
  app.put("/api/v1/buckets/:id", authRequired, userRateLimit, (request, response) => updateBucket(request, response, users, buckets));
  app.delete("/api/v1/buckets/:id", authRequired, userRateLimit, (request, response) => deleteBucket(request, response, buckets));
  app.get("/api/v1/admin/users", requireAdmin(config), (request, response) => listUsers(request, response, users, buckets));
  app.patch("/api/v1/admin/users/:id", requireAdmin(config), (request, response) => updateUserQuota(request, response, users));
  app.use(express.static(path.join(config.serverRoot, "site"), { index: "index.html" }));
  app.use((_request, _response, next) => next(new HttpError(404, "Not Found", { success: false, message: "Not Found" })));
  const errorHandler: ErrorRequestHandler = (error, _request, response, next) => { if (response.headersSent) { next(error); return; } const httpError = buildError(error); sendJson(response, httpError.status, httpError.payload as ErrorPayload); };
  app.use(errorHandler);
  return app;
}
