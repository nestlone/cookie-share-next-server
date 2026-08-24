import type { Request, Response } from "express";
import { HttpError } from "../errors";
import { sendJson, sendNoContent } from "../http";
import type { BucketStore } from "../store/buckets";
import type { ProviderAccountStore } from "../store/provider-accounts";
import type { RequestLogStore } from "../store/request-log";
import type { SessionStore } from "../store/sessions";
import type { UserStore } from "../store/users";
import type { AuthUserPayload, PublicUser } from "../types";

export function toAuthUser(user: PublicUser, accounts: ProviderAccountStore): AuthUserPayload {
  return {
    id: user.id,
    displayName: user.displayName,
    quotaBytes: user.quotaBytes,
    dailyRequestLimit: user.dailyRequestLimit,
    providers: accounts.listForUser(user.id).map((account) => ({ id: account.provider, login: account.login })),
  };
}

function utcDayStart(): string {
  return `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
}

export function logout(request: Request, response: Response, sessions: SessionStore): void {
  const authHeader = request.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) sessions.delete(authHeader.slice(7));
  sendNoContent(response);
}

export function getMe(request: Request, response: Response, users: UserStore, accounts: ProviderAccountStore, buckets: BucketStore, requestLog: RequestLogStore): void {
  if (request.userId === undefined) throw new HttpError(401, "Unauthorized", { success: false, message: "Unauthorized" });
  const user = users.findById(request.userId);
  if (!user) throw new HttpError(401, "User not found", { success: false, message: "User not found" });
  const publicUser: PublicUser = {
    id: user.id,
    displayName: user.display_name,
    quotaBytes: user.quota_bytes,
    dailyRequestLimit: user.daily_request_limit,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
  sendJson(response, 200, {
    user: toAuthUser(publicUser, accounts),
    usage: { usedBytes: buckets.usedBytes(user.id), todayRequests: requestLog.countSince(user.id, utcDayStart()), todayRequestsLimit: user.daily_request_limit },
  });
}
