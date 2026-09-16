import assert from "node:assert/strict";
import test from "node:test";
import { createAuth, getAuthSession, SESSION_TTL_SECONDS } from "../src/auth.ts";
import { createTestD1 } from "./helpers/d1.mjs";

const baseURL = "https://standup-helper.example";

async function testEnv() {
  return {
    DB: await createTestD1(),
    BETTER_AUTH_SECRET: "a-test-better-auth-secret-that-is-longer-than-32-characters",
    PUBLIC_APP_URL: baseURL,
  };
}

function request(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("cf-connecting-ip", "203.0.113.10");
  return new Request(`${baseURL}${path}`, { ...options, headers });
}

test("requires a high-entropy authentication secret", async () => {
  const env = await testEnv();
  env.BETTER_AUTH_SECRET = "too-short";
  assert.throws(() => createAuth(env, request("/")), /AUTH_NOT_CONFIGURED/);
});

test("creates a D1-backed account, profile and 24 hour session", async () => {
  const env = await testEnv();
  const auth = createAuth(env, request("/api/auth/sign-up/email"));
  const response = await auth.handler(request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "correct horse battery staple",
    }),
  }));

  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /standup_helper\.session_token=/);
  assert.match(cookie, /Max-Age=86400/);
  assert.equal(SESSION_TTL_SECONDS, 86_400);

  const [profile] = env.DB.query(
    "SELECT display_name FROM user_profiles WHERE user_id = (SELECT id FROM user WHERE email = ?)",
    "ada@example.com",
  );
  assert.deepEqual(profile, { display_name: "Ada Lovelace" });
  assert.ok(env.DB.query('SELECT COUNT(*) AS count FROM "rateLimit"')[0].count > 0);

  const cookieHeader = cookie.split(";")[0];
  const session = await getAuthSession(request("/admin", {
    headers: { Cookie: cookieHeader },
  }), env);
  assert.equal(session.user.email, "ada@example.com");
});

test("rejects short passwords", async () => {
  const env = await testEnv();
  const auth = createAuth(env, request("/api/auth/sign-up/email"));
  const response = await auth.handler(request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Ada", email: "ada@example.com", password: "too-short" }),
  }));

  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "PASSWORD_TOO_SHORT");
});
