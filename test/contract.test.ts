import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { validateEnvelope, validateId, validatePassword, validateUsername } from "../src/validation";
import { authHeaders, createTestServer, register, requestJson, type TestServer } from "./helpers";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const vectors = JSON.parse(
  readFileSync(path.resolve(dirname, "../contract/vectors.json"), "utf8"),
) as {
  bucket: { envelope: unknown; plaintext: { bucketId: string } };
  invalidEnvelopes: unknown[];
  ids: { valid: string[]; invalid: unknown[] };
  usernames: { valid: string[]; invalid: unknown[] };
  passwords: { valid: string[]; invalid: unknown[] };
};

let testServer: TestServer | undefined;

afterEach(async () => {
  await testServer?.close();
  testServer = undefined;
});

describe("protocol contract", () => {
  it("accepts the fixed bucket envelope as opaque storage", async () => {
    testServer = await createTestServer();
    const token = await register(testServer.baseUrl);
    const created = await requestJson(testServer.baseUrl, "/buckets", {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ id: vectors.bucket.plaintext.bucketId, envelope: vectors.bucket.envelope }),
    });
    expect(created.response.status).toBe(201);

    const read = await requestJson(testServer.baseUrl, `/buckets/${vectors.bucket.plaintext.bucketId}`, {
      headers: authHeaders(token),
    });
    expect(read.body?.envelope).toEqual(vectors.bucket.envelope);
  });

  it("rejects invalid envelope shapes", () => {
    for (const envelope of vectors.invalidEnvelopes) {
      expect(() => validateEnvelope(envelope)).toThrow();
    }
  });

  it("replays ID, username, and password validation vectors", () => {
    for (const id of vectors.ids.valid) {
      expect(validateId(id)).toBe(id);
    }
    for (const id of vectors.ids.invalid) {
      expect(() => validateId(id)).toThrow();
    }

    for (const username of vectors.usernames.valid) {
      expect(validateUsername(username)).toBe(username);
    }
    for (const username of vectors.usernames.invalid) {
      expect(() => validateUsername(username)).toThrow();
    }

    for (const password of vectors.passwords.valid) {
      expect(validatePassword(password)).toBe(password);
    }
    for (const password of vectors.passwords.invalid) {
      expect(() => validatePassword(password)).toThrow();
    }
  });
});
