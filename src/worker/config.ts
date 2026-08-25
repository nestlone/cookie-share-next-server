import type { OAuthProviderConfig, OAuthProviderId } from "../types";

export interface WorkerEnv {
  DB: D1Database;
  PUBLIC_BASE_URL: string;
  ADMIN_TOKEN: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  LINUXDO_CLIENT_ID?: string;
  LINUXDO_CLIENT_SECRET?: string;
  DEFAULT_QUOTA_BYTES?: string;
  DEFAULT_DAILY_REQUEST_LIMIT?: string;
  SESSION_TTL_HOURS?: string;
  LOGIN_RATE_LIMIT?: string;
  LOGIN_RATE_WINDOW_MIN?: string;
  REQUEST_LOG_RETENTION_DAYS?: string;
}

export interface WorkerConfig {
  publicBaseUrl: string;
  adminToken: string;
  defaultQuotaBytes: number;
  defaultDailyRequestLimit: number;
  sessionTtlHours: number;
  loginRateLimit: number;
  loginRateWindowMin: number;
  requestLogRetentionDays: number;
  oauthProviders: OAuthProviderConfig[];
}

function required(env: WorkerEnv, name: keyof WorkerEnv): string {
  const value = env[name];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Missing required Worker binding: ${name}`);
  return value.trim();
}

function integer(env: WorkerEnv, name: keyof WorkerEnv, fallback: number): number {
  const value = env[name];
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Invalid Worker binding: ${name}`);
  return parsed;
}

export function loadWorkerConfig(env: WorkerEnv): WorkerConfig {
  const providers: Array<[OAuthProviderId, "GITHUB" | "GOOGLE" | "LINUXDO"]> = [["github", "GITHUB"], ["google", "GOOGLE"], ["linuxdo", "LINUXDO"]];
  const oauthProviders = providers.flatMap(([id, prefix]) => {
    const clientId = env[`${prefix}_CLIENT_ID`];
    const clientSecret = env[`${prefix}_CLIENT_SECRET`];
    if (!clientId && !clientSecret) return [];
    if (!clientId || !clientSecret) throw new Error(`Incomplete ${prefix} OAuth configuration`);
    return [{ id, name: id === "github" ? "GitHub" : id === "google" ? "Google" : "LinuxDo", clientId, clientSecret }];
  });
  if (oauthProviders.length === 0) throw new Error("Configure at least one OAuth provider");

  return {
    publicBaseUrl: required(env, "PUBLIC_BASE_URL").replace(/\/$/, ""),
    adminToken: required(env, "ADMIN_TOKEN"),
    defaultQuotaBytes: integer(env, "DEFAULT_QUOTA_BYTES", 104857600),
    defaultDailyRequestLimit: integer(env, "DEFAULT_DAILY_REQUEST_LIMIT", 1000),
    sessionTtlHours: integer(env, "SESSION_TTL_HOURS", 720),
    loginRateLimit: integer(env, "LOGIN_RATE_LIMIT", 10),
    loginRateWindowMin: integer(env, "LOGIN_RATE_WINDOW_MIN", 15),
    requestLogRetentionDays: integer(env, "REQUEST_LOG_RETENTION_DAYS", 7),
    oauthProviders,
  };
}
