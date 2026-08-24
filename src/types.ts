export type OAuthProviderId = "github" | "google" | "linuxdo";

export interface OAuthProviderConfig {
  id: OAuthProviderId;
  name: string;
  clientId: string;
  clientSecret: string;
}

export interface RuntimeConfig {
  host: string;
  port: number;
  serverRoot: string;
  dbPath: string;
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

export interface PublicUser {
  id: number;
  displayName: string;
  quotaBytes: number;
  dailyRequestLimit: number;
  created_at: string;
  updated_at: string;
}

export interface UserRow {
  id: number;
  display_name: string;
  quota_bytes: number;
  daily_request_limit: number;
  created_at: string;
  updated_at: string;
}

export interface ProviderAccount {
  provider: OAuthProviderId;
  subject: string;
  login: string;
  createdAt: string;
}

export interface ProviderAccountRow {
  id: number;
  user_id: number;
  provider: OAuthProviderId;
  subject: string;
  login: string;
  created_at: string;
}

export interface SessionRow {
  token_hash: string;
  user_id: number;
  created_at: string;
  expires_at: string;
}

export interface BucketRow {
  id: string;
  user_id: number;
  envelope_json: string;
  payload_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface BucketSummary {
  id: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}

export interface BucketDetail extends BucketSummary {
  envelope: unknown;
}

export interface EncryptedEnvelope {
  version: number;
  salt: string;
  iv: string;
  payload: string;
}

export interface UsageInfo {
  usedBytes: number;
  todayRequests: number;
  todayRequestsLimit: number;
}

export interface ErrorPayload {
  success: false;
  message?: string;
  error?: string;
  [key: string]: unknown;
}

export interface AuthUserPayload {
  id: number;
  displayName: string;
  quotaBytes: number;
  dailyRequestLimit: number;
  providers: Array<{ id: OAuthProviderId; login: string }>;
}

declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}
