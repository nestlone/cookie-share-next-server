import type { Response } from "express";

export const CORS_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
export const CORS_HEADERS = "Content-Type, Authorization, X-Admin-Token";

export function applyCorsHeaders(response: Response): void {
  response.setHeader("Access-Control-Allow-Methods", CORS_METHODS);
  response.setHeader("Access-Control-Allow-Headers", CORS_HEADERS);
  response.setHeader("Vary", "Origin");
}

export function applyCorsOrigin(response: Response, origin: string | undefined, allowedExtensionIds: readonly string[]): void {
  if (!origin) return;
  const extensionId = origin.match(/^chrome-extension:\/\/([a-p]{32})$/)?.[1];
  if (extensionId && allowedExtensionIds.includes(extensionId)) response.setHeader("Access-Control-Allow-Origin", origin);
}

export function applySecurityHeaders(response: Response): void {
  response.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  response.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
}

export function sendJson(response: Response, status: number, body: unknown): void {
  applyCorsHeaders(response);
  response.status(status).type("application/json; charset=UTF-8").send(JSON.stringify(body));
}

export function sendNoContent(response: Response): void {
  applyCorsHeaders(response);
  response.status(204).end();
}

export function sendCorsPreflight(response: Response): void {
  applyCorsHeaders(response);
  response.status(204).end();
}
