import test from "node:test";
import assert from "node:assert/strict";
import { AppError, mapNetworkError, mapOpenRouterError, publicStatusForError } from "../src/errors.ts";

const openRouterCases = [
  [400, "OPENROUTER_BAD_REQUEST", false],
  [401, "OPENROUTER_AUTH_ERROR", false],
  [402, "OPENROUTER_PAYMENT_REQUIRED", false],
  [403, "OPENROUTER_FORBIDDEN", false],
  [404, "OPENROUTER_MODEL_NOT_FOUND", false],
  [408, "OPENROUTER_TIMEOUT", true],
  [413, "OPENROUTER_PAYLOAD_TOO_LARGE", false],
  [422, "OPENROUTER_UNPROCESSABLE_REQUEST", false],
  [429, "OPENROUTER_RATE_LIMIT", false],
  [500, "OPENROUTER_INTERNAL_ERROR", true],
  [502, "OPENROUTER_PROVIDER_ERROR", true],
  [503, "OPENROUTER_UNAVAILABLE", true],
  [504, "OPENROUTER_GATEWAY_TIMEOUT", true],
  [524, "OPENROUTER_GATEWAY_TIMEOUT", true],
  [529, "OPENROUTER_PROVIDER_OVERLOADED", true],
];

test("maps documented OpenRouter statuses", () => {
  for (const [status, code, retryable] of openRouterCases) {
    const error = mapOpenRouterError(status);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    assert.equal(error.retryable, retryable);
  }
});

test("distinguishes content blocks from a generic forbidden response", () => {
  assert.equal(mapOpenRouterError(403, "Request blocked by content filter").code, "OPENROUTER_CONTENT_BLOCKED");
  assert.equal(mapOpenRouterError(403, "Workspace policy denied access").code, "OPENROUTER_FORBIDDEN");
});

test("maps network and timeout failures", () => {
  assert.equal(mapNetworkError({ name: "AbortError" }).code, "OPENROUTER_TIMEOUT");
  assert.equal(mapNetworkError({ cause: { code: "ENOTFOUND" } }).code, "OPENROUTER_DNS_ERROR");
  assert.equal(mapNetworkError({ cause: { code: "EACCES" } }).code, "OPENROUTER_NETWORK_BLOCKED");
  assert.equal(mapNetworkError({ cause: { code: "ECONNRESET" } }).code, "OPENROUTER_NETWORK_ERROR");
});

test("keeps public statuses safe", () => {
  assert.equal(publicStatusForError(new AppError("INVALID_JSON", 400)), 400);
  assert.equal(publicStatusForError(new Error("secret internal details")), 500);
});

test("uses safe fallbacks for undocumented statuses", () => {
  assert.equal(mapOpenRouterError(418).code, "OPENROUTER_BAD_REQUEST");
  assert.equal(mapOpenRouterError(530).code, "OPENROUTER_UNAVAILABLE");
});
