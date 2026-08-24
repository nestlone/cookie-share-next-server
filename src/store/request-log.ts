import type { DatabaseSync } from "node:sqlite";

export class RequestLogStore {
  private readonly db: DatabaseSync;

  public constructor(db: DatabaseSync) {
    this.db = db;
  }

  public record(userId: number, endpoint: string, bucketId: string | null): void {
    this.db.prepare(
      "INSERT INTO request_log (user_id, bucket_id, endpoint, created_at) VALUES (?, ?, ?, ?)",
    ).run(userId, bucketId, endpoint, new Date().toISOString());
  }

  /** Count requests for a user since the given ISO start-of-day. */
  public countSince(userId: number, sinceIso: string): number {
    const row = this.db.prepare(
      "SELECT COUNT(*) AS total FROM request_log WHERE user_id = ? AND created_at >= ?",
    ).get(userId, sinceIso) as { total: number };
    return Number(row.total);
  }

  /** Delete rows older than the retention cutoff. */
  public pruneOlderThan(cutoffIso: string): void {
    this.db.prepare("DELETE FROM request_log WHERE created_at < ?").run(cutoffIso);
  }
}
