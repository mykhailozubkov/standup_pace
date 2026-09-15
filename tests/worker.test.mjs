import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.ts";

const env = {
  ADMIN_USERNAME: "facilitator",
  ADMIN_PASSWORD: "correct horse battery staple",
  SESSION_SECRET: "a-test-session-secret-that-is-longer-than-32-characters",
  ASSETS: {
    async fetch(request) {
      return new Response(`asset:${new URL(request.url).pathname}`, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    },
  },
};

function request(path, options = {}) {
  return new Request(`https://standup-helper.example${path}`, options);
}

test("serves the public login page and protects the admin page", async () => {
  const login = await worker.fetch(request("/"), env);
  assert.equal(login.status, 200);
  assert.equal(await login.text(), "asset:/login.html");

  const admin = await worker.fetch(request("/admin"), env);
  assert.equal(admin.status, 302);
  assert.equal(admin.headers.get("location"), "https://standup-helper.example/");
});

test("authenticates an administrator and exposes the protected page", async () => {
  const login = await worker.fetch(request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD }),
  }), env);
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie");
  assert.match(cookie, /standup_helper_session=/);

  const admin = await worker.fetch(request("/admin", { headers: { Cookie: cookie } }), env);
  assert.equal(admin.status, 200);
  assert.equal(await admin.text(), "asset:/admin.html");

  const session = await worker.fetch(request("/api/auth/session", { headers: { Cookie: cookie } }), env);
  assert.deepEqual(await session.json(), { authenticated: true, configured: true });
});

test("rejects invalid credentials and anonymous task requests", async () => {
  const login = await worker.fetch(request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "facilitator", password: "incorrect password" }),
  }), env);
  assert.equal(login.status, 401);
  assert.equal((await login.json()).code, "INVALID_CREDENTIALS");

  const task = await worker.fetch(request("/api/task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "current", recentTasks: [] }),
  }), env);
  assert.equal(task.status, 401);
  assert.equal((await task.json()).code, "AUTH_REQUIRED");
});

test("clears the administrator session on logout", async () => {
  const response = await worker.fetch(request("/api/auth/logout", { method: "POST" }), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
});

test("returns explicit method guards through Hono routes", async () => {
  const response = await worker.fetch(request("/api/auth/session", { method: "POST" }), env);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
});
