import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/worker.ts";
import { createTestD1 } from "./helpers/d1.mjs";

const baseURL = "https://standup-helper.example";

async function testEnv() {
  return {
    DB: await createTestD1(),
    BETTER_AUTH_SECRET: "a-test-better-auth-secret-that-is-longer-than-32-characters",
    PUBLIC_APP_URL: baseURL,
    ASSETS: {
      async fetch(request) {
        return new Response(`asset:${new URL(request.url).pathname}`, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      },
    },
  };
}

function request(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("cf-connecting-ip", "203.0.113.10");
  return new Request(`${baseURL}${path}`, { ...options, headers });
}

async function signUp(env, user = {
  name: "Grace Hopper",
  email: "grace@example.com",
  password: "compiler pioneer 1952",
}) {
  const response = await worker.fetch(request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  }), env);
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}

test("serves the public account page and protects the workspace", async () => {
  const env = await testEnv();
  const login = await worker.fetch(request("/"), env);
  assert.equal(login.status, 200);
  assert.equal(await login.text(), "asset:/login.html");

  const admin = await worker.fetch(request("/admin"), env);
  assert.equal(admin.status, 302);
  assert.equal(admin.headers.get("location"), `${baseURL}/`);

  const dashboard = await worker.fetch(request("/dashboard"), env);
  assert.equal(dashboard.status, 302);
});

test("registers a user and exposes the protected workspace", async () => {
  const env = await testEnv();
  const cookie = await signUp(env);

  const root = await worker.fetch(request("/", { headers: { Cookie: cookie } }), env);
  assert.equal(root.status, 302);
  assert.equal(root.headers.get("location"), `${baseURL}/dashboard`);

  const admin = await worker.fetch(request("/admin", { headers: { Cookie: cookie } }), env);
  assert.equal(admin.status, 200);
  assert.equal(await admin.text(), "asset:/admin.html");

  const dashboard = await worker.fetch(request("/dashboard", { headers: { Cookie: cookie } }), env);
  assert.equal(dashboard.status, 200);
  assert.equal(await dashboard.text(), "asset:/dashboard.html");

  const session = await worker.fetch(request("/api/auth/get-session", {
    headers: { Cookie: cookie },
  }), env);
  assert.equal(session.status, 200);
  assert.equal((await session.json()).user.email, "grace@example.com");
});

test("creates and joins rooms through authenticated APIs", async () => {
  const env = await testEnv();
  const ownerCookie = await signUp(env);
  const memberCookie = await signUp(env, {
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "analytical engine 1843",
  });

  const createdResponse = await worker.fetch(request("/api/rooms", {
    method: "POST",
    headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Product standup", defaultTalkLimitSeconds: 120 }),
  }), env);
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()).room;

  const joinedResponse = await worker.fetch(request("/api/rooms/join", {
    method: "POST",
    headers: { Cookie: memberCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ joinCode: created.joinCode }),
  }), env);
  assert.equal(joinedResponse.status, 200);
  assert.equal((await joinedResponse.json()).room.role, "member");

  const detailResponse = await worker.fetch(request(`/api/rooms/${created.id}`, {
    headers: { Cookie: memberCookie },
  }), env);
  assert.equal(detailResponse.status, 200);
  assert.equal((await detailResponse.json()).room.members.length, 2);
});

test("signs in an existing user with email and password", async () => {
  const env = await testEnv();
  await signUp(env);

  const response = await worker.fetch(request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "grace@example.com", password: "compiler pioneer 1952" }),
  }), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /standup_helper\.session_token=/);
});

test("rejects invalid credentials and anonymous task requests", async () => {
  const env = await testEnv();
  const login = await worker.fetch(request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "missing@example.com", password: "incorrect password value" }),
  }), env);
  assert.equal(login.status, 401);

  const task = await worker.fetch(request("/api/task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "current", recentTasks: [] }),
  }), env);
  assert.equal(task.status, 401);
  assert.equal((await task.json()).code, "AUTH_REQUIRED");
});

test("revokes the database session on sign out", async () => {
  const env = await testEnv();
  const cookie = await signUp(env);
  const response = await worker.fetch(request("/api/auth/sign-out", {
    method: "POST",
    headers: { Cookie: cookie, Origin: baseURL, "Content-Type": "application/json" },
    body: "{}",
  }), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/);

  const admin = await worker.fetch(request("/admin", { headers: { Cookie: cookie } }), env);
  assert.equal(admin.status, 302);
});

test("keeps explicit method guards and security headers", async () => {
  const env = await testEnv();
  const response = await worker.fetch(request("/api/task"), env);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
  assert.equal(response.headers.get("x-frame-options"), "DENY");

  const rooms = await worker.fetch(request("/api/rooms", { method: "PUT" }), env);
  assert.equal(rooms.status, 405);
  assert.equal(rooms.headers.get("allow"), "GET, POST");
});
