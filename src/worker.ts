import { Hono } from "hono";
import { AppError, publicStatusForError } from "./errors.ts";
import {
  createAuth,
  getAuthSession,
  requireAuthSession,
} from "./auth.ts";
import type { Env } from "./env.ts";
import { requestOpenRouterTask } from "./openrouter.ts";
import {
  archiveRoom,
  createRoom,
  getRoom,
  joinRoom,
  listRooms,
  removeRoomMember,
  updateMemberRole,
  updateRoom,
} from "./rooms.ts";

type AppContext = { Bindings: Env };

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function withSecurityHeaders(response: Response, request: Request) {
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

function sendJson(status: number, payload: unknown, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function sendApiError(error: unknown, requestId: string, extraHeaders: Record<string, string> = {}) {
  const safeError = error instanceof AppError
    ? error
    : new AppError("INTERNAL_SERVER_ERROR", 500);
  const payload: { code: string; requestId: string; retryAfterSeconds?: number } = {
    code: safeError.code,
    requestId,
  };
  if (safeError.retryAfterSeconds) payload.retryAfterSeconds = safeError.retryAfterSeconds;
  return sendJson(publicStatusForError(safeError), payload, extraHeaders);
}

async function readJson(request: Request, maximumBytes = 16_384): Promise<Record<string, unknown>> {
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
    const value: unknown = JSON.parse(new TextDecoder().decode(body) || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new AppError("INVALID_JSON", 400);
    }
    return value as Record<string, unknown>;
  } catch {
    throw new AppError("INVALID_JSON", 400);
  }
}

function requireMethod(request: Request, method: string) {
  if (request.method !== method) {
    const error = new AppError("METHOD_NOT_ALLOWED", 405);
    error.allowedMethod = method;
    throw error;
  }
}

async function sessionState(request: Request, env: Env) {
  try {
    const session = await getAuthSession(request, env);
    return {
      authenticated: Boolean(session),
      configured: true,
      user: session?.user || null,
    };
  } catch (error) {
    if (error instanceof AppError && error.code === "AUTH_NOT_CONFIGURED") {
      return { authenticated: false, configured: false, user: null };
    }
    throw error;
  }
}

async function handleTask(request: Request, env: Env) {
  requireMethod(request, "POST");
  await requireAuthSession(request, env);

  const body = await readJson(request);
  if (body.kind !== "current" && body.kind !== "next") {
    throw new AppError("INVALID_TASK_KIND", 400);
  }
  if (body.recentTasks !== undefined && !Array.isArray(body.recentTasks)) {
    throw new AppError("INVALID_RECENT_TASKS", 400);
  }

  const recentTasks = ((body.recentTasks || []) as unknown[])
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

async function handleListRooms(request: Request, env: Env) {
  const session = await requireAuthSession(request, env);
  return sendJson(200, { rooms: await listRooms(env, session.user.id) });
}

async function handleCreateRoom(request: Request, env: Env) {
  const session = await requireAuthSession(request, env);
  const room = await createRoom(env, session.user, await readJson(request, 4_096));
  return sendJson(201, { room });
}

async function handleJoinRoom(request: Request, env: Env) {
  const session = await requireAuthSession(request, env);
  const room = await joinRoom(env, session.user, await readJson(request, 2_048));
  return sendJson(200, { room });
}

async function handleGetRoom(request: Request, env: Env, roomId: string) {
  const session = await requireAuthSession(request, env);
  return sendJson(200, { room: await getRoom(env, roomId, session.user.id) });
}

async function handleUpdateRoom(request: Request, env: Env, roomId: string) {
  const session = await requireAuthSession(request, env);
  const room = await updateRoom(env, roomId, session.user.id, await readJson(request, 4_096));
  return sendJson(200, { room });
}

async function handleUpdateMemberRole(
  request: Request,
  env: Env,
  roomId: string,
  memberId: string,
) {
  const session = await requireAuthSession(request, env);
  const room = await updateMemberRole(
    env,
    roomId,
    session.user.id,
    memberId,
    await readJson(request, 2_048),
  );
  return sendJson(200, { room });
}

async function handleRemoveRoomMember(
  request: Request,
  env: Env,
  roomId: string,
  memberId: string,
) {
  const session = await requireAuthSession(request, env);
  return sendJson(200, await removeRoomMember(env, roomId, session.user.id, memberId));
}

async function handleArchiveRoom(request: Request, env: Env, roomId: string) {
  const session = await requireAuthSession(request, env);
  return sendJson(200, await archiveRoom(env, roomId, session.user.id));
}

async function assetResponse(env: Env, request: Request, pathname: string) {
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

async function handlePage(request: Request, env: Env, pathname: string) {
  if (!["GET", "HEAD"].includes(request.method)) throw new AppError("METHOD_NOT_ALLOWED", 405);

  if (["/", "/login.html"].includes(pathname)) {
    const session = await sessionState(request, env);
    if (session.authenticated) return Response.redirect(new URL("/dashboard", request.url).toString(), 302);
    return assetResponse(env, request, "/login.html");
  }

  if (["/dashboard", "/dashboard/", "/dashboard.html"].includes(pathname)) {
    const session = await sessionState(request, env);
    if (!session.authenticated) return Response.redirect(new URL("/", request.url).toString(), 302);
    return assetResponse(env, request, "/dashboard.html");
  }

  if (["/admin", "/admin/", "/admin.html"].includes(pathname)) {
    const session = await sessionState(request, env);
    if (!session.authenticated) return Response.redirect(new URL("/", request.url).toString(), 302);
    return assetResponse(env, request, "/admin.html");
  }

  if (/^\/rooms\/[0-9a-f-]{36}\/?$/i.test(pathname)) {
    const session = await sessionState(request, env);
    if (!session.authenticated) return Response.redirect(new URL("/", request.url).toString(), 302);
    return assetResponse(env, request, "/room.html");
  }

  if (pathname === "/room.html") {
    const session = await sessionState(request, env);
    return Response.redirect(new URL(session.authenticated ? "/dashboard" : "/", request.url).toString(), 302);
  }

  return assetResponse(env, request, pathname);
}

function methodNotAllowed(method: string): never {
  const error = new AppError("METHOD_NOT_ALLOWED", 405);
  error.allowedMethod = method;
  throw error;
}

const app = new Hono<AppContext>();

app.all("/api/auth/*", (context) => (
  createAuth(context.env, context.req.raw).handler(context.req.raw)
));

app.get("/api/rooms", (context) => handleListRooms(context.req.raw, context.env));
app.post("/api/rooms", (context) => handleCreateRoom(context.req.raw, context.env));
app.all("/api/rooms", () => methodNotAllowed("GET, POST"));

app.post("/api/rooms/join", (context) => handleJoinRoom(context.req.raw, context.env));
app.all("/api/rooms/join", () => methodNotAllowed("POST"));

app.patch("/api/rooms/:roomId/members/:memberId", (context) => handleUpdateMemberRole(
  context.req.raw,
  context.env,
  context.req.param("roomId"),
  context.req.param("memberId"),
));
app.delete("/api/rooms/:roomId/members/:memberId", (context) => handleRemoveRoomMember(
  context.req.raw,
  context.env,
  context.req.param("roomId"),
  context.req.param("memberId"),
));
app.all("/api/rooms/:roomId/members/:memberId", () => methodNotAllowed("PATCH, DELETE"));

app.post("/api/rooms/:roomId/archive", (context) => handleArchiveRoom(
  context.req.raw,
  context.env,
  context.req.param("roomId"),
));
app.all("/api/rooms/:roomId/archive", () => methodNotAllowed("POST"));

app.get("/api/rooms/:roomId", (context) => handleGetRoom(
  context.req.raw,
  context.env,
  context.req.param("roomId"),
));
app.patch("/api/rooms/:roomId", (context) => handleUpdateRoom(
  context.req.raw,
  context.env,
  context.req.param("roomId"),
));
app.all("/api/rooms/:roomId", () => methodNotAllowed("GET, PATCH"));

app.post("/api/task", (context) => handleTask(context.req.raw, context.env));
app.all("/api/task", () => methodNotAllowed("POST"));

app.all("/api/*", () => {
  throw new AppError("NOT_FOUND", 404);
});

app.all("*", (context) => handlePage(
  context.req.raw,
  context.env,
  new URL(context.req.url).pathname,
));

app.onError((error) => {
  const requestId = crypto.randomUUID();
  if (!(error instanceof AppError)) {
    console.error(`[${requestId}] Unexpected Worker error`, error);
  }
  const headers: Record<string, string> = {};
  if (error instanceof AppError && error.allowedMethod) headers.Allow = error.allowedMethod;
  return sendApiError(error, requestId, headers);
});

export default {
  async fetch(request: Request, env: Env, executionContext: ExecutionContext): Promise<Response> {
    return withSecurityHeaders(await app.fetch(request, env, executionContext), request);
  },
} satisfies ExportedHandler<Env>;
