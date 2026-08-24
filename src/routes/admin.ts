import crypto from "node:crypto";
import type { Request, Response } from "express";
import { HttpError } from "../errors";
import { sendJson } from "../http";
import type { BucketStore } from "../store/buckets";
import type { UserStore } from "../store/users";
import type { RuntimeConfig } from "../types";

function timingSafeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function requireAdmin(config: RuntimeConfig) {
  return (request: Request, _response: Response, next: import("express").NextFunction): void => {
    const token = request.header("X-Admin-Token");
    if (!token || !timingSafeEqual(token, config.adminToken)) {
      throw new HttpError(401, "Unauthorized", { success: false, message: "Unauthorized" });
    }
    next();
  };
}

export function listUsers(
  _request: Request,
  response: Response,
  users: UserStore,
  buckets: BucketStore,
): void {
  const result = users.listAll().map((user) => ({
    id: user.id,
    displayName: user.displayName,
    quotaBytes: user.quotaBytes,
    dailyRequestLimit: user.dailyRequestLimit,
    usedBytes: buckets.usedBytes(user.id),
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  }));
  sendJson(response, 200, { users: result });
}

function optionalNonNegativeInteger(value: unknown, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new HttpError(400, `Invalid ${field}`, { success: false, message: `Invalid ${field}` });
  }
  return value;
}

export function updateUserQuota(request: Request, response: Response, users: UserStore): void {
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new HttpError(400, "Invalid user ID", { success: false, message: "Invalid user ID" });
  }
  if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
    throw new HttpError(400, "Invalid payload", { success: false, message: "Invalid payload" });
  }

  const body = request.body as Record<string, unknown>;
  const quotaBytes = optionalNonNegativeInteger(body.quotaBytes, "quotaBytes");
  const dailyRequestLimit = optionalNonNegativeInteger(body.dailyRequestLimit, "dailyRequestLimit");
  if (quotaBytes === undefined && dailyRequestLimit === undefined) {
    throw new HttpError(400, "No quota values provided", {
      success: false,
      message: "No quota values provided",
    });
  }

  const patch: { quotaBytes?: number; dailyRequestLimit?: number } = {};
  if (quotaBytes !== undefined) {
    patch.quotaBytes = quotaBytes;
  }
  if (dailyRequestLimit !== undefined) {
    patch.dailyRequestLimit = dailyRequestLimit;
  }

  const user = users.updateQuota(id, patch);
  if (!user) {
    throw new HttpError(404, "User not found", { success: false, message: "User not found" });
  }

  sendJson(response, 200, {
    user: {
      id: user.id,
      displayName: user.displayName,
      quotaBytes: user.quotaBytes,
      dailyRequestLimit: user.dailyRequestLimit,
      updatedAt: user.updated_at,
    },
  });
}
