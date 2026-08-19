import type { ProviderName } from "./types/AIResponse";
import { AIProviderError, AIJSONParseError, AIProviderNotConfiguredError } from "./types/AIResponse";
import { Logger } from "./debug/Logger";

export type FailureKind =
  | "offline"
  | "rate_limited"
  | "server"
  | "parse"
  | "unconfigured"
  | "timeout"
  | "unknown";

export type GracefulFailure = {
  kind: FailureKind;
  userMessage: string;
  fallback: "deterministic" | "retry" | "none";
  retryable: boolean;
};

const MESSAGES: Record<FailureKind, string> = {
  offline: "I'm offline. Let's use what I already know.",
  rate_limited: "I've reached today's AI limit. I'll keep using the reliable planner.",
  server: "Something unexpected happened. Let's try again in a moment.",
  parse: "I couldn't quite make that out. Let me use what I know.",
  unconfigured: "I'm thinking in offline mode today. Using the reliable planner.",
  timeout: "I'm having trouble thinking right now. I'll fall back to the reliable planner for today.",
  unknown: "Something unexpected happened. Let's try again in a moment.",
};

export function classifyError(error: unknown): GracefulFailure {
  if (error instanceof AIProviderNotConfiguredError) {
    return {
      kind: "unconfigured",
      userMessage: MESSAGES.unconfigured,
      fallback: "deterministic",
      retryable: false,
    };
  }

  if (error instanceof AIJSONParseError) {
    return {
      kind: "parse",
      userMessage: MESSAGES.parse,
      fallback: "retry",
      retryable: true,
    };
  }

  if (error instanceof AIProviderError) {
    const status = extractStatus(error);
    if (status === 429) {
      return {
        kind: "rate_limited",
        userMessage: MESSAGES.rate_limited,
        fallback: "deterministic",
        retryable: false,
      };
    }
    if (status === 503 || status === 500) {
      return {
        kind: "server",
        userMessage: MESSAGES.server,
        fallback: "deterministic",
        retryable: true,
      };
    }
    if (status === 404) {
      return {
        kind: "unknown",
        userMessage: MESSAGES.unknown,
        fallback: "deterministic",
        retryable: false,
      };
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("network") || msg.includes("failed to fetch") || msg.includes("offline")) {
      return {
        kind: "offline",
        userMessage: MESSAGES.offline,
        fallback: "deterministic",
        retryable: true,
      };
    }
    if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("aborted")) {
      return {
        kind: "timeout",
        userMessage: MESSAGES.timeout,
        fallback: "deterministic",
        retryable: true,
      };
    }
  }

  return {
    kind: "unknown",
    userMessage: MESSAGES.unknown,
    fallback: "deterministic",
    retryable: false,
  };
}

function extractStatus(error: AIProviderError): number {
  const match = error.message.match(/\b(429|500|502|503|404)\b/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Wrap an AI call so the user "almost never sees an error".
 * On failure: log, classify, and produce a friendly result.
 */
export async function graceful<T>(
  work: () => Promise<T>,
  onFallback: (failure: GracefulFailure) => T | Promise<T>,
  provider: ProviderName = "gemini"
): Promise<{ data: T; failure: GracefulFailure | null }> {
  try {
    const data = await work();
    return { data, failure: null };
  } catch (e) {
    const failure = classifyError(e);
    Logger.warn(`[ai] ${provider} failure (${failure.kind}):`, e instanceof Error ? e.message : e);
    const data = await onFallback(failure);
    return { data, failure };
  }
}

export const AI_USER_MESSAGES = MESSAGES;