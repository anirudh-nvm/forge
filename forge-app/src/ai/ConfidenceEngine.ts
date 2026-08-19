import type { Intent } from "./IntentTypes";

export type ConfidenceAction = "apply" | "ask" | "clarify";

export const CONFIDENCE_THRESHOLDS = {
  apply: 0.85,
  ask: 0.5,
  clarify: 0,
} as const;

export function decideAction(confidence: number): ConfidenceAction {
  if (confidence >= CONFIDENCE_THRESHOLDS.apply) return "apply";
  if (confidence >= CONFIDENCE_THRESHOLDS.ask) return "ask";
  return "clarify";
}

export function actionMessage(action: ConfidenceAction, intent?: Intent): string {
  switch (action) {
    case "apply":
      return "i know what you mean.";
    case "ask":
      return intent
        ? `i think you meant to ${intent.type.replace(/_/g, " ")} — is that right?`
        : "i think i know what you mean — is that right?";
    case "clarify":
      return "i don't understand yet. let's clarify.";
  }
}

export function confidenceLabel(confidence: number): string {
  const percent = Math.round(confidence * 100);
  if (percent >= 85) return `${percent}% — i know what you mean`;
  if (percent >= 50) return `${percent}% — i think you meant...`;
  return `${percent}% — let's clarify`;
}

export function shouldApplyImmediately(confidence: number): boolean {
  return decideAction(confidence) === "apply";
}

export function intentConfidence(intent: Intent): number {
  return intent.confidence;
}