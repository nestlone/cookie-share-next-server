import type { Request, Response } from "express";
import { HttpError } from "../errors";
import { sendJson, sendNoContent } from "../http";
import type { BucketStore } from "../store/buckets";
import type { UserStore } from "../store/users";
import type { EncryptedEnvelope } from "../types";
import { payloadByteLength, validateEnvelope, validateId } from "../validation";

function userIdFromRequest(request: Request): number {
  if (request.userId === undefined) {
    throw new HttpError(401, "Unauthorized", { success: false, message: "Unauthorized" });
  }
  return request.userId;
}

function readEnvelopeBody(body: unknown): EncryptedEnvelope {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Invalid payload", { success: false, message: "Invalid payload" });
  }

  return validateEnvelope((body as Record<string, unknown>).envelope);
}

function requireWithinQuota(
  users: UserStore,
  buckets: BucketStore,
  userId: number,
  nextPayloadBytes: number,
  previousPayloadBytes: number,
): void {
  const user = users.findById(userId);
  if (!user) {
    throw new HttpError(401, "User not found", { success: false, message: "User not found" });
  }

  const nextUsedBytes = buckets.usedBytes(userId) - previousPayloadBytes + nextPayloadBytes;
  if (nextUsedBytes > user.quota_bytes) {
    throw new HttpError(413, "Storage quota exceeded", {
      success: false,
      message: "Storage quota exceeded",
      quotaBytes: user.quota_bytes,
      usedBytes: buckets.usedBytes(userId),
    });
  }
}

export function createBucket(
  request: Request,
  response: Response,
  users: UserStore,
  buckets: BucketStore,
): void {
  const body = request.body as Record<string, unknown>;
  const id = validateId(body?.id);
  const envelope = readEnvelopeBody(body);
  const userId = userIdFromRequest(request);

  if (buckets.exists(userId, id)) {
    throw new HttpError(409, "Bucket already exists", {
      success: false,
      message: "Bucket already exists",
    });
  }

  const size = payloadByteLength(envelope);
  requireWithinQuota(users, buckets, userId, size, 0);
  sendJson(response, 201, buckets.create({ userId, id, envelope, payloadBytes: size }));
}

export function listBuckets(request: Request, response: Response, buckets: BucketStore): void {
  sendJson(response, 200, { buckets: buckets.list(userIdFromRequest(request)) });
}

export function getBucket(request: Request, response: Response, buckets: BucketStore): void {
  const id = validateId(request.params.id);
  const bucket = buckets.get(userIdFromRequest(request), id);
  if (!bucket) {
    throw new HttpError(404, "Bucket not found", { success: false, message: "Bucket not found" });
  }

  sendJson(response, 200, bucket);
}

export function updateBucket(
  request: Request,
  response: Response,
  users: UserStore,
  buckets: BucketStore,
): void {
  const id = validateId(request.params.id);
  const envelope = readEnvelopeBody(request.body);
  const userId = userIdFromRequest(request);
  const previousSize = buckets.getPayloadBytes(userId, id);
  if (previousSize === undefined) {
    throw new HttpError(404, "Bucket not found", { success: false, message: "Bucket not found" });
  }

  const size = payloadByteLength(envelope);
  requireWithinQuota(users, buckets, userId, size, previousSize);
  sendJson(response, 200, buckets.update({ userId, id, envelope, payloadBytes: size }));
}

export function deleteBucket(request: Request, response: Response, buckets: BucketStore): void {
  const id = validateId(request.params.id);
  if (!buckets.delete(userIdFromRequest(request), id)) {
    throw new HttpError(404, "Bucket not found", { success: false, message: "Bucket not found" });
  }

  sendNoContent(response);
}
