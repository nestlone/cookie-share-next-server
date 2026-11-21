// Run against `wrangler dev --local --port 8799` after local D1 migrations.
import assert from "node:assert/strict";

const base = "http://127.0.0.1:8799/api/v1";
async function request(path, { token, body, method = "POST" } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = response.status === 204 ? null : await response.json();
  return { response, data };
}

const created = await request("/auth/key/register");
assert.equal(created.response.status, 201);
assert.equal(created.response.headers.get("Cache-Control"), "no-store");
assert.match(created.data.key, /^[A-Za-z0-9_-]{43}$/);
assert.notEqual(created.data.key, created.data.token);
assert.deepEqual(created.data.user.providers, []);
const profile = await request("/me", { token: created.data.token, method: "GET" });
assert.equal(profile.response.status, 200);
assert.equal(JSON.stringify(profile.data).includes(created.data.key), false);
await request("/auth/logout", { token: created.data.token });
assert.equal((await request("/me", { token: created.data.token, method: "GET" })).response.status, 401);
const login = await request("/auth/backup-key/exchange", { body: { key: created.data.key } });
assert.equal(login.response.status, 200);
assert.equal(login.data.user.id, created.data.user.id);
const rotated = await request("/auth/backup-key/reset", { token: login.data.token });
assert.equal(rotated.response.status, 200);
assert.equal((await request("/auth/backup-key/exchange", { body: { key: created.data.key } })).response.status, 401);
assert.equal((await request("/auth/backup-key/exchange", { body: { key: rotated.data.key } })).response.status, 200);

// Three exchanges already used. Concurrent requests must never exceed twenty.
const attempts = await Promise.all(Array.from({ length: 30 }, () => request("/auth/backup-key/exchange", { body: { key: "invalid" } })));
assert.equal(attempts.filter(x => x.response.status === 401).length, 17);
assert.equal(attempts.filter(x => x.response.status === 429).length, 13);
for (const blocked of attempts.filter(x => x.response.status === 429)) {
  assert.ok(blocked.data.retryAfter > 0 && blocked.data.retryAfter <= 60);
  assert.equal(blocked.response.headers.get("Retry-After"), String(blocked.data.retryAfter));
}
for (let i = 0; i < 4; i++) assert.equal((await request("/auth/key/register")).response.status, 201);
assert.equal((await request("/auth/key/register")).response.status, 429);
assert.equal((await request("/me", { token: login.data.token, method: "GET" })).response.status, 200);
console.log("Worker + D1: registration, key login, logout, rotation, concurrent rate limits and flow isolation passed.");
