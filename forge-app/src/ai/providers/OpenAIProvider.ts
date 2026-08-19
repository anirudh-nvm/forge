import type { AIProvider } from "./AIProvider";
import type {
  ChatParams,
  ChatResult,
  JSONResult,
  ProviderConfig,
  ProviderStatus,
} from "../types/AIResponse";
import {
  AIProviderError,
  AIProviderNotConfiguredError,
} from "../types/AIResponse";
import { extractJSON } from "./GeminiProvider";

const DEFAULT_MODEL = "gpt-4o-mini";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(config?: ProviderConfig) {
    this.apiKey = config?.apiKey;
    this.model = config?.model ?? DEFAULT_MODEL;
    this.baseUrl = config?.baseUrl ?? "https://api.openai.com/v1";
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

  async chat(params: ChatParams): Promise<ChatResult> {
    this.ensureConfigured();

    const body = {
      model: this.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 1024,
    };

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new AIProviderError(
          `openai returned ${response.status}: ${await response.text()}`,
          this.name
        );
      }

      const json = await response.json();
      const text = json?.choices?.[0]?.message?.content ?? "";

      return { content: text, model: this.model };
    } catch (e) {
      if (e instanceof AIProviderError) throw e;
      throw new AIProviderError(
        `openai request failed: ${e instanceof Error ? e.message : "unknown error"}`,
        this.name
      );
    }
  }

  async json<T>(params: ChatParams): Promise<JSONResult<T>> {
    const result = await this.chat(params);
    return {
      data: extractJSON<T>(result.content, this.name),
      model: result.model,
    };
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new AIProviderNotConfiguredError(this.name);
    }
  }
}