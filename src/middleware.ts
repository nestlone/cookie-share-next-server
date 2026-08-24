import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./errors";
import type { SessionStore } from "./store/sessions";
import type { UserStore } from "./store/users";
import type { RuntimeConfig } from "./types";

/**
 * Auth middleware: parse Bearer token, verify session, attach req.userId.
 */
export function requireAuth(sessions: SessionStore) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const authHeader = request.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new HttpError(401, "Unauthorized", { success: false, message: "Unauthorized" });
    }

    const token = authHeader.slice(7);
    const userId = sessions.verify(token);
    if (userId === undefined) {
      throw new HttpError(401, "Session expired or invalid", {
        success: false,
        message: "Session expired or invalid",
      });
    }

    request.userId = userId;
    next();
  };
}

/**
 * Login rate limiter: in-memory per-IP burst protection.
 */
export function loginRateLimit(config: RuntimeConfig) {
  const attempts = new Map<string, number[]>();
  const limit = config.loginRateLimit;
  const windowMs = config.loginRateWindowMin * 60_000;

  // Prune stale entries every 60s (naive timer, fine for single-process).
  const cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, timestamps] of attempts) {
      const remaining = timestamps.filter((t) => t > cutoff);
      if (remaining.length === 0) {
        attempts.delete(ip);
      } else {
        attempts.set(ip, remaining);
      }
    }
  }, 60_000);

  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  return (request: Request, _response: Response, next: NextFunction): void => {
    const ip = request.ip ?? request.socket.remoteAddress ?? "unknown";
    const now = Date.now();
    const cutoff = now - windowMs;
    const timestamps = (attempts.get(ip) ?? []).filter((t) => t > cutoff);

    if (timestamps.length >= limit) {
      throw new HttpError(429, "Too many login attempts. Try again later.", {
        success: false,
        message: "Too many login attempts. Try again later.",
      });
    }

    timestamps.push(now);
    attempts.set(ip, timestamps);
    next();
  };
}

/**
 * Daily request rate limit: checks request_log for today.
 */
export function dailyRateLimit(
  store: import("./store/request-log").RequestLogStore,
  userStore: UserStore,
) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const userId = request.userId;
    if (userId === undefined) {
      throw new HttpError(401, "Unauthorized", { success: false, message: "Unauthorized" });
    }
    const user = userStore.findById(userId);
    if (!user) {
      throw new HttpError(401, "User not found", { success: false, message: "User not found" });
    }

    const todayStart = new Date().toISOString().slice(0, 10) + "T00:00:00.000Z";
    const count = store.countSince(userId, todayStart);

    if (count >= user.daily_request_limit) {
      throw new HttpError(429, "Daily request limit reached", {
        success: false,
        message: "Daily request limit reached",
      });
    }

    store.record(userId, `${request.method} ${request.path}`, null);
    next();
  };
}