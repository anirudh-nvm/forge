export type AIOperation = "planning" | "adjustment" | "reflection" | "mentor" | "unknown";

export type AISource = "ai" | "deterministic";

export interface RequestRecord {
  operation: AIOperation;
  durationMs: number;
  success: boolean;
  cached: boolean;
  source: AISource;
  at: number;
}

export interface TokenRecord {
  operation: AIOperation;
  inputTokens: number;
  outputTokens: number;
  at: number;
}

export interface OperationTiming {
  count: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
}

export interface DebugRequest {
  at: number;
  kind: "chat" | "json";
  operation: AIOperation;
  durationMs: number;
  success: boolean;
  cached: boolean;
  source: AISource;
  prompt: string;
  response: string;
  fallbackReason?: string;
}

export function redactPrompt(text: string, maxLength = 400): string {
  const truncated = text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
  return (
    truncated
      .replace(/\b[A-Za-z0-9_-]{28,}\b/g, "[key]")
      .replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, "[card]")
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
      .replace(/\b\d{10,}\b/g, "[number]")
  );
}

export interface AnalyticsSummary {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  averageLatencyMs: number;
  fastestMs: number;
  slowestMs: number;
  aiUsedPct: number;
  deterministicPct: number;
  retryCount: number;
  parseFailures: number;
  successRate: number;
  byOperation: Record<AIOperation, OperationTiming>;
}