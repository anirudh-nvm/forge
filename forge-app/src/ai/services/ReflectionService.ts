import type { AIClient } from "../AIClient";
import type { MentorResponse, ReflectionContext } from "../../mentor/MentorTypes";
import { buildReflectionPrompt } from "../prompts/ReflectionPrompt";
import { toJSONChatParams } from "../JSONMode";
import { jsonWithRetry } from "../RetryEngine";
import { classifyError, type GracefulFailure } from "../GracefulFailure";
import { Logger } from "../debug/Logger";
import { aiAnalytics } from "../AIAnalytics";

export type ReflectionServiceResult = {
  source: "ai" | "deterministic";
  response: MentorResponse;
  failure?: GracefulFailure;
};

const FALLBACK: MentorResponse = {
  observation: "No patterns detected yet.",
  hypothesis: "Keep building consistency to see clearer patterns.",
  experiment: "Try completing one commitment at your preferred time this week.",
  encouragement: "Every small step counts.",
};

function parseMentorResponse(raw: unknown): MentorResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const observation = typeof o.observation === "string" ? o.observation : "";
  if (!observation) return null;
  return {
    observation,
    hypothesis: typeof o.hypothesis === "string" ? o.hypothesis : "",
    experiment: typeof o.experiment === "string" ? o.experiment : "",
    encouragement: typeof o.encouragement === "string" ? o.encouragement : "",
  };
}

export function createReflectionService(client: AIClient) {
  async function reflect(context: ReflectionContext): Promise<ReflectionServiceResult> {
    if (!client.isConfigured()) {
      return { source: "deterministic", response: FALLBACK };
    }

    const { system, user } = buildReflectionPrompt(context);

    try {
      const params = toJSONChatParams(system, user, { maxTokens: 400 });
      const result = await jsonWithRetry<MentorResponse>(
        client,
        {
          messages: params.messages,
          temperature: 0.7,
          maxTokens: 400,
          operation: "reflection",
        },
        { maxAttempts: 3 }
      );

      const parsed = parseMentorResponse(result.data);
      if (parsed) {
        aiAnalytics.recordOperation("ai");
        return { source: "ai", response: parsed };
      }
      Logger.warn("[reflection] AI returned non-parseable response");
      aiAnalytics.recordOperation("deterministic");
      return { source: "deterministic", response: FALLBACK };
    } catch (e) {
      const failure = classifyError(e);
      Logger.warn(`[reflection] AI failed (${failure.kind})`);
      aiAnalytics.recordOperation("deterministic");
      return { source: "deterministic", response: FALLBACK, failure };
    }
  }

  return { reflect };
}

export type ReflectionService = ReturnType<typeof createReflectionService>;