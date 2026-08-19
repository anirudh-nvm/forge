export type AIMessageRole = "system" | "user" | "assistant";

export interface AIMessage {
  role: AIMessageRole;
  content: string;
}

export interface ChatParams {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Telemetry bucket (planning / adjustment / reflection / mentor). */
  operation?: string;
}

export interface UsageMetadata {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ChatResult {
  content: string;
  model: string;
  usage?: UsageMetadata;
}

export interface JSONResult<T> {
  data: T;
  model: string;
  usage?: UsageMetadata;
}

export type ProviderName = "gemini" | "openai" | "claude" | "deterministic";

export interface ProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export interface ProviderStatus {
  name: ProviderName;
  model: string;
  configured: boolean;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: ProviderName
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

export class AIProviderNotConfiguredError extends AIProviderError {
  constructor(provider: ProviderName) {
    super(`${provider} provider is not configured — no api key provided.`, provider);
    this.name = "AIProviderNotConfiguredError";
  }
}

export class AIJSONParseError extends AIProviderError {
  constructor(
    provider: ProviderName,
    public readonly raw: string
  ) {
    super(`failed to parse JSON from ${provider}.`, provider);
    this.name = "AIJSONParseError";
  }
}