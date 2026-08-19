import type {
  AIOperation,
  AnalyticsSummary,
  OperationTiming,
  RequestRecord,
  TokenRecord,
  AISource,
  DebugRequest,
} from "./metrics/types";

const EMPTY_TIMING: OperationTiming = { count: 0, avgMs: 0, minMs: 0, maxMs: 0 };

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Phase 5 — AI Analytics.
 *
 * Forge keeps a running ledger of everything the AI stack does:
 *  - total requests + latency (avg / fastest / slowest)
 *  - cache hits vs misses
 *  - AI vs deterministic fallback split
 *  - retries and parse failures
 *  - success rate
 *
 * Every module reports into `aiAnalytics`; the dashboard reads
 * `summary()` for one glance at production health.
 */
class AIAnalytics {
  private requestLog: RequestRecord[] = [];
  private tokenLog: TokenRecord[] = [];
  private debugLogInternal: DebugRequest[] = [];
  private lastFallbackReason: string | null = null;
  private cacheHits = 0;
  private cacheMisses = 0;
  private retryCount = 0;
  private parseFailures = 0;
  private aiOperations = 0;
  private deterministicOperations = 0;

  private latencyTotal = 0;
  private latencyFastest = Number.POSITIVE_INFINITY;
  private latencySlowest = 0;
  private latencySamples = 0;
  private successes = 0;
  private failures = 0;

  get size(): number {
    return this.requests.length;
  }

  get requests(): RequestRecord[] {
    return this.requestLog;
  }

  get tokenRecords(): TokenRecord[] {
    return this.tokenLog;
  }

  get tokenCount(): number {
    return this.tokenLog.length;
  }

  get debugLog(): DebugRequest[] {
    return this.debugLogInternal;
  }

  get fallbackReason(): string | null {
    return this.lastFallbackReason;
  }

  recordDebug(entry: DebugRequest): void {
    this.debugLogInternal.push(entry);
    if (entry.fallbackReason) this.lastFallbackReason = entry.fallbackReason;
    if (this.debugLogInternal.length > 100) this.debugLogInternal.shift();
  }

  recordRequest(record: RequestRecord): void {
    this.requestLog.push(record);
    if (!record.cached) {
      this.latencyTotal += record.durationMs;
      this.latencyFastest = Math.min(this.latencyFastest, record.durationMs);
      this.latencySlowest = Math.max(this.latencySlowest, record.durationMs);
      this.latencySamples++;
    }
    if (record.success) this.successes++;
    else this.failures++;
  }

  recordCacheHit(_key?: string): void {
    this.cacheHits++;
  }

  recordCacheMiss(_key?: string): void {
    this.cacheMisses++;
  }

  recordTokens(record: TokenRecord): void {
    this.tokenLog.push(record);
  }

  recordRetry(): void {
    this.retryCount++;
  }

  recordParseFailure(): void {
    this.parseFailures++;
  }

  recordOperation(source: AISource): void {
    if (source === "ai") this.aiOperations++;
    else this.deterministicOperations++;
  }

  private timingFor(operation: AIOperation): OperationTiming {
    const samples = this.requestLog.filter(
      (r) => r.operation === operation && !r.cached
    );
    if (samples.length === 0) return EMPTY_TIMING;
    const total = samples.reduce((sum, r) => sum + r.durationMs, 0);
    return {
      count: samples.length,
      avgMs: round1(total / samples.length),
      minMs: Math.min(...samples.map((r) => r.durationMs)),
      maxMs: Math.max(...samples.map((r) => r.durationMs)),
    };
  }

  byOperation(): Record<AIOperation, OperationTiming> {
    const ops: AIOperation[] = ["planning", "adjustment", "reflection", "mentor", "unknown"];
    return Object.fromEntries(ops.map((op) => [op, this.timingFor(op)])) as Record<
      AIOperation,
      OperationTiming
    >;
  }

  summary(): AnalyticsSummary {
    const total = this.aiOperations + this.deterministicOperations;
    const realCalls = this.successes + this.failures;
    const totalRequests = this.requestLog.length;

    return {
      totalRequests,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      averageLatencyMs: round1(
        this.latencySamples > 0 ? this.latencyTotal / this.latencySamples : 0
      ),
      fastestMs: this.latencyFastest === Number.POSITIVE_INFINITY ? 0 : this.latencyFastest,
      slowestMs: this.latencySlowest,
      aiUsedPct: round1(total > 0 ? (this.aiOperations / total) * 100 : 0),
      deterministicPct: round1(total > 0 ? (this.deterministicOperations / total) * 100 : 0),
      retryCount: this.retryCount,
      parseFailures: this.parseFailures,
      successRate: round1(realCalls > 0 ? (this.successes / realCalls) * 100 : 0),
      byOperation: this.byOperation(),
    };
  }

  reset(): void {
    this.requestLog = [];
    this.tokenLog = [];
    this.debugLogInternal = [];
    this.lastFallbackReason = null;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.retryCount = 0;
    this.parseFailures = 0;
    this.aiOperations = 0;
    this.deterministicOperations = 0;
    this.latencyTotal = 0;
    this.latencyFastest = Number.POSITIVE_INFINITY;
    this.latencySlowest = 0;
    this.latencySamples = 0;
    this.successes = 0;
    this.failures = 0;
  }
}

export const aiAnalytics = new AIAnalytics();