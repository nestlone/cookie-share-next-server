import type { DatabaseSync } from "node:sqlite";
import type { PublicUser, UserRow } from "../types";

function mapUserRow(row: UserRow): PublicUser {
  return {
    id: row.id,
    displayName: row.display_name,
    quotaBytes: row.quota_bytes,
    dailyRequestLimit: row.daily_request_limit,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class UserStore {
  public constructor(private readonly db: DatabaseSync) {}

  public create(params: { displayName: string; quotaBytes: number; dailyRequestLimit: number }): PublicUser {
    const now = new Date().toISOString();
    const result = this.db.prepare(
      `INSERT INTO users (display_name, quota_bytes, daily_request_limit, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(params.displayName, params.quotaBytes, params.dailyRequestLimit, now, now);
    return mapUserRow(this.findById(Number(result.lastInsertRowid)) as UserRow);
  }

  public findById(id: number): UserRow | undefined {
    return this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as unknown as UserRow | undefined;
  }

  public listAll(): PublicUser[] {
    return (this.db.prepare("SELECT * FROM users ORDER BY id ASC").all() as unknown as UserRow[]).map(mapUserRow);
  }

  public updateQuota(id: number, patch: { quotaBytes?: number; dailyRequestLimit?: number }): PublicUser | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    const now = new Date().toISOString();
    this.db.prepare("UPDATE users SET quota_bytes = ?, daily_request_limit = ?, updated_at = ? WHERE id = ?").run(
      patch.quotaBytes ?? existing.quota_bytes,
      patch.dailyRequestLimit ?? existing.daily_request_limit,
      now,
      id,
    );
    return mapUserRow(this.findById(id) as UserRow);
  }
}
