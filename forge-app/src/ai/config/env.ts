import type { ProviderName } from "../types/AIResponse";

/**
 * Forge AI configuration.
 *
 * Keys are NEVER hardcoded. They come from .env files via the
 * EXPO_PUBLIC_ prefix (loaded by Expo CLI). .env / .env*.local
 * are gitignored — see .env.example for the shape.
 *
 * IMPORTANT (Expo): each variable MUST be referenced as a static
 * property of process.env (dot notation) so it gets inlined.
 * Dynamic access is forbidden by expo/no-dynamic-env-var.
 */

export interface ForgeAIConfig {
  provider: ProviderName;
  geminiApiKey?: string;
  openaiApiKey?: string;
  geminiModel?: string;
  openaiModel?: string;
  /** Enables the Developer AI Panel (long-press the Forge logo). */
  devPanel: boolean;
}

function nonEmpty(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

export function getAIConfig(): ForgeAIConfig {
  const providerEnv = process.env.EXPO_PUBLIC_AI_PROVIDER;
  const provider: ProviderName =
    providerEnv === "openai" || providerEnv === "claude"
      ? (providerEnv as ProviderName)
      : "gemini";

  return {
    provider,
    geminiApiKey: nonEmpty(process.env.EXPO_PUBLIC_GEMINI_API_KEY),
    openaiApiKey: nonEmpty(process.env.EXPO_PUBLIC_OPENAI_API_KEY),
    geminiModel: nonEmpty(process.env.EXPO_PUBLIC_GEMINI_MODEL),
    openaiModel: nonEmpty(process.env.EXPO_PUBLIC_OPENAI_MODEL),
    devPanel: process.env.EXPO_PUBLIC_AI_DEV_PANEL === "true",
  };
}

export function isAIConfigured(): boolean {
  const config = getAIConfig();
  if (config.provider === "openai") return Boolean(config.openaiApiKey);
  return Boolean(config.geminiApiKey);
}