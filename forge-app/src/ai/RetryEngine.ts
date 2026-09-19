import type { JSONResult } from "./types/AIResponse";
import { AIJSONParseError, AIProviderError } from "./types/AIResponse";
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

function isRetryableError(e: unknown): boolean {
  if (e instanceof AIJSONParseError) return true;
  if (e instanceof AIProviderError) {
    const msg = e.message.toLowerCase();
    return msg.includes("timed out") || msg.includes("timeout") || msg.includes("network") || msg.includes("fetch");
  }
  if (e instanceof Error) {
    return e.name === "AbortError" || e.name === "TypeError";
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Phase 5 — Retry Engine.
 *
 * Retries on:
 *  - JSON parse errors (re-asks with hint)
 *  - Network/timeout errors (re-asks after backoff)
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
      if (!isRetryableError(e)) break;

      if (e instanceof AIJSONParseError) {
        aiAnalytics.recordParseFailure();
        aiAnalytics.recordRetry();
        currentParams = {
          ...currentParams,
          messages: [
            ...currentParams.messages,
            { role: "assistant", content: e.raw.slice(0, 500) },
            { role: "user", content: hint },
          ],
        };
      } else {
        aiAnalytics.recordRetry();
        await sleep(1000 * attempt);
      }
    }
  }

  throw lastError;
}