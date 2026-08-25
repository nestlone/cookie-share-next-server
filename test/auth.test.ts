import { afterEach, describe, expect, it } from "vitest";
import { createTestServer, FakeProvider, followAuthorization, requestJson, signIn, type TestServer } from "./helpers";

let testServer: TestServer | undefined;
afterEach(async () => { await testServer?.close(); testServer = undefined; });

describe("OAuth authentication", () => {
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
