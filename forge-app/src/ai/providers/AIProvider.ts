import type {
  ChatParams,
  ChatResult,
  JSONResult,
  ProviderStatus,
} from "../types/AIResponse";

/**
 * Every model must look identical.
 *
 * Forge never talks to Gemini, OpenAI or Claude directly.
 * Each provider implements this single interface and Forge
 * talks only to the AIClient.
 */
export interface AIProvider {
  readonly name: "gemini" | "openai" | "claude" | "deterministic";

  chat(params: ChatParams): Promise<ChatResult>;

  /**
   * Ask the model to return structured JSON and get it back
   * typed. Providers parse + validate the JSON here.
   */
  json<T>(params: ChatParams): Promise<JSONResult<T>>;

  status(): ProviderStatus;

  isConfigured(): boolean;

  /** Best-effort connection warmup. Failures are silently ignored. */
  warmup?(): Promise<void>;
}