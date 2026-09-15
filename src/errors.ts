interface AppErrorOptions extends ErrorOptions {
  retryable?: boolean;
}

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  retryAfterSeconds?: number;
  allowedMethod?: string;

  constructor(code: string, status = 500, options: AppErrorOptions = {}) {
    super(code, options);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.retryable = options.retryable === true;
  }
}

export function mapOpenRouterError(status: number, message = "") {
  const normalizedMessage = String(message).toLowerCase();
  const contentBlocked = /guardrail|content.?filter|moderation|unsafe|blocked/.test(normalizedMessage);
  const mappings: Record<number, readonly [string, boolean]> = {
    400: ["OPENROUTER_BAD_REQUEST", false],
    401: ["OPENROUTER_AUTH_ERROR", false],
    402: ["OPENROUTER_PAYMENT_REQUIRED", false],
    403: [contentBlocked ? "OPENROUTER_CONTENT_BLOCKED" : "OPENROUTER_FORBIDDEN", false],
    404: ["OPENROUTER_MODEL_NOT_FOUND", false],
    408: ["OPENROUTER_TIMEOUT", true],
    413: ["OPENROUTER_PAYLOAD_TOO_LARGE", false],
    422: ["OPENROUTER_UNPROCESSABLE_REQUEST", false],
    429: ["OPENROUTER_RATE_LIMIT", false],
    500: ["OPENROUTER_INTERNAL_ERROR", true],
    502: ["OPENROUTER_PROVIDER_ERROR", true],
    503: ["OPENROUTER_UNAVAILABLE", true],
    504: ["OPENROUTER_GATEWAY_TIMEOUT", true],
    524: ["OPENROUTER_GATEWAY_TIMEOUT", true],
    529: ["OPENROUTER_PROVIDER_OVERLOADED", true],
  };
  const [code, retryable] = mappings[status]
    || (status >= 500
      ? ["OPENROUTER_UNAVAILABLE", true]
      : status >= 400
        ? ["OPENROUTER_BAD_REQUEST", false]
        : ["OPENROUTER_ERROR", false]);
  return new AppError(code, status >= 400 && status <= 599 ? status : 502, { retryable });
}

export function mapNetworkError(error: unknown) {
  const candidate = error && typeof error === "object"
    ? error as { name?: string; code?: string; cause?: { code?: string } }
    : {};
  if (candidate.name === "AbortError") {
    return new AppError("OPENROUTER_TIMEOUT", 504, { retryable: true });
  }

  const causeCode = candidate.cause?.code || candidate.code || "";
  if (["ENOTFOUND", "EAI_AGAIN"].includes(causeCode)) {
    return new AppError("OPENROUTER_DNS_ERROR", 502, { retryable: true });
  }
  if (["EACCES", "EPERM"].includes(causeCode)) {
    return new AppError("OPENROUTER_NETWORK_BLOCKED", 502, { retryable: false });
  }
  if (["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT"].includes(causeCode)) {
    return new AppError("OPENROUTER_TIMEOUT", 504, { retryable: true });
  }
  return new AppError("OPENROUTER_NETWORK_ERROR", 502, { retryable: true });
}

export function publicStatusForError(error: unknown) {
  if (error instanceof AppError && Number.isInteger(error.status)) return error.status;
  return 500;
}
