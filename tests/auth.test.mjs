import test from "node:test";
import assert from "node:assert/strict";
import {
  createSessionToken,
  expiredSessionCookie,
  hasValidSession,
  SESSION_TTL_SECONDS,
  sessionCookie,
  verifyAdminCredentials,
} from "../src/auth.ts";

const env = {
  ADMIN_USERNAME: "facilitator",
  ADMIN_PASSWORD: "correct horse battery staple",
  SESSION_SECRET: "a-test-session-secret-that-is-longer-than-32-characters",
};

test("validates both parts of the administrator credentials", async () => {
  assert.equal(await verifyAdminCredentials(env, "facilitator", "correct horse battery staple"), true);
  assert.equal(await verifyAdminCredentials(env, "other", "correct horse battery staple"), false);
  assert.equal(await verifyAdminCredentials(env, "facilitator", "wrong password"), false);
});

test("creates a session that expires after 24 hours", async () => {
  const now = Date.UTC(2026, 8, 11, 12, 0, 0);
  const token = await createSessionToken(env, now);
  const request = new Request("http://localhost/admin", {
    headers: { Cookie: sessionCookie(token, new Request("http://localhost/")) },
  });

  assert.equal(await hasValidSession(request, env, now + 1_000), true);
  assert.equal(await hasValidSession(request, env, now + SESSION_TTL_SECONDS * 1_000 + 1), false);
});

test("rejects a modified session token", async () => {
  const token = await createSessionToken(env);
  const request = new Request("https://standup-helper.example/admin", {
    headers: { Cookie: `standup_helper_session=${token.slice(0, -1)}x` },
  });
  assert.equal(await hasValidSession(request, env), false);
});

test("uses secure production cookies and clears sessions", async () => {
  const token = await createSessionToken(env);
  const productionRequest = new Request("https://standup-helper.example/");
  assert.match(sessionCookie(token, productionRequest), /HttpOnly/);
  assert.match(sessionCookie(token, productionRequest), /Secure/);
  assert.match(sessionCookie(token, productionRequest), /Max-Age=86400/);
  assert.match(expiredSessionCookie(productionRequest), /Max-Age=0/);
});
