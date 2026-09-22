import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

const BACKUP_KEY_BYTES = 32;

export class BackupKeyStore {
  public constructor(private readonly db: DatabaseSync) {}

  /** Replaces the current key and returns its plaintext exactly once. */
  public reset(userId: number): string {
    const key = crypto.randomBytes(BACKUP_KEY_BYTES).toString("base64url");
    const now = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO backup_keys (user_id, key_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET key_hash = excluded.key_hash, updated_at = excluded.updated_at`,
    ).run(userId, this.hash(key), now, now);
    return key;
  }

  public findUserId(key: string): number | undefined {
    if (!/^[A-Za-z0-9_-]{43}$/.test(key)) return undefined;
    const row = this.db.prepare("SELECT user_id FROM backup_keys WHERE key_hash = ?").get(this.hash(key)) as { user_id: number } | undefined;
    return row?.user_id;
  }

  private hash(key: string): string {
    return crypto.createHash("sha256").update(key).digest("hex");
  }
}
