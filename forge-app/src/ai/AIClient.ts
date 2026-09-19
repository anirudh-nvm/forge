import type { AIProvider } from "./providers/AIProvider";
import { GeminiProvider } from "./providers/GeminiProvider";
import { OpenAIProvider } from "./providers/OpenAIProvider";
import { AIRequestCache } from "./AIRequestCache";
import { AIRequestLimiter } from "./AIRequestLimiter";
import { Logger } from "./debug/Logger";
import { aiAnalytics } from "./AIAnalytics";
import { tokenUsage } from "./metrics/TokenUsage";
import { redactPrompt, type AIOperation } from "./metrics/types";
import type {
  ChatParams,
  ChatResult,
  JSONResult,
  ProviderStatus,
  UsageMetadata,
} from "./types/AIResponse";

export type ProductionOptions = {
  cache?: AIRequestCache | null;
  limiter?: AIRequestLimiter | null;
  /** Disable the production layer entirely (used in tests). */
  production?: boolean;
};

/**
 * AIClient — the ONLY thing Forge talks to.
 *
 * Forge never calls Gemini / OpenAI / Claude directly.
 * Everything goes through this single file, so swapping
 * providers is a one-line change.
 *
 * Production layer (Sprint C8.5):
 *  - Request cache: identical prompt within 5 min → zero API calls.
 *  - Rate limiter: burst taps collapse into one request.
 */
export class AIClient {
  private provider: AIProvider;
  private fallback: AIProvider | null;
  private readonly cache: AIRequestCache | null;
  private readonly limiter: AIRequestLimiter | null;

  constructor(provider?: AIProvider, options?: ProductionOptions) {
    this.provider = provider ?? new GeminiProvider();
    this.fallback = null;
    this.cache =
      options?.cache === undefined
        ? new AIRequestCache({
            onHit: (key) => aiAnalytics.recordCacheHit(key),
            onMiss: (key) => aiAnalytics.recordCacheMiss(key),
          })
        : options.cache;
    this.limiter = options?.limiter === undefined ? new AIRequestLimiter() : options.limiter;
    if (options?.production === false) {
      this.cache = null;
      this.limiter = null;
    }
  }

  getProvider(): AIProvider {
    return this.provider;
  }

  get name(): string {
    return this.provider.name;
  }

  status(): ProviderStatus {
    return this.provider.status();
  }

  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  async warmup(): Promise<void> {
    if (this.provider.warmup) {
      await this.provider.warmup();
    }
  }

  setProvider(provider: AIProvider): void {
    this.provider = provider;
  }

  /**
   * Register a deterministic fallback used when the active
   * provider is not configured. Forge keeps working offline.
   */
  setFallback(provider: AIProvider): void {
    this.fallback = provider;
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const key = this.keyFor("chat", params);
    const startedAt = Date.now();
    const cached = this.wasCached(key);
    const call = () => this.doChat(params);

    try {
      const result = this.cache && key
        ? await this.cache.getOrCompute<ChatResult>(key, () =>
            this.limiter ? this.limiter.run(key, call) : call()
          )
        : await (this.limiter && key ? this.limiter.run(key, call) : call());

      this.recordMetric("chat", params, startedAt, true, cached, result.content);
      this.recordTokens(result.usage, params.operation);
      return result;
    } catch (e) {
      this.recordMetric("chat", params, startedAt, false, cached, undefined, e);
      throw e;
    }
  }

  async json<T>(params: ChatParams): Promise<JSONResult<T>> {
    const key = this.keyFor("json", params);
    const startedAt = Date.now();
    const cached = this.wasCached(key);
    const call = () => this.doJson<T>(params);

    try {
      const result = this.cache && key
        ? await this.cache.getOrCompute<JSONResult<T>>(key, () =>
            this.limiter ? this.limiter.run(key, call) : call()
          )
        : await (this.limiter && key ? this.limiter.run(key, call) : call());

      this.recordMetric("json", params, startedAt, true, cached, JSON.stringify(result.data));
      this.recordTokens(result.usage, params.operation);
      return result;
    } catch (e) {
      this.recordMetric("json", params, startedAt, false, cached, undefined, e);
      throw e;
    }
  }

