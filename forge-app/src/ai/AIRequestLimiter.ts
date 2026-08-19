import { Logger } from "./debug/Logger";

export type RateLimitOptions = {
  windowMs?: number;
};

type Inflight<T> = {
  promise: Promise<T>;
  timer: ReturnType<typeof setTimeout>;
};

/**
 * AIRequestLimiter
 *
 * Burst taps ("adjust today" x7 in a row) collapse into ONE request.
 *
 * How it works:
 *  - The first call for a key starts the real work and caches the
 *    in-flight promise for the coalescing window (default 750ms).
 *  - Every other call for the SAME key within the window returns the
 *    same in-flight promise — one request, N callers.
 *  - After the window closes, the entry is evicted and the next call
 *    starts fresh.
 *
 * Result: "adjust today" tapped 7 times = 1 Gemini request.
 */
export class AIRequestLimiter {
  private readonly windowMs: number;
  private inflight = new Map<string, Inflight<unknown>>();

  constructor(options?: RateLimitOptions) {
    this.windowMs = options?.windowMs ?? 750;
  }

  get isBusy(): boolean {
    return this.inflight.size > 0;
  }

  get pendingKeys(): string[] {
    return [...this.inflight.keys()];
  }

  /**
   * Run `work`, but coalesce concurrent calls that share the same key
   * within the window. Returns the shared result.
   */
  async run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) {
      return existing.promise as Promise<T>;
    }

    const promise = work();
    const timer = setTimeout(() => {
      this.inflight.delete(key);
      Logger.log(`[rate-limit] window closed for "${key}"`);
    }, this.windowMs);

    this.inflight.set(key, { promise, timer });
    Logger.log(`[rate-limit] coalescing "${key}" for ${this.windowMs}ms`);

    try {
      return await promise;
    } finally {
      if (this.inflight.get(key)?.promise === promise) {
        clearTimeout(timer);
        this.inflight.delete(key);
      }
    }
  }

  clear(): void {
    for (const { timer } of this.inflight.values()) clearTimeout(timer);
    this.inflight.clear();
  }
}

export const aiRequestLimiter = new AIRequestLimiter();