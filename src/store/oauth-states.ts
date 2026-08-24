import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { OAuthProviderId } from "../types";

export interface OAuthState {
  state: string;
  provider: OAuthProviderId;
  mode: "login" | "link";
  userId?: number | undefined;
  redirectUri: string;
  codeVerifier: string;
}

export class OAuthStateStore {
  public constructor(private readonly db: DatabaseSync) {}

  public create(params: Omit<OAuthState, "state">): OAuthState {
    const state = crypto.randomBytes(32).toString("base64url");
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    this.db.prepare("INSERT INTO oauth_states (state, provider, mode, user_id, redirect_uri, code_verifier, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(state, params.provider, params.mode, params.userId ?? null, params.redirectUri, params.codeVerifier, now, expiresAt);
    return { ...params, state };
  }

  public consume(state: string): OAuthState | undefined {
    const row = this.db.prepare("DELETE FROM oauth_states WHERE state = ? AND expires_at > ? RETURNING *").get(state, new Date().toISOString()) as { state: string; provider: OAuthProviderId; mode: "login" | "link"; user_id: number | null; redirect_uri: string; code_verifier: string } | undefined;
    if (!row) return undefined;
    return { state: row.state, provider: row.provider, mode: row.mode, userId: row.user_id ?? undefined, redirectUri: row.redirect_uri, codeVerifier: row.code_verifier };
  }
}
