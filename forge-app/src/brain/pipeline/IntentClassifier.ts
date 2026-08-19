import type { StructuredConstraint } from "../types";
import { resolveEntity } from "./EntityExtractor";
import { extractQuantity } from "./QuantityExtractor";
import { extractTimes } from "./TimeExtractor";
import { extractConstraints } from "./ConstraintExtractor";
import { detectDayExpression } from "./TimeExpressions";

export type IntentType = "fixed_event" | "task" | "ignore";

export interface ClassifiedSentence {
  original: string;
  cleaned: string;
  intent: IntentType;
  entity: string | null;
  startTime?: string;
  endTime?: string;
  approximate?: boolean;
  quantity?: number;
  unit?: string;
  constraints: StructuredConstraint[];
  daysFromNow?: number;
}

function hasExplicitTime(text: string): boolean {
  return /\d{1,2}\s*(?:am|pm)?\s*-\s*\d{1,2}\s*(?:am|pm)?/i.test(text)
    || /(?:from|between)\s+\d/.test(text)
    || /(?:until|till)\s+\d/.test(text)
    || /\bat\s+\d/.test(text)
    || /(?:from|between)\s+\w+\s+(?:to|and|until|till)\s+\w+/i.test(text);
}

export function classifySentence(cleaned: string, original: string): ClassifiedSentence {
  const entity = resolveEntity(cleaned);
  const times = extractTimes(cleaned);
  const quantity = extractQuantity(cleaned);
  const constraints = extractConstraints(cleaned);
  const hasTime = hasExplicitTime(cleaned);
  const { daysFromNow } = detectDayExpression(cleaned);

  let intent: IntentType = "ignore";

  if (entity) {
    if (hasTime || times.startTime || times.endTime) {
      intent = "fixed_event";
    } else {
      intent = "task";
    }
  }

  return {
    original,
    cleaned,
    intent,
    entity,
    startTime: times.startTime,
    endTime: times.endTime,
    approximate: times.approximate,
    quantity: quantity?.value,
    unit: quantity?.unit,
    constraints,
    daysFromNow: daysFromNow > 0 ? daysFromNow : undefined,
  };
}
