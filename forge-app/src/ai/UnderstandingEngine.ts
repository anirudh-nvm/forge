import type { TodayPlan } from "../types/todayPlan";
import type { Intent, IntentResolution } from "./IntentTypes";
import { understandIntent } from "./IntentEngine";
import { validateIntent } from "./IntentValidator";
import { applyIntent, type ApplyResult } from "./IntentApplier";
import { buildConversationalResponse, type ConversationalResponse } from "./IntentResponder";

export type UnderstandingResult = {
  resolution: IntentResolution;
  intent?: Intent;
  apply?: ApplyResult;
  response: ConversationalResponse;
};

export function processIntent(input: string, plan: TodayPlan): UnderstandingResult {
  const raw = understandIntent(input, plan);

  let intent: Intent | undefined = raw.intent;
  let resolution: IntentResolution = raw;

  if (raw.status === "resolved" && raw.intent) {
    const validated = validateIntent(raw.intent, plan);
    resolution = validated;
    intent = validated.intent;
  }

  let apply: ApplyResult | undefined;

  if (resolution.status === "resolved" && intent) {
    apply = applyIntent(plan, intent);
  }

  const response = buildConversationalResponse(
    plan,
    apply?.plan ?? plan,
    resolution
  );

  return { resolution, intent, apply, response };
}

export function resolveWithAnswer(
  input: string,
  plan: TodayPlan,
  answer: string
): UnderstandingResult {
  const annotated = `${input} ${answer}`.trim();
  return processIntent(annotated, plan);
}

export { understandIntent, validateIntent, applyIntent, buildConversationalResponse };
export type { Intent, IntentResolution, ApplyResult, ConversationalResponse };