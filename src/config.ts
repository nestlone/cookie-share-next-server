import path from "node:path";
import dotenv from "dotenv";
import { HttpError } from "./errors";
import type { OAuthProviderConfig, OAuthProviderId, RuntimeConfig } from "./types";

const SERVER_ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(SERVER_ROOT, ".env") });

function requireString(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new HttpError(500, `Missing required environment variable: ${name}`, { success: false, error: `Missing required environment variable: ${name}` }, { plain: true });
  return value;
}

function optionalString(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function optionalInt(name: string, fallback: number): number {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new HttpError(500, `Invalid ${name}`, { success: false, error: `Invalid ${name}` }, { plain: true });
  return parsed;
}

function resolvePort(): number {
  const port = Number(process.env.PORT?.trim() ?? "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new HttpError(500, "Invalid PORT", { success: false, error: "Invalid PORT" }, { plain: true });
  return port;
}

function resolveDbPath(rawPath: string): string {
  return rawPath === ":memory:" || path.isAbsolute(rawPath) ? rawPath : path.resolve(SERVER_ROOT, rawPath);
}

function loadProviders(): OAuthProviderConfig[] {
  const providers: Array<[OAuthProviderId, string]> = [["github", "GITHUB"], ["google", "GOOGLE"], ["linuxdo", "LINUXDO"]];
  return providers.flatMap(([id, prefix]) => {
    const clientId = process.env[`${prefix}_CLIENT_ID`]?.trim();
    const clientSecret = process.env[`${prefix}_CLIENT_SECRET`]?.trim();
    if (!clientId && !clientSecret) return [];
    if (!clientId || !clientSecret) throw new HttpError(500, `Both ${prefix}_CLIENT_ID and ${prefix}_CLIENT_SECRET are required`, { success: false, error: `Incomplete ${prefix} OAuth configuration` }, { plain: true });
    return [{ id, name: id === "github" ? "GitHub" : id === "google" ? "Google" : "LinuxDo", clientId, clientSecret }];
  });
}

export function loadRuntimeConfig(): RuntimeConfig {
  const publicBaseUrl = requireString("PUBLIC_BASE_URL").replace(/\/$/, "");
  const oauthProviders = loadProviders();
  if (oauthProviders.length === 0) throw new HttpError(500, "Configure at least one OAuth provider", { success: false, error: "Configure at least one OAuth provider" }, { plain: true });
  return {
    host: optionalString("HOST", "0.0.0.0"),
    port: resolvePort(),
    serverRoot: SERVER_ROOT,
    dbPath: resolveDbPath(optionalString("DB_PATH", "./data/cookie-share-next.db")),
    publicBaseUrl,
    adminToken: requireString("ADMIN_TOKEN"),
    defaultQuotaBytes: optionalInt("DEFAULT_QUOTA_BYTES", 104857600),
    defaultDailyRequestLimit: optionalInt("DEFAULT_DAILY_REQUEST_LIMIT", 1000),
    sessionTtlHours: optionalInt("SESSION_TTL_HOURS", 720),
    loginRateLimit: optionalInt("LOGIN_RATE_LIMIT", 10),
    loginRateWindowMin: optionalInt("LOGIN_RATE_WINDOW_MIN", 15),
    requestLogRetentionDays: optionalInt("REQUEST_LOG_RETENTION_DAYS", 7),
    oauthProviders,
  };
}
