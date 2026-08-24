import { afterEach, describe, expect, it } from "vitest";
import { authHeaders, createTestServer, register, requestJson, type TestServer } from "./helpers";

let testServer: TestServer | undefined;

function opaqueEnvelope(payloadSize = 64): Record<string, unknown> {
  return {
    version: 1,
    salt: Buffer.alloc(16, 0x11).toString("base64url"),
    iv: Buffer.alloc(12, 0x22).toString("base64url"),
    payload: Buffer.alloc(payloadSize, 0x33).toString("base64url"),
  };
}

async function createBucket(baseUrl: string, token: string, id = "bucketOne", payloadSize = 64) {
  return await requestJson(baseUrl, "/buckets", {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ id, envelope: opaqueEnvelope(payloadSize) }),
  });
}

afterEach(async () => {
  await testServer?.close();
  testServer = undefined;
});

describe("buckets", () => {
  it("stores envelopes opaquely and returns them only to the owner", async () => {
    testServer = await createTestServer();
    const alice = await register(testServer.baseUrl, "alice");
    const bob = await register(testServer.baseUrl, "bob");
    const envelope = opaqueEnvelope(64);

    const created = await requestJson(testServer.baseUrl, "/buckets", {
      method: "POST",
      headers: { ...authHeaders(alice), "Content-Type": "application/json" },
      body: JSON.stringify({ id: "bucketOne", envelope }),
    });
    expect(created.response.status).toBe(201);
    expect(created.body).toMatchObject({ id: "bucketOne", size: 64 });

    const read = await requestJson(testServer.baseUrl, "/buckets/bucketOne", {
      headers: authHeaders(alice),
    });
    expect(read.response.status).toBe(200);
    expect(read.body?.envelope).toEqual(envelope);

    const otherUser = await requestJson(testServer.baseUrl, "/buckets/bucketOne", {
      headers: authHeaders(bob),
    });
    expect(otherUser.response.status).toBe(404);

    // Identical IDs are valid across different accounts: this enables importing
    // an exported bucket into another account on the same official instance.
    const imported = await requestJson(testServer.baseUrl, "/buckets", {
      method: "POST",
      headers: { ...authHeaders(bob), "Content-Type": "application/json" },
      body: JSON.stringify({ id: "bucketOne", envelope }),
    });
    expect(imported.response.status).toBe(201);
  });

  it("updates, lists, and deletes an owned bucket", async () => {
    testServer = await createTestServer();
    const token = await register(testServer.baseUrl);
    await createBucket(testServer.baseUrl, token);

    const list = await requestJson(testServer.baseUrl, "/buckets", { headers: authHeaders(token) });
    expect(list.response.status).toBe(200);
    expect(list.body?.buckets).toHaveLength(1);

    const update = await requestJson(testServer.baseUrl, "/buckets/bucketOne", {
      method: "PUT",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ envelope: opaqueEnvelope(96) }),
    });
    expect(update.response.status).toBe(200);
    expect(update.body).toMatchObject({ id: "bucketOne", size: 96 });

    const deleted = await fetch(`${testServer.baseUrl}/buckets/bucketOne`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    expect(deleted.status).toBe(204);

    const missing = await requestJson(testServer.baseUrl, "/buckets/bucketOne", {
      headers: authHeaders(token),
    });
    expect(missing.response.status).toBe(404);
  });

  it("rejects malformed envelope objects", async () => {
    testServer = await createTestServer();
    const token = await register(testServer.baseUrl);
    const invalid = await requestJson(testServer.baseUrl, "/buckets", {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ id: "bucketOne", envelope: { version: 1, salt: "AAAA" } }),
    });
    expect(invalid.response.status).toBe(400);
  });
});
