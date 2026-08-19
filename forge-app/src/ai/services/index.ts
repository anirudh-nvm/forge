import { AIClient } from "../AIClient";
import { GeminiProvider } from "../providers/GeminiProvider";
import { OpenAIProvider } from "../providers/OpenAIProvider";
import { getAIConfig } from "../config/env";
import { createIntentService, type IntentService } from "./IntentService";
import { createReflectionService, type ReflectionService } from "./ReflectionService";
import { createMentorService, type MentorService } from "./MentorService";
import { aiAnalytics } from "../AIAnalytics";
import { tokenUsage } from "../metrics/TokenUsage";
import { healthScore } from "../metrics/HealthScore";
import { aiStats } from "../metrics/AIStats";

export type ForgeAIServices = {
  client: AIClient;
  intent: IntentService;
  reflection: ReflectionService;
  mentor: MentorService;
  configured: boolean;
  metrics: {
    analytics: typeof aiAnalytics;
    tokens: typeof tokenUsage;
    health: typeof healthScore;
    stats: typeof aiStats;
  };
};

/**
 * Build the single AI stack Forge uses.
 *
 * Reads keys from .env via EXPO_PUBLIC_ vars. Never hardcodes keys.
 * When no key is present, services fall back to deterministic logic
 * and the app keeps working offline.
 */
export function createForgeAI(): ForgeAIServices {
  const config = getAIConfig();

  const client =
    config.provider === "openai"
      ? new AIClient(
          new OpenAIProvider({
            apiKey: config.openaiApiKey,
            model: config.openaiModel,
          })
        )
      : new AIClient(
          new GeminiProvider({
            apiKey: config.geminiApiKey,
            model: config.geminiModel,
          })
        );

  return {
    client,
    intent: createIntentService(client),
    reflection: createReflectionService(client),
    mentor: createMentorService(client),
    configured: client.isConfigured(),
    metrics: {
      analytics: aiAnalytics,
      tokens: tokenUsage,
      health: healthScore,
      stats: aiStats,
    },
  };
}