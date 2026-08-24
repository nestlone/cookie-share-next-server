import type { DatabaseSync } from "node:sqlite";
import { HttpError } from "../errors";
import type { BucketDetail, BucketRow, BucketSummary, EncryptedEnvelope } from "../types";

function mapBucketRow(row: BucketRow): BucketSummary {
  return {
    id: row.id,
    size: row.payload_bytes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class BucketStore {
  private readonly db: DatabaseSync;

  public constructor(db: DatabaseSync) {
    this.db = db;
  }

  public exists(userId: number, id: string): boolean {
    const row = this.db.prepare(
      "SELECT 1 FROM buckets WHERE user_id = ? AND id = ?",
    ).get(userId, id);
    return row !== undefined;
  }

  public create(params: {
    userId: number;
    id: string;
    envelope: EncryptedEnvelope;
    payloadBytes: number;
  }): BucketSummary {
    const now = new Date().toISOString();
    this.db.prepare(
      "INSERT INTO buckets (id, user_id, envelope_json, payload_bytes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(params.id, params.userId, JSON.stringify(params.envelope), params.payloadBytes, now, now);
    return {
      id: params.id,
      size: params.payloadBytes,
      createdAt: now,
      updatedAt: now,
    };
  }

  public list(userId: number): BucketSummary[] {
    const rows = this.db.prepare(
      "SELECT * FROM buckets WHERE user_id = ? ORDER BY updated_at DESC",
    ).all(userId) as unknown as BucketRow[];
    return rows.map(mapBucketRow);
  }

  public get(userId: number, id: string): BucketDetail | undefined {
    const row = this.db.prepare(
      "SELECT * FROM buckets WHERE user_id = ? AND id = ?",
    ).get(userId, id) as BucketRow | undefined;

    if (!row) {
      return undefined;
    }

    return {
      ...mapBucketRow(row),
      envelope: JSON.parse(row.envelope_json) as EncryptedEnvelope,
    };
  }

  /** Update a bucket's envelope, returning the new size. Throws 404 if missing. */
  public update(params: {
    userId: number;
    id: string;
    envelope: EncryptedEnvelope;
    payloadBytes: number;
  }): BucketSummary {
    const now = new Date().toISOString();
    const result = this.db.prepare(
      "UPDATE buckets SET envelope_json = ?, payload_bytes = ?, updated_at = ? WHERE user_id = ? AND id = ?",
    ).run(JSON.stringify(params.envelope), params.payloadBytes, now, params.userId, params.id);

    if (result.changes === 0) {
      throw new HttpError(404, "Bucket not found", { success: false, message: "Bucket not found" });
    }

    return {
      id: params.id,
      size: params.payloadBytes,
      createdAt: now,
      updatedAt: now,
    };
  }

  public delete(userId: number, id: string): boolean {
    const result = this.db.prepare(
      "DELETE FROM buckets WHERE user_id = ? AND id = ?",
    ).run(userId, id);
    return result.changes > 0;
  }

  public usedBytes(userId: number): number {
    const row = this.db.prepare(
      "SELECT COALESCE(SUM(payload_bytes), 0) AS total FROM buckets WHERE user_id = ?",
    ).get(userId) as { total: number };
    return Number(row.total);
  }

  public getPayloadBytes(userId: number, id: string): number | undefined {
    const row = this.db.prepare(
      "SELECT payload_bytes FROM buckets WHERE user_id = ? AND id = ?",
    ).get(userId, id) as { payload_bytes: number } | undefined;
    return row === undefined ? undefined : Number(row.payload_bytes);
  }
}
