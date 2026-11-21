import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createTestServer, FakeProvider, followAuthorization, requestJson, signIn, type TestServer } from "./helpers";

let testServer: TestServer | undefined;
afterEach(async () => { await testServer?.close(); testServer = undefined; });

describe("OAuth authentication", () => {
  it("accepts both configured official identities while rejecting other extensions", async () => {
    const config = readFileSync("wrangler.toml", "utf8");
    const allowedExtensionIds = config.match(/^ALLOWED_EXTENSION_IDS = "([^"]+)"/m)![1]!.split(",");
    expect(allowedExtensionIds).toContain("lakmdllikmnehpebnphhemkcedkgkfpj");
    expect(allowedExtensionIds).toContain("kilogkcionjhdmmeafjogdhpoiocgaom");
    testServer = await createTestServer({ publicBaseUrl: "https://cookie.nestlone.com", allowedExtensionIds });
    for (const id of [...allowedExtensionIds, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]) {
      const { response } = await requestJson(testServer.baseUrl, "/auth/oauth/github/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "login", redirectUri: `https://${id}.chromiumapp.org/` }),
      });
      expect(response.status).toBe(allowedExtensionIds.includes(id) ? 200 : 400);
    }
  });

  it("signs in, reads a profile, and logs out", async () => {
    testServer = await createTestServer();
    const token = await signIn(testServer.baseUrl);
    const me = await requestJson(testServer.baseUrl, "/me", { headers: { Authorization: `Bearer ${token}` } });
    expect(me.response.status).toBe(200);
    expect(me.body).toMatchObject({ user: { displayName: "alice", providers: [{ id: "github", login: "alice" }], quotaBytes: 1048576, dailyRequestLimit: 100 } });
    const logout = await fetch(`${testServer.baseUrl}/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    expect(logout.status).toBe(204);
    expect((await requestJson(testServer.baseUrl, "/me", { headers: { Authorization: `Bearer ${token}` } })).response.status).toBe(401);
  });

  it("does not merge identities that merely share a display name", async () => {
    const github = new FakeProvider("github", { subject: "github-1", login: "same@example.com" });
    const google = new FakeProvider("google", { subject: "google-1", login: "same@example.com" });
    testServer = await createTestServer({}, [github, google]);
    const first = await signIn(testServer.baseUrl, "github");
    const second = await signIn(testServer.baseUrl, "google");
    const firstProfile = await requestJson(testServer.baseUrl, "/me", { headers: { Authorization: `Bearer ${first}` } });
    const secondProfile = await requestJson(testServer.baseUrl, "/me", { headers: { Authorization: `Bearer ${second}` } });
    expect(firstProfile.body?.user).toMatchObject({ providers: [{ id: "github" }] });
    expect(secondProfile.body?.user).toMatchObject({ providers: [{ id: "google" }] });
    expect((firstProfile.body?.user as { id: number }).id).not.toBe((secondProfile.body?.user as { id: number }).id);
  });

  it("links another provider manually and forbids removing the last one", async () => {
    testServer = await createTestServer();
    const token = await signIn(testServer.baseUrl);
    const redirectUri = "http://127.0.0.1/link-result";
    const start = await requestJson(testServer.baseUrl, "/auth/oauth/google/start", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ mode: "link", redirectUri }) });
    const callback = await followAuthorization(testServer.baseUrl, start.body?.authorizeUrl as string);
    expect(callback.headers.get("location")).toContain("linked=1");
    const profile = await requestJson(testServer.baseUrl, "/me", { headers: { Authorization: `Bearer ${token}` } });
    expect(profile.body?.user).toMatchObject({ providers: [{ id: "github" }, { id: "google" }] });
    expect((await requestJson(testServer.baseUrl, "/auth/oauth/github", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })).response.status).toBe(200);
    expect((await requestJson(testServer.baseUrl, "/auth/oauth/google", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })).response.status).toBe(409);
  });

  it("allows every exchange code only once", async () => {
    testServer = await createTestServer();
    const start = await requestJson(testServer.baseUrl, "/auth/oauth/github/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "login", redirectUri: "http://127.0.0.1/result" }) });
    const callback = await followAuthorization(testServer.baseUrl, start.body?.authorizeUrl as string);
    const code = new URL(callback.headers.get("location") as string).searchParams.get("code") as string;
    expect((await requestJson(testServer.baseUrl, "/auth/oauth/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) })).response.status).toBe(200);
    expect((await requestJson(testServer.baseUrl, "/auth/oauth/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) })).response.status).toBe(401);
  });

  it("links a key account, rejects duplicate providers and identities owned by another user", async () => {
    testServer = await createTestServer();
    const created = await requestJson(testServer.baseUrl, "/auth/key/register", { method: "POST" });
    const token = created.body?.token as string;
    const userId = (created.body?.user as { id: number }).id;
    const link = async (provider: string, code?: string, owner = token) => {
      const start = await requestJson(testServer!.baseUrl, `/auth/oauth/${provider}/start`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${owner}` }, body: JSON.stringify({ mode: "link", redirectUri: "http://127.0.0.1/link-result" }) });
      expect(start.response.status).toBe(200);
      return (await followAuthorization(testServer!.baseUrl, start.body?.authorizeUrl as string, code)).headers.get("location")!;
    };
    expect(await link("github")).toContain("linked=1");
    expect(await link("github")).toContain("error=provider_type_already_linked");
    expect(await link("github", "fake-user-bob")).toContain("error=provider_type_already_linked");
    expect(await link("google")).toContain("linked=1");
    const signedIn = await signIn(testServer.baseUrl);
    const profile = await requestJson(testServer.baseUrl, "/me", { headers: { Authorization: `Bearer ${signedIn}` } });
    expect(profile.body?.user).toMatchObject({ id: userId, hasLoginKey: true, providers: [{ id: "github" }, { id: "google" }] });
    const second = await signIn(testServer.baseUrl, "github", "charlie");
    expect(await link("google", undefined, second)).toContain("error=provider_already_linked");
    // A retained login key allows removal of the last OAuth provider.
    for (const provider of ["github", "google"]) {
      expect((await requestJson(testServer.baseUrl, `/auth/oauth/${provider}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })).response.status).toBe(200);
    }
    const login = await requestJson(testServer.baseUrl, "/auth/backup-key/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: created.body?.key }) });
    expect(login.response.status).toBe(200);
    expect(login.body?.user).toMatchObject({ id: userId, providers: [] });
  });

  it("allows only one of two competing same-provider bindings", async () => {
    testServer = await createTestServer();
    const created = await requestJson(testServer.baseUrl, "/auth/key/register", { method: "POST" });
    const starts = await Promise.all([1, 2].map(() => requestJson(testServer!.baseUrl, "/auth/oauth/github/start", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${created.body?.token}` }, body: JSON.stringify({ mode: "link", redirectUri: "http://127.0.0.1/link-result" }) })));
    const results = await Promise.all(starts.map((start, index) => followAuthorization(testServer!.baseUrl, start.body?.authorizeUrl as string, `fake-user-race${index}`)));
    expect(results.filter(result => result.headers.get("location")?.includes("linked=1"))).toHaveLength(1);
    expect(results.filter(result => result.headers.get("location")?.includes("error=provider_type_already_linked"))).toHaveLength(1);
  });

  it("resets a backup key, exchanges it for a session, and revokes the old key", async () => {
    testServer = await createTestServer();
    const token = await signIn(testServer.baseUrl);
    const reset = await requestJson(testServer.baseUrl, "/auth/backup-key/reset", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    expect(reset.response.status).toBe(200);
    const key = reset.body?.key as string;
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const exchanged = await requestJson(testServer.baseUrl, "/auth/backup-key/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    expect(exchanged.response.status).toBe(200);
    expect(exchanged.body?.user).toMatchObject({ displayName: "alice" });
    const replacement = await requestJson(testServer.baseUrl, "/auth/backup-key/reset", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    expect(replacement.response.status).toBe(200);
    expect((await requestJson(testServer.baseUrl, "/auth/backup-key/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) })).response.status).toBe(401);
  });

  it("allows twenty key attempts and returns a precise retry delay", async () => {
    testServer = await createTestServer();
    const token = await signIn(testServer.baseUrl);
    const reset = await requestJson(testServer.baseUrl, "/auth/backup-key/reset", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const key = reset.body?.key as string;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect((await requestJson(testServer.baseUrl, "/auth/backup-key/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "invalid" }) })).response.status).toBe(401);
    }
    const blocked = await requestJson(testServer.baseUrl, "/auth/backup-key/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    expect(blocked.response.status).toBe(429);
    expect(Number(blocked.response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(blocked.body?.retryAfter).toBeLessThanOrEqual(60);
  });

  it("creates a key-only account without OAuth, supports login and key rotation", async () => {
    testServer = await createTestServer({}, []);
    const created = await requestJson(testServer.baseUrl, "/auth/key/register", { method: "POST" });
    expect(created.response.status).toBe(201);
    expect(created.response.headers.get("Cache-Control")).toBe("no-store");
    expect(created.body?.key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(created.body?.key).not.toBe(created.body?.token);
    expect(created.body?.user).toMatchObject({ providers: [], quotaBytes: 1048576 });
    const headers = { Authorization: `Bearer ${created.body?.token}` };
    const me = await requestJson(testServer.baseUrl, "/me", { headers });
    expect(me.response.status).toBe(200);
    expect(JSON.stringify(me.body)).not.toContain(created.body?.key);
    await requestJson(testServer.baseUrl, "/auth/logout", { method: "POST", headers });
    const login = await requestJson(testServer.baseUrl, "/auth/backup-key/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: created.body?.key }) });
    expect(login.response.status).toBe(200);
    expect(login.body?.user).toEqual(created.body?.user);
    const rotated = await requestJson(testServer.baseUrl, "/auth/backup-key/reset", { method: "POST", headers: { Authorization: `Bearer ${login.body?.token}` } });
    expect(rotated.response.status).toBe(200);
    expect((await requestJson(testServer.baseUrl, "/auth/backup-key/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: created.body?.key }) })).response.status).toBe(401);
    expect((await requestJson(testServer.baseUrl, "/auth/backup-key/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: rotated.body?.key }) })).response.status).toBe(200);
  });

  it("limits registrations separately and does not block OAuth steps from each other", async () => {
    testServer = await createTestServer({ loginRateLimit: 1 });
    const token = await signIn(testServer.baseUrl);
    expect(token).toBeTruthy();
    for (let i = 0; i < 5; i++) {
      expect((await requestJson(testServer.baseUrl, "/auth/key/register", { method: "POST" })).response.status).toBe(201);
    }
    expect((await requestJson(testServer.baseUrl, "/auth/key/register", { method: "POST" })).response.status).toBe(429);
    expect((await requestJson(testServer.baseUrl, "/auth/backup-key/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "invalid" }) })).response.status).toBe(401);
  });

  it("only permits OAuth result redirects for explicitly allowed extension IDs", async () => {
    const allowedId = "abcdefghijklmnopabcdefghijklmnop";
    testServer = await createTestServer({ publicBaseUrl: "https://service.example", allowedExtensionIds: [allowedId] });
    const rejected = await requestJson(testServer.baseUrl, "/auth/oauth/github/start", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "login", redirectUri: "https://ponmlkjihgfedcbaponmlkjihgfedcba.chromiumapp.org/callback" }),
    });
    expect(rejected.response.status).toBe(400);
    const accepted = await requestJson(testServer.baseUrl, "/auth/oauth/github/start", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "login", redirectUri: `https://${allowedId}.chromiumapp.org/callback` }),
    });
    expect(accepted.response.status).toBe(200);
  });
});
