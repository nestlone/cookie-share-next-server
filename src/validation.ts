import { HttpError } from "./errors";
import type { EncryptedEnvelope } from "./types";

const ID_PATTERN = /^[A-Za-z0-9]{1,64}$/;

function badRequest(message: string): HttpError {
  return new HttpError(400, message, { success: false, message });
}

export function validateId(value: unknown, message = "Invalid ID. Only letters and numbers are allowed."): string {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw badRequest(message);
  }

  return value;
}

function isBase64Url(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value) && value.length % 4 !== 1;
}

function decodedLength(value: string): number {
  return Buffer.from(value, "base64url").length;
}

export function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    (candidate.version === 1 || candidate.version === 2) &&
    typeof candidate.salt === "string" &&
    typeof candidate.iv === "string" &&
    typeof candidate.payload === "string" &&
    isBase64Url(candidate.salt) &&
    isBase64Url(candidate.iv) &&
    isBase64Url(candidate.payload) &&
    decodedLength(candidate.salt) === 16 &&
    decodedLength(candidate.iv) === 12 &&
    decodedLength(candidate.payload) >= 16
  );
}

export function validateEnvelope(value: unknown): EncryptedEnvelope {
  if (!isEncryptedEnvelope(value)) {
    throw badRequest("Invalid encrypted payload");
  }

  return value;
}

export function validateEnvelopeJson(value: unknown): EncryptedEnvelope {
  if (typeof value !== "string") {
    throw badRequest("Invalid encrypted payload");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw badRequest("Invalid encrypted payload");
  }

  return validateEnvelope(parsed);
}

/** base64url-decode and return the payload byte length (for quota accounting). */
export function payloadByteLength(envelope: EncryptedEnvelope): number {
  return Buffer.from(envelope.payload, "base64url").length;
}