  private wasCached(key: string): boolean {
    return Boolean(this.cache && key && this.cache.has(key));
  }

  private recordMetric(
    kind: "chat" | "json",
    params: ChatParams,
    startedAt: number,
    success: boolean,
    cached: boolean,
    response?: string,
    error?: unknown
  ): void {
    const durationMs = Date.now() - startedAt;
    const fallbackUsed = success && this.fallback && !this.provider.isConfigured();
    aiAnalytics.recordRequest({
      operation: (params.operation as AIOperation) ?? "unknown",
      durationMs,
      success,
      cached,
      source: fallbackUsed ? "deterministic" : "ai",
      at: startedAt,
    });
    aiAnalytics.recordDebug({
      at: startedAt,
      kind,
      operation: (params.operation as AIOperation) ?? "unknown",
      durationMs,
      success,
      cached,
      source: fallbackUsed ? "deterministic" : "ai",
      prompt: redactPrompt(params.messages.map((m) => `${m.role}: ${m.content}`).join("\n")),
      response: response ? redactPrompt(response) : "",
      fallbackReason: fallbackUsed
        ? `${this.provider.name} not configured; used deterministic fallback`
        : error instanceof Error
          ? error.message
          : undefined,
    });
    Logger.log(`[ai-metrics] ${kind} ${success ? "ok" : "fail"} ${cached ? "(cache)" : "(api)"} in ${durationMs}ms`);
  }

  private recordTokens(usage: UsageMetadata | undefined, operation: string | undefined): void {
    if (!usage) return;
    tokenUsage.record(usage.inputTokens, usage.outputTokens, (operation as AIOperation) ?? "unknown");
  }

  private async doChat(params: ChatParams): Promise<ChatResult> {
    try {
      const result = await this.provider.chat(params);
      Logger.log(`[ai] ${this.provider.name}.chat ok`);
      return result;
    } catch (e) {
      if (this.fallback && !this.provider.isConfigured()) {
        Logger.warn(`[ai] falling back to deterministic (unconfigured)`);
        return this.fallback.chat(params);
      }
      throw e;
    }
  }

  private async doJson<T>(params: ChatParams): Promise<JSONResult<T>> {
    try {
      const result = await this.provider.json<T>(params);
      Logger.log(`[ai] ${this.provider.name}.json ok`);
      return result;
    } catch (e) {
      if (this.fallback && !this.provider.isConfigured()) {
        Logger.warn(`[ai] falling back to deterministic (unconfigured)`);
        return this.fallback.json<T>(params);
      }
      throw e;
    }
  }

  private keyFor(kind: "chat" | "json", params: ChatParams): string {
    const content = params.messages
      .map((m) => `${m.role}:${m.content}`)
      .join("|");
    if (!content) return "";
    return AIRequestCache.keyFor(kind, content, String(params.temperature ?? 0));
  }
}

export function createDefaultAIClient(): AIClient {
  return new AIClient(new GeminiProvider());
}

export function createAIClient(
  options: { provider?: "gemini" | "openai"; geminiApiKey?: string; openaiApiKey?: string; fallback?: AIProvider; production?: ProductionOptions }
): AIClient {
  const provider: AIProvider =
    options.provider === "openai"
      ? new OpenAIProvider({ apiKey: options.openaiApiKey })
      : new GeminiProvider({ apiKey: options.geminiApiKey });

  const client = new AIClient(provider, options.production);
  if (options.fallback) client.setFallback(options.fallback);
  return client;
}

export { GeminiProvider, OpenAIProvider };
export type { AIProvider, ChatParams, ChatResult, JSONResult, ProviderStatus };