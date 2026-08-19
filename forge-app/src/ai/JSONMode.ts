import type { AIMessage, ChatParams } from "./types/AIResponse";

/**
 * Phase 4 — JSON Mode.
 *
 * Instead of asking the model to "reply conversationally", we ask
 * for ONLY JSON. No markdown. No explanation. The output is for
 * machines — humans never see it.
 */

export const JSON_MODE_INSTRUCTION =
  "Return ONLY valid JSON. No markdown, no code fences, no explanation, no prose. Nothing but the JSON object.";

export function withJSONInstruction(system: string): string {
  return `${system}\n\n${JSON_MODE_INSTRUCTION}`;
}

export function asJSONMessages(
  system: string,
  user: string
): AIMessage[] {
  return [
    { role: "system", content: withJSONInstruction(system) },
    { role: "user", content: user },
  ];
}

export function toJSONChatParams(
  system: string,
  user: string,
  extra?: Partial<ChatParams>
): ChatParams {
  return {
    messages: asJSONMessages(system, user),
    temperature: extra?.temperature ?? 0.2,
    maxTokens: extra?.maxTokens ?? 2048,
  };
}