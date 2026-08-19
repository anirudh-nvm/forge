import type { AIClient } from "../AIClient";
import type { MentorResponse, MentorV2Context } from "../../mentor/MentorTypes";
import { buildMentorPrompt } from "../prompts/MentorPrompt";
import { toJSONChatParams } from "../JSONMode";
import { jsonWithRetry } from "../RetryEngine";
import { classifyError, type GracefulFailure } from "../GracefulFailure";
import { Logger } from "../debug/Logger";
import { aiAnalytics } from "../AIAnalytics";

export type MentorServiceResult = {
  source: "ai" | "deterministic";
  response: MentorResponse;
  failure?: GracefulFailure;
};

function fallbackFor(ctx: MentorV2Context): MentorResponse {
  return {
    observation: ctx.identity.lifeDirectionTitle
      ? `Working toward: ${ctx.identity.lifeDirectionTitle}`
      : "No patterns detected yet.",
    hypothesis: "Keep building consistency to see clearer patterns.",
    experiment: "Try completing one commitment at your preferred time this week.",
    encouragement: "Every small step counts.",
  };
}

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

export function createMentorService(client: AIClient) {
  async function advise(ctx: MentorV2Context): Promise<MentorServiceResult> {
    if (!client.isConfigured()) {
      return { source: "deterministic", response: fallbackFor(ctx) };
    }

    const { system, user } = buildMentorPrompt(ctx);

    try {
      const params = toJSONChatParams(system, user, { maxTokens: 400 });
      const result = await jsonWithRetry<MentorResponse>(
        client,
        {
          messages: params.messages,
          temperature: 0.7,
          maxTokens: 400,
          operation: "mentor",
        },
        { maxAttempts: 3 }
      );

      const parsed = parseMentorResponse(result.data);
      if (parsed) {
        aiAnalytics.recordOperation("ai");
        return { source: "ai", response: parsed };
      }
      Logger.warn("[mentor] AI returned non-parseable response");
      aiAnalytics.recordOperation("deterministic");
      return { source: "deterministic", response: fallbackFor(ctx) };
    } catch (e) {
      const failure = classifyError(e);
      Logger.warn(`[mentor] AI failed (${failure.kind})`);
      aiAnalytics.recordOperation("deterministic");
      return { source: "deterministic", response: fallbackFor(ctx), failure };
    }
  }

  return { advise };
}

export type MentorService = ReturnType<typeof createMentorService>;