import type { StructuredConstraint } from "../types";
import { resolveEntity } from "./EntityExtractor";
import { extractQuantity } from "./QuantityExtractor";
import { extractTimes } from "./TimeExtractor";
import { extractConstraints } from "./ConstraintExtractor";
import { detectDayExpression } from "./TimeExpressions";
import { DEFAULT_ANCHOR_TIMES } from "../../day/DayAnchorEngine";

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

const MEAL_DURATIONS: Record<string, number> = {
  dinner: 60,
  lunch: 60,
  breakfast: 30,
};

function computeMealEnd(mealKey: string, startTime: string): string {
  const match = startTime.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)/i);
  if (!match) return startTime;
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  const totalMinutes = hours * 60 + minutes + (MEAL_DURATIONS[mealKey] ?? 60);
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  const endPeriod = endH >= 12 ? "PM" : "AM";
  const displayH = endH > 12 ? endH - 12 : endH === 0 ? 12 : endH;
  return endM === 0 ? `${displayH}:00 ${endPeriod}` : `${displayH}:${String(endM).padStart(2, "0")} ${endPeriod}`;
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
  let anchorTime: string | undefined;
  let mealKey: string | undefined;

  if (entity) {
    const mealMap: Record<string, string> = {
      Dinner: "dinner",
      Lunch: "lunch",
      Breakfast: "breakfast",
    };
    mealKey = mealMap[entity];
    if (mealKey && !hasTime && !times.startTime && !times.endTime) {
      intent = "fixed_event";
      anchorTime = DEFAULT_ANCHOR_TIMES[mealKey as keyof typeof DEFAULT_ANCHOR_TIMES];
    } else if (hasTime || times.startTime || times.endTime) {
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
    startTime: times.startTime || anchorTime,
    endTime: times.endTime || (mealKey && anchorTime ? computeMealEnd(mealKey, anchorTime) : undefined),
    approximate: times.approximate,
    quantity: quantity?.value,
    unit: quantity?.unit,
    constraints,
    daysFromNow: daysFromNow > 0 ? daysFromNow : undefined,
  };
}
