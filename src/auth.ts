import { betterAuth } from "better-auth";
import { AppError } from "./errors.ts";
import type { Env } from "./env.ts";

export const SESSION_TTL_SECONDS = 24 * 60 * 60;

function isLocalOrigin(origin: string) {
  const hostname = new URL(origin).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function authSecret(env: Env) {
  // SESSION_SECRET keeps existing environments compatible until the dedicated
  // Better Auth secret is configured everywhere.
  const secret = String(env.BETTER_AUTH_SECRET || env.SESSION_SECRET || "");
  if (secret.length < 32) throw new AppError("AUTH_NOT_CONFIGURED", 503);
  return secret;
}

function authBaseURL(request: Request, env: Env) {
  const requestOrigin = new URL(request.url).origin;
  if (isLocalOrigin(requestOrigin)) return requestOrigin;
  return String(env.BETTER_AUTH_URL || env.PUBLIC_APP_URL || requestOrigin).replace(/\/$/, "");
}

export function createAuth(env: Env, request: Request) {
  const baseURL = authBaseURL(request, env);

  return betterAuth({
    appName: "Standup Helper",
    database: env.DB,
    secret: authSecret(env),
    baseURL,
    trustedOrigins: [baseURL],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    session: {
      expiresIn: SESSION_TTL_SECONDS,
      updateAge: 60 * 60,
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      storage: "database",
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
      },
    },
    advanced: {
      cookiePrefix: "standup_helper",
      useSecureCookies: !isLocalOrigin(baseURL),
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
    },
  });
}

export async function getAuthSession(request: Request, env: Env) {
  return createAuth(env, request).api.getSession({
    headers: request.headers,
  });
}

export async function requireAuthSession(request: Request, env: Env) {
  const session = await getAuthSession(request, env);
  if (!session) throw new AppError("AUTH_REQUIRED", 401);
  return session;
}
