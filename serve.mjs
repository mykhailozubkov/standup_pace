import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { AppError, mapNetworkError, mapOpenRouterError, publicStatusForError } from "./errors.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.MEET_PACE_PORT) || 4173;
const openRouterApiKey = process.env.OPENROUTER_API_KEY?.trim();
const openRouterModel = process.env.OPENROUTER_MODEL?.trim() || "dots-studio/dots-3-note-preview:free";
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function retryAfterSeconds(value) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(1, Math.min(3600, Math.ceil(seconds)));
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return undefined;
  return Math.max(1, Math.min(3600, Math.ceil((date - Date.now()) / 1000)));
}

function sendApiError(response, error, requestId) {
  const safeError = error instanceof AppError
    ? error
    : new AppError("INTERNAL_SERVER_ERROR", 500);
  const payload = { code: safeError.code, requestId };
  if (safeError.retryAfterSeconds) payload.retryAfterSeconds = safeError.retryAfterSeconds;
  sendJson(response, publicStatusForError(safeError), payload);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) throw new AppError("REQUEST_TOO_LARGE", 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new AppError("INVALID_JSON", 400);
  }
}

function taskPrompt(kind, recentTasks) {
  const recent = recentTasks.length
    ? recentTasks.map((task, index) => `${index + 1}. ${task}`).join("\n")
    : "No recent tasks.";
  const request = kind === "current"
    ? "Create one light spontaneous task that a participant can complete during the current team call in under 90 seconds."
    : "Create one original preparation task that a participant can complete before the next team call and present in one or two minutes.";

  return `${request}
Make it friendly, concrete, playful, and suitable for a mixed workplace team.
Do not require spending money, revealing sensitive information, contacting strangers, or doing anything unsafe, political, romantic, medical, or humiliating.
Avoid repeating or closely paraphrasing these recent tasks:
${recent}
Return the same task in natural English and Russian.`;
}

function parseGeneratedTask(content) {
  const normalized = typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((part) => part?.text || "").join("")
      : "";
  const cleaned = normalized.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const objectStart = cleaned.indexOf("{");
  const objectEnd = cleaned.lastIndexOf("}");
  const json = objectStart >= 0 && objectEnd > objectStart
    ? cleaned.slice(objectStart, objectEnd + 1)
    : cleaned;
  const parsed = JSON.parse(json);
  const taskEn = String(parsed.task_en || parsed.taskEn || parsed.en || parsed.english || "").trim();
  const taskRu = String(parsed.task_ru || parsed.taskRu || parsed.ru || parsed.russian || "").trim();
  if (!taskEn || !taskRu || taskEn.length > 240 || taskRu.length > 240) {
    throw new Error("The model returned an invalid task");
  }
  return { taskEn, taskRu };
}

async function requestOpenRouterTask(kind, recentTasks) {
  const maxAttempts = 3;
  let lastError = new AppError("INVALID_MODEL_RESPONSE", 502, { retryable: true });

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Authorization": `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": `http://localhost:${port}`,
          "X-OpenRouter-Title": "Standup Pace",
        },
        body: JSON.stringify({
          model: openRouterModel,
          temperature: 0.95,
          max_tokens: 500,
          reasoning: { effort: "none", exclude: true },
          messages: [
            {
              role: "system",
              content: "You generate concise facilitation tasks for informal team calls. Respond only with valid JSON matching the requested schema.",
            },
            { role: "user", content: taskPrompt(kind, recentTasks) },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "generated_team_task",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  task_en: { type: "string", description: "One concise sentence in English" },
                  task_ru: { type: "string", description: "The same task in natural Russian" },
                },
                required: ["task_en", "task_ru"],
                additionalProperties: false,
              },
            },
          },
        }),
      });

      let payload;
      try {
        payload = await openRouterResponse.json();
      } catch {
        lastError = new AppError("OPENROUTER_INVALID_RESPONSE", 502, { retryable: true });
        if (attempt < maxAttempts) continue;
        throw lastError;
      }

      if (!openRouterResponse.ok) {
        lastError = mapOpenRouterError(openRouterResponse.status, payload.error?.message);
        lastError.retryAfterSeconds = retryAfterSeconds(openRouterResponse.headers.get("retry-after"));
        if (lastError.retryable && attempt < maxAttempts) continue;
        throw lastError;
      }

      const choice = payload.choices?.[0];
      if (choice?.message?.refusal || ["content_filter", "safety"].includes(choice?.finish_reason)) {
        throw new AppError("OPENROUTER_CONTENT_BLOCKED", 403);
      }

      try {
        const generated = parseGeneratedTask(choice?.message?.content);
        return { ...generated, model: payload.model || openRouterModel };
      } catch {
        lastError = new AppError("INVALID_MODEL_RESPONSE", 502, { retryable: true });
        if (attempt === maxAttempts) throw lastError;
      }
    } catch (error) {
      lastError = error instanceof AppError ? error : mapNetworkError(error);
      if (lastError.retryable && attempt < maxAttempts) continue;
      throw lastError;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

async function generateTask(request, response, requestId) {
  try {
    if (!openRouterApiKey) throw new AppError("OPENROUTER_NOT_CONFIGURED", 503);
    if (!request.headers["content-type"]?.toLowerCase().includes("application/json")) {
      throw new AppError("UNSUPPORTED_MEDIA_TYPE", 415);
    }

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

    const generated = await requestOpenRouterTask(body.kind, recentTasks);
    sendJson(response, 200, generated);
  } catch (error) {
    if (!(error instanceof AppError)) console.error(`[${requestId}] Unexpected task API error`, error);
    sendApiError(response, error, requestId);
  }
}

createServer(async (request, response) => {
  const requestId = randomUUID();
  let pathname = "/";
  try {
    try {
      pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host || "localhost"}`).pathname);
    } catch {
      throw new AppError("INVALID_URL", 400);
    }
    if (pathname === "/api/task") {
      if (request.method !== "POST") {
        response.setHeader("Allow", "POST");
        sendApiError(response, new AppError("METHOD_NOT_ALLOWED", 405), requestId);
        return;
      }
      await generateTask(request, response, requestId);
      return;
    }
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = normalize(join(root, relativePath));
    if (!filePath.startsWith(normalize(root))) throw new AppError("FORBIDDEN_PATH", 403);
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Not a file");
    response.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream" });
    response.end(await readFile(filePath));
  } catch (error) {
    if (pathname === "/api/task" || error instanceof AppError) {
      if (!(error instanceof AppError)) console.error(`[${requestId}] Unexpected server error`, error);
      sendApiError(response, error, requestId);
      return;
    }
    const notFound = ["ENOENT", "ENOTDIR"].includes(error?.code) || error?.message === "Not a file";
    if (!notFound) console.error(`[${requestId}] Static file error`, error);
    response.writeHead(notFound ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(notFound ? "Not found" : `Internal server error (${requestId})`);
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Meet Pace: http://localhost:${port}`);
  console.log(openRouterApiKey
    ? `OpenRouter task generation: ready (${openRouterModel})`
    : "OpenRouter task generation: disabled — set OPENROUTER_API_KEY");
});
