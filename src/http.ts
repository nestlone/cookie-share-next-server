import type { Response } from "express";

export const CORS_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
export const CORS_HEADERS = "Content-Type, Authorization, X-Admin-Token";

export function applyCorsHeaders(response: Response): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", CORS_METHODS);
  response.setHeader("Access-Control-Allow-Headers", CORS_HEADERS);
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
