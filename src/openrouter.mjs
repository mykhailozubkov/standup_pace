import { AppError, mapNetworkError, mapOpenRouterError } from "./errors.mjs";

const DEFAULT_MODEL = "dots-studio/dots-3-note-preview:free";

function retryAfterSeconds(value) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(1, Math.min(3600, Math.ceil(seconds)));
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return undefined;
  return Math.max(1, Math.min(3600, Math.ceil((date - Date.now()) / 1000)));
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

export async function requestOpenRouterTask(env, kind, recentTasks, appOrigin, fetchImpl = fetch) {
  const apiKey = String(env.OPENROUTER_API_KEY || "").trim();
  const model = String(env.OPENROUTER_MODEL || "").trim() || DEFAULT_MODEL;
  if (!apiKey) throw new AppError("OPENROUTER_NOT_CONFIGURED", 503);

  const maxAttempts = 3;
  let lastError = new AppError("INVALID_MODEL_RESPONSE", 502, { retryable: true });

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": String(env.PUBLIC_APP_URL || appOrigin),
          "X-OpenRouter-Title": "Standup Helper",
        },
        body: JSON.stringify({
          model,
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
        payload = await response.json();
      } catch {
        lastError = new AppError("OPENROUTER_INVALID_RESPONSE", 502, { retryable: true });
        if (attempt < maxAttempts) continue;
        throw lastError;
      }

      if (!response.ok) {
        lastError = mapOpenRouterError(response.status, payload.error?.message);
        lastError.retryAfterSeconds = retryAfterSeconds(response.headers.get("retry-after"));
        if (lastError.retryable && attempt < maxAttempts) continue;
        throw lastError;
      }

      const choice = payload.choices?.[0];
      if (choice?.message?.refusal || ["content_filter", "safety"].includes(choice?.finish_reason)) {
        throw new AppError("OPENROUTER_CONTENT_BLOCKED", 403);
      }

      try {
        return { ...parseGeneratedTask(choice?.message?.content), model: payload.model || model };
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
