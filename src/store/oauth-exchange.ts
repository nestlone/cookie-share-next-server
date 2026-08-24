import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

function hash(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export class OAuthExchangeStore {
  public constructor(private readonly db: DatabaseSync) {}

  public create(userId: number): string {
    const code = crypto.randomBytes(32).toString("base64url");
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 2 * 60_000).toISOString();
    this.db.prepare("INSERT INTO oauth_exchange_codes (code_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(hash(code), userId, now, expiresAt);
    return code;
  }

  public consume(code: string): number | undefined {
    const row = this.db.prepare("DELETE FROM oauth_exchange_codes WHERE code_hash = ? AND expires_at > ? RETURNING user_id").get(hash(code), new Date().toISOString()) as { user_id: number } | undefined;
    return row?.user_id;
  }
}
