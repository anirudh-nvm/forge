import type { AIClient } from "../AIClient";
import type { TodayPlan } from "../../types/todayPlan";
import type { Intent, IntentResolution } from "../IntentTypes";
import { isIntent, INTENT_SYSTEM_PROMPT } from "../prompts/IntentPrompt";
import { jsonWithRetry } from "../RetryEngine";
import { toJSONChatParams } from "../JSONMode";
import { understandIntent } from "../IntentEngine";
import { validateIntent } from "../IntentValidator";
import { applyIntent, type ApplyResult } from "../IntentApplier";
import { classifyError, type GracefulFailure } from "../GracefulFailure";
import { Logger } from "../debug/Logger";
import { aiAnalytics } from "../AIAnalytics";

export type IntentServiceResult = {
  source: "ai" | "deterministic";
  resolution: IntentResolution;
  intent?: Intent;
  apply?: ApplyResult;
  /** Present when AI failed and we fell back to deterministic. */
  failure?: GracefulFailure;
};

function userContext(input: string, plan: TodayPlan): string {
  const commitments = plan.commitments.map(
    (c) => `${c.title} (${c.startTime} to ${c.endTime})${c.locked ? " [locked]" : ""}`
  );
  return `CURRENT SCHEDULE:\n${
    commitments.length > 0 ? commitments.join("\n") : "No commitments on today's plan yet."
  }\n\nUser said: "${input}"\n\nWhat did the user MEAN? Output one structured intent as JSON.`;
}

export function createIntentService(client: AIClient) {
  async function understandAI(input: string, plan: TodayPlan): Promise<Intent | null> {
    if (!client.isConfigured()) return null;

    const params = toJSONChatParams(
      INTENT_SYSTEM_PROMPT,
      userContext(input, plan),
      { maxTokens: 600 }
    );

    const result = await jsonWithRetry<Intent>(
      client,
      {
        messages: params.messages,
        temperature: 0.2,
        maxTokens: 600,
        operation: "adjustment",
      },
      { maxAttempts: 3 }
    );

    if (isIntent(result.data)) return result.data;
    Logger.warn("[intent] AI returned a non-intent payload, using deterministic");
    return null;
  }

  async function understand(
    input: string,
    plan: TodayPlan
  ): Promise<IntentServiceResult> {
    let failure: GracefulFailure | undefined;
    let aiIntent: Intent | null = null;

    if (client.isConfigured()) {
      try {
        aiIntent = await understandAI(input, plan);
      } catch (e) {
        failure = classifyError(e);
        Logger.warn(`[intent] understanding failed (${failure.kind})`);
      }
    }

    if (aiIntent) {
      aiAnalytics.recordOperation("ai");
      const validated = validateIntent(aiIntent, plan);
      if (validated.status === "resolved" && validated.intent) {
        return {
          source: "ai",
          resolution: validated,
          intent: validated.intent,
          apply: applyIntent(plan, validated.intent),
        };
      }
      Logger.warn("[intent] AI intent validation failed, falling back to deterministic");
    }

    aiAnalytics.recordOperation("deterministic");

    const parts = input.split(/\s+(?:and|also|plus|then|,\s*)\s+/i).filter((p) => p.trim().length > 2);
    const allChanges: import("../IntentApplier").AppliedChange[] = [];
    let currentPlan = plan;
    let lastResolution: IntentResolution | null = null;
    let firstDetectedIntent: Intent | undefined;

    const searchParts = parts.length > 1 ? parts : [input];

    for (const part of searchParts) {
      const deterministic = understandIntent(part.trim(), currentPlan);
      lastResolution = deterministic;

      if (deterministic.status === "resolved" && deterministic.intent) {
        if (!firstDetectedIntent) firstDetectedIntent = deterministic.intent;
        const validated = validateIntent(deterministic.intent, currentPlan);
        if (validated.status === "resolved" && validated.intent) {
          const result = applyIntent(currentPlan, validated.intent);
          currentPlan = result.plan;
          allChanges.push(...result.changes);
        }
      }
    }

    if (allChanges.length === 0) {
      return {
        source: "deterministic",
        resolution: lastResolution ?? { status: "general", message: "no intents found" },
        intent: undefined,
        failure,
        apply: undefined,
      };
    }

    return {
      source: "deterministic",
      resolution: lastResolution!,
      intent: firstDetectedIntent,
      failure,
      apply: {
        plan: currentPlan,
        changes: allChanges,
        affectedWindow: allChanges[0]?.title ?? "now",
      },
    };
  }

  return { understand, understandAI };
}

export type IntentService = ReturnType<typeof createIntentService>;