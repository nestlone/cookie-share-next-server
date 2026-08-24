import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export class SessionStore {
  private readonly db: DatabaseSync;
  private readonly ttlHours: number;

  public constructor(db: DatabaseSync, ttlHours: number) {
    this.db = db;
    this.ttlHours = ttlHours;
  }

  /** Create a session and return the raw token (the only time it's ever visible). */
  public create(userId: number): string {
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = this.hashToken(token);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + this.ttlHours * 3600_000).toISOString();
    this.db.prepare(
      "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    ).run(tokenHash, userId, now, expiresAt);

    return token;
  }

  /** Verify a token and return the userId, or undefined if invalid/expired. */
  public verify(token: string): number | undefined {
    const tokenHash = this.hashToken(token);
    const row = this.db.prepare(
      "SELECT user_id, expires_at FROM sessions WHERE token_hash = ?",
    ).get(tokenHash) as { user_id: number; expires_at: string } | undefined;

    if (!row) {
      return undefined;
    }

    if (new Date(row.expires_at) < new Date()) {
      this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
      return undefined;
    }

    return row.user_id;
  }

  /** Delete a specific session (logout). */
  public delete(token: string): void {
    this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(this.hashToken(token));
  }

  /** Delete all sessions for a user (force-logout). */
  public deleteAllForUser(userId: number): void {
    this.db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  }

  /** Prune expired sessions (called at startup). */
  public pruneExpired(): void {
    this.db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(new Date().toISOString());
  }

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }
}