import type { JSONResult } from "./types/AIResponse";
import { AIJSONParseError } from "./types/AIResponse";
import { JSON_MODE_INSTRUCTION } from "./JSONMode";
import { aiAnalytics } from "./AIAnalytics";

/** Anything that can produce structured JSON — AIProvider or AIClient. */
export type JSONCapable = {
  json<T>(params: import("./types/AIResponse").ChatParams): Promise<JSONResult<T>>;
};

export type RetryOptions = {
  maxAttempts?: number;
  retrySystemHint?: string;
  onRetry?: (attempt: number, error: unknown) => void;
};

const DEFAULT_RETRY_HINT = `Your previous response was not valid JSON. Please try again.

${JSON_MODE_INSTRUCTION}`;

/**
 * Phase 5 — Retry Engine.
 *
 * Models occasionally reply with:
 *   Sure! Here's your JSON: { ... }
 * which breaks parsing. Retry logic: attempt → parse → failed →
 * re-ask with a hint → return valid JSON. The user never notices.
 */
export async function jsonWithRetry<T>(
  provider: JSONCapable,
  params: Parameters<JSONCapable["json"]>[0],
  options?: RetryOptions
): Promise<JSONResult<T>> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const hint = options?.retrySystemHint ?? DEFAULT_RETRY_HINT;

  let lastError: unknown;
  let currentParams = params;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await provider.json<T>(currentParams);
    } catch (e) {
      lastError = e;
      options?.onRetry?.(attempt, e);

      if (attempt >= maxAttempts) break;
      if (!(e instanceof AIJSONParseError)) break;

      aiAnalytics.recordParseFailure();
      aiAnalytics.recordRetry();

      currentParams = {
        ...currentParams,
        messages: [
          ...currentParams.messages,
          {
            role: "assistant",
            content: e.raw.slice(0, 500),
          },
          {
            role: "user",
            content: hint,
          },
        ],
      };
    }
  }

  throw lastError;
}

export async function chatWithRetry<T>(
  provider: JSONCapable,
  params: Parameters<JSONCapable["json"]>[0],
  options?: RetryOptions
): Promise<JSONResult<T>> {
  return jsonWithRetry<T>(provider, params, options);
}