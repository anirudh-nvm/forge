import { sha256 } from "./debug/sha256";
import { Logger } from "./debug/Logger";

export type CacheOptions = {
  ttlMs?: number;
  capacity?: number;
  onHit?: (key: string) => void;
  onMiss?: (key: string) => void;
};

export type CacheEntry<T> = {
  key: string;
  data: T;
  timestamp: number;
};

/**
 * AIRequestCache
 *
 * Double-tap "update today" → 1 API call instead of 2.
 *
 * Key = SHA256(prompt). Same input within the TTL (default 5 min)
 * returns the cached response instantly — zero network.
 */
export class AIRequestCache {
  private readonly ttlMs: number;
  private readonly capacity: number;
  private readonly onHit?: (key: string) => void;
  private readonly onMiss?: (key: string) => void;
  private cache = new Map<string, CacheEntry<unknown>>();

  constructor(options?: CacheOptions) {
    this.ttlMs = options?.ttlMs ?? 5 * 60 * 1000;
    this.capacity = options?.capacity ?? 200;
    this.onHit = options?.onHit;
    this.onMiss = options?.onMiss;
  }

  static keyFor(...parts: string[]): string {
    return sha256(parts.join("\u0000"));
  }

  get size(): number {
    return this.cache.size;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    if (this.cache.size >= this.capacity && !this.cache.has(key)) {
      const oldest = this.cache.keys().next().value as string;
      this.cache.delete(oldest);
    }
    this.cache.set(key, { key, data, timestamp: Date.now() });
  }

  getOrCompute<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const hit = this.get<T>(key);
    if (hit !== null) {
      this.onHit?.(key);
      Logger.log(`[ai-cache] hit "${key.slice(0, 12)}"`);
      return Promise.resolve(hit);
    }

    this.onMiss?.(key);
    return compute().then((data) => {
      this.set(key, data);
      Logger.log(`[ai-cache] store "${key.slice(0, 12)}"`);
      return data;
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

export const aiRequestCache = new AIRequestCache();