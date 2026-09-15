import { AppError, publicStatusForError } from "./errors.mjs";
import {
  createSessionToken,
  expiredSessionCookie,
  hasValidSession,
  requireValidSession,
  sessionCookie,
  verifyAdminCredentials,
} from "./auth.mjs";
import { requestOpenRouterTask } from "./openrouter.mjs";

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function withSecurityHeaders(response, request) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  if (new URL(request.url).protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function sendJson(status, payload, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function sendApiError(error, requestId, extraHeaders = {}) {
  const safeError = error instanceof AppError
    ? error
    : new AppError("INTERNAL_SERVER_ERROR", 500);
  const payload = { code: safeError.code, requestId };
  if (safeError.retryAfterSeconds) payload.retryAfterSeconds = safeError.retryAfterSeconds;
  return sendJson(publicStatusForError(safeError), payload, extraHeaders);
}

async function readJson(request, maximumBytes = 16_384) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new AppError("UNSUPPORTED_MEDIA_TYPE", 415);
  }

  const declaredSize = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declaredSize) && declaredSize > maximumBytes) {
    throw new AppError("REQUEST_TOO_LARGE", 413);
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > maximumBytes) throw new AppError("REQUEST_TOO_LARGE", 413);
  try {
    return JSON.parse(new TextDecoder().decode(body) || "{}");
  } catch {
    throw new AppError("INVALID_JSON", 400);
  }
}

function requireMethod(request, method) {
  if (request.method !== method) {
    const error = new AppError("METHOD_NOT_ALLOWED", 405);
    error.allowedMethod = method;
    throw error;
  }
}

async function sessionState(request, env) {
  try {
    return { authenticated: await hasValidSession(request, env), configured: true };
  } catch (error) {
    if (error instanceof AppError && error.code === "AUTH_NOT_CONFIGURED") {
      return { authenticated: false, configured: false };
    }
    throw error;
  }
}

async function handleLogin(request, env) {
  requireMethod(request, "POST");
  const body = await readJson(request, 2_048);
  if (!body || typeof body !== "object") throw new AppError("INVALID_JSON", 400);
  const valid = await verifyAdminCredentials(env, body.username, body.password);
  if (!valid) throw new AppError("INVALID_CREDENTIALS", 401);

  const token = await createSessionToken(env);
  return sendJson(200, { authenticated: true }, {
    "Set-Cookie": sessionCookie(token, request),
  });
}

async function handleLogout(request) {
  requireMethod(request, "POST");
  return sendJson(200, { authenticated: false }, {
    "Set-Cookie": expiredSessionCookie(request),
  });
}

async function handleTask(request, env) {
  requireMethod(request, "POST");
  requireValidSession(await hasValidSession(request, env));

  const body = await readJson(request);
  if (!body || typeof body !== "object" || !["current", "next"].includes(body.kind)) {
    throw new AppError("INVALID_TASK_KIND", 400);
  }
  if (body.recentTasks !== undefined && !Array.isArray(body.recentTasks)) {
    throw new AppError("INVALID_RECENT_TASKS", 400);
  }

  const recentTasks = (body.recentTasks || [])
    .slice(0, 12)
    .map((task) => String(task).trim().slice(0, 240))
    .filter(Boolean);
  return sendJson(200, await requestOpenRouterTask(
    env,
    body.kind,
    recentTasks,
    new URL(request.url).origin,
  ));
}

async function assetResponse(env, request, pathname) {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = pathname;
  assetUrl.search = "";
  const assetRequest = new Request(assetUrl, request);
  const response = await env.ASSETS.fetch(assetRequest);
  if (pathname.endsWith(".html")) {
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, headers });
  }
  return response;
}

async function handlePage(request, env, pathname) {
  if (!["GET", "HEAD"].includes(request.method)) throw new AppError("METHOD_NOT_ALLOWED", 405);

  if (["/", "/login.html"].includes(pathname)) {
    const session = await sessionState(request, env);
    if (session.authenticated) return Response.redirect(new URL("/admin", request.url), 302);
    return assetResponse(env, request, "/login.html");
  }

  if (["/admin", "/admin/", "/admin.html"].includes(pathname)) {
    const session = await sessionState(request, env);
    if (!session.authenticated) return Response.redirect(new URL("/", request.url), 302);
    return assetResponse(env, request, "/admin.html");
  }

  return assetResponse(env, request, pathname);
}

export default {
  async fetch(request, env) {
    const requestId = crypto.randomUUID();
    let pathname = "/";
    try {
      pathname = new URL(request.url).pathname;

      if (pathname === "/api/auth/session") {
        requireMethod(request, "GET");
        return withSecurityHeaders(sendJson(200, await sessionState(request, env)), request);
      }
      if (pathname === "/api/auth/login") {
        return withSecurityHeaders(await handleLogin(request, env), request);
      }
      if (pathname === "/api/auth/logout") {
        return withSecurityHeaders(await handleLogout(request), request);
      }
      if (pathname === "/api/task") {
        return withSecurityHeaders(await handleTask(request, env), request);
      }
      if (pathname.startsWith("/api/")) throw new AppError("NOT_FOUND", 404);

      return withSecurityHeaders(await handlePage(request, env, pathname), request);
    } catch (error) {
      if (!(error instanceof AppError)) {
        console.error(`[${requestId}] Unexpected Worker error`, error);
      }
      const headers = {};
      if (error instanceof AppError && error.allowedMethod) headers.Allow = error.allowedMethod;
      return withSecurityHeaders(sendApiError(error, requestId, headers), request);
    }
  },
};
