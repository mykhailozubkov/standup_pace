import { AppError } from "./errors.mjs";

export const SESSION_TTL_SECONDS = 24 * 60 * 60;
export const SESSION_COOKIE_NAME = "standup_helper_session";

const encoder = new TextEncoder();

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function stringToBase64Url(value) {
  return bytesToBase64Url(encoder.encode(value));
}

function base64UrlToString(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function constantTimeTextEqual(left, right) {
  const [leftHash, rightHash] = await Promise.all([sha256(left), sha256(right)]);
  let difference = 0;
  for (let index = 0; index < leftHash.length; index += 1) {
    difference |= leftHash[index] ^ rightHash[index];
  }
  return difference === 0;
}

function requireAuthConfiguration(env) {
  const username = String(env.ADMIN_USERNAME || "").trim();
  const password = String(env.ADMIN_PASSWORD || "");
  const sessionSecret = String(env.SESSION_SECRET || "");
  if (!username || password.length < 12 || sessionSecret.length < 32) {
    throw new AppError("AUTH_NOT_CONFIGURED", 503);
  }
  return { username, password, sessionSecret };
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    const key = item.slice(0, separator).trim();
    if (key === name) return item.slice(separator + 1).trim();
  }
  return "";
}

export async function verifyAdminCredentials(env, username, password) {
  const configured = requireAuthConfiguration(env);
  const safeUsername = typeof username === "string" ? username.trim() : "";
  const safePassword = typeof password === "string" ? password : "";
  if (safeUsername.length > 128 || safePassword.length > 512) return false;

  const [usernameMatches, passwordMatches] = await Promise.all([
    constantTimeTextEqual(safeUsername, configured.username),
    constantTimeTextEqual(safePassword, configured.password),
  ]);
  return usernameMatches && passwordMatches;
}

export async function createSessionToken(env, now = Date.now()) {
  const { username, sessionSecret } = requireAuthConfiguration(env);
  const payload = stringToBase64Url(JSON.stringify({
    version: 1,
    subject: username,
    expiresAt: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
  }));
  return `${payload}.${await sign(payload, sessionSecret)}`;
}

export async function hasValidSession(request, env, now = Date.now()) {
  try {
    const { username, sessionSecret } = requireAuthConfiguration(env);
    const token = readCookie(request, SESSION_COOKIE_NAME);
    if (!token || token.length > 2048) return false;

    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [payload, providedSignature] = parts;
    const expectedSignature = await sign(payload, sessionSecret);
    if (!(await constantTimeTextEqual(providedSignature, expectedSignature))) return false;

    const session = JSON.parse(base64UrlToString(payload));
    return session.version === 1
      && session.subject === username
      && Number.isInteger(session.expiresAt)
      && session.expiresAt > Math.floor(now / 1000);
  } catch (error) {
    if (error instanceof AppError) throw error;
    return false;
  }
}

function isSecureRequest(request) {
  const url = new URL(request.url);
  return url.protocol === "https:" && !["localhost", "127.0.0.1"].includes(url.hostname);
}

export function sessionCookie(token, request) {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

export function expiredSessionCookie(request) {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}

export function requireValidSession(valid) {
  if (!valid) throw new AppError("AUTH_REQUIRED", 401);
}
