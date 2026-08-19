import type { AIProvider } from "./AIProvider";
import type {
  AIMessage,
  ChatParams,
  ChatResult,
  JSONResult,
  ProviderConfig,
  ProviderStatus,
  UsageMetadata,
} from "../types/AIResponse";
import {
  AIProviderError,
  AIProviderNotConfiguredError,
  AIJSONParseError,
} from "../types/AIResponse";
import { Logger } from "../debug/Logger";

const DEFAULT_MODEL = "gemini-flash-latest";

export type AskOptions = {
  temperature?: number;
  maxTokens?: number;
};

/**
 * GeminiProvider
 *
 * One function does all the work: ask() → Gemini API → text.
 * chat() and json() are thin wrappers over ask() so the provider
 * still satisfies the AIProvider interface. Nothing else touches
 * the wire.
 */
export class GeminiProvider implements AIProvider {
  readonly name = "gemini" as const;
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly baseUrl: string;
  lastUsage?: UsageMetadata;

  constructor(config?: ProviderConfig) {
    this.apiKey = config?.apiKey;
    this.model = config?.model ?? DEFAULT_MODEL;
    this.baseUrl = config?.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  status(): ProviderStatus {
    return {
      name: this.name,
      model: this.model,
      configured: this.isConfigured(),
    };
  }

  async ask(messages: AIMessage[], options?: AskOptions): Promise<string> {
    this.ensureConfigured();

    const body = {
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : m.role,
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 1024,
      },
    };

    try {
      const startedAt = Date.now();
      const response = await fetch(
        `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const detail = await response.text();
        Logger.warn(`[gemini] HTTP ${response.status} after ${Date.now() - startedAt}ms`);
        throw new AIProviderError(
          `gemini returned ${response.status}: ${detail}`,
          this.name
        );
      }

      const json = await response.json();
      Logger.log(`[gemini] ok in ${Date.now() - startedAt}ms (${this.model})`);

      const usage = extractUsage(json);
      this.lastUsage = usage;

      return (
        json?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("") ?? ""
      );
    } catch (e) {
      if (e instanceof AIProviderError) throw e;
      throw new AIProviderError(
        `gemini request failed: ${e instanceof Error ? e.message : "unknown error"}`,
        this.name
      );
    }
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const text = await this.ask(params.messages, {
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    });
    return { content: text, model: this.model, usage: this.lastUsage };
  }

  async json<T>(params: ChatParams): Promise<JSONResult<T>> {
    const text = await this.ask(params.messages, {
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    });
    return {
      data: extractJSON<T>(text, this.name),
      model: this.model,
      usage: this.lastUsage,
    };
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new AIProviderNotConfiguredError(this.name);
    }
  }
}

function extractUsage(json: unknown): UsageMetadata | undefined {
  const u = (json as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } })
    ?.usageMetadata;
  if (!u) return undefined;
  const input = u.promptTokenCount ?? 0;
  const output = u.candidatesTokenCount ?? 0;
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: u.totalTokenCount ?? input + output,
  };
}

export function extractJSON<T>(content: string, provider: "gemini" | "openai" | "claude"): T {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new AIJSONParseError(provider, content);
  }

  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    throw new AIJSONParseError(provider, content);
  }
}