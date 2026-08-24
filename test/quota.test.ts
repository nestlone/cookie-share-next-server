import { afterEach, describe, expect, it } from "vitest";
import { authHeaders, createTestServer, register, requestJson, type TestServer } from "./helpers";

let testServer: TestServer | undefined;

function envelope(payloadSize: number): Record<string, unknown> {
  return {
    version: 1,
    salt: Buffer.alloc(16, 1).toString("base64url"),
    iv: Buffer.alloc(12, 2).toString("base64url"),
    payload: Buffer.alloc(payloadSize, 3).toString("base64url"),
  };
}

afterEach(async () => {
  await testServer?.close();
  testServer = undefined;
});

describe("quotas and administration", () => {
  it("enforces byte quotas for creates and updates", async () => {
    testServer = await createTestServer({ defaultQuotaBytes: 100 });
    const token = await register(testServer.baseUrl);

    const first = await requestJson(testServer.baseUrl, "/buckets", {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ id: "bucketOne", envelope: envelope(64) }),
    });
    expect(first.response.status).toBe(201);

    const overQuota = await requestJson(testServer.baseUrl, "/buckets", {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ id: "bucketTwo", envelope: envelope(64) }),
    });
    expect(overQuota.response.status).toBe(413);

    const updateOverQuota = await requestJson(testServer.baseUrl, "/buckets/bucketOne", {
      method: "PUT",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ envelope: envelope(128) }),
    });
    expect(updateOverQuota.response.status).toBe(413);
  });

  it("enforces daily request limits", async () => {
    testServer = await createTestServer({ defaultDailyRequestLimit: 2 });
    const token = await register(testServer.baseUrl);

    for (let i = 0; i < 2; i += 1) {
      const result = await requestJson(testServer.baseUrl, "/buckets", { headers: authHeaders(token) });
      expect(result.response.status).toBe(200);
    }

    const limited = await requestJson(testServer.baseUrl, "/buckets", { headers: authHeaders(token) });
    expect(limited.response.status).toBe(429);
  });

  it("lets the admin inspect and adjust account quotas", async () => {
    testServer = await createTestServer();
    await register(testServer.baseUrl);

    const denied = await requestJson(testServer.baseUrl, "/admin/users");
    expect(denied.response.status).toBe(401);

    const users = await requestJson(testServer.baseUrl, "/admin/users", {
      headers: { "X-Admin-Token": "test-admin-token" },
    });
    expect(users.response.status).toBe(200);
    const firstUser = (users.body?.users as Array<{ id: number }>)[0];
    expect(firstUser).toBeDefined();

    const updated = await requestJson(testServer.baseUrl, `/admin/users/${firstUser.id}`, {
      method: "PATCH",
      headers: { "X-Admin-Token": "test-admin-token", "Content-Type": "application/json" },
      body: JSON.stringify({ quotaBytes: 2048, dailyRequestLimit: 5 }),
    });
    expect(updated.response.status).toBe(200);
    expect(updated.body).toMatchObject({
      user: { quotaBytes: 2048, dailyRequestLimit: 5 },
    });
  });
});
