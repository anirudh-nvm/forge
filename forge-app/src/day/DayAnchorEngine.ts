import type { DayAnchor, DayAnchorType } from "./DayAnchorTypes";
import type { TodayPlan } from "../types/todayPlan";
import { parseTimeToDecimal } from "../utils/timeUtils";

export const DEFAULT_ANCHOR_TIMES: Record<DayAnchorType, string> = {
  wake: "7:30 AM",
  breakfast: "8:30 AM",
  lunch: "1:00 PM",
  dinner: "8:00 PM",
  bedtime: "11:00 PM",
};

const ANCHOR_TITLE_MAP: Record<string, DayAnchorType> = {
  wake: "wake",
  "wake up": "wake",
  waking: "wake",
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  bedtime: "bedtime",
  bed: "bedtime",
  sleep: "bedtime",
};

export function detectAnchorType(title: string): DayAnchorType | null {
  const lower = title.toLowerCase().trim();
  return ANCHOR_TITLE_MAP[lower] ?? null;
}

export function generateAnchors(plan: TodayPlan): DayAnchor[] {
  const overrides: Partial<Record<DayAnchorType, string>> = {};

  for (const commitment of plan.commitments) {
    const type = detectAnchorType(commitment.title);
    if (type) {
      overrides[type] = commitment.startTime;
    }
  }

  const anchors: DayAnchor[] = (Object.keys(DEFAULT_ANCHOR_TIMES) as DayAnchorType[]).map(type => ({
    id: `anchor-${type}`,
    type,
    time: overrides[type] ?? DEFAULT_ANCHOR_TIMES[type],
    locked: overrides[type] !== undefined,
  }));

  return anchors.sort(
    (a, b) => parseTimeToDecimal(a.time) - parseTimeToDecimal(b.time)
  );
}