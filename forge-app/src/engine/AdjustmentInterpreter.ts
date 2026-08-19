import type { TodayPlan } from "../types/todayPlan";
import type { Commitment } from "../types/commitment";
import type { Adjustment } from "./AdjustmentEngine";
import { extractEntities } from "../brain/pipeline/EntityExtractor";
import { extractTimes } from "../brain/pipeline/TimeExtractor";
import { parseTimeToMinutes as toMinutes, formatTime } from "../utils/timeUtils";

export type AdjustmentInterpretation = {
  adjustments: Adjustment[];
  explanation: string;
};

const CANCEL_WORDS =
  /\b(cancel|cancelled|canceled|remove|delete|skip|drop|scrap|call off|call-off|off|no)\b/i;

const MOVE_LATER_WORDS =
  /\b(move|push|shift|postpone|reschedule|delay)\b.*\b(later|back|after|to)\b/i;

const MOVE_EARLIER_WORDS =
  /\b(move|push|shift|reschedule)\b.*\b(earlier|before|ahead)\b/i;

const MOVE_LATER_SHORT = /\b(move|push|shift|postpone|delay)\b/i;
const MOVE_EARLIER_SHORT = /\b(move|push|shift)\b.*\b(earlier|before)\b/i;

const ADD_WORDS =
  /\b(add|include|insert|also|need to|have to|want to|schedule)\b/i;

const TIRED_WORDS =
  /\b(tired|exhausted|drained|burned out|not feeling well|sick|unwell|low energy)\b/i;

const MORE_TIME_WORDS =
  /\b(more time|another hour|longer|extend|an hour more|extra time|few more)\b/i;

function commitmentKeywords(title: string): string[] {
  const lower = title.toLowerCase();
  const words = lower.split(/[^a-z]+/).filter((w) => w.length > 1);
  return words;
}

function findCommitment(plan: TodayPlan, entityName: string, rawInput: string): Commitment | undefined {
  const normalized = entityName.toLowerCase();

  const byEntity = plan.commitments.find(
    (c) => c.title.toLowerCase() === normalized
  );
  if (byEntity) return byEntity;

  const byKeywords = plan.commitments.find((c) => {
    const keywords = commitmentKeywords(c.title);
    return keywords.some((k) => normalized.includes(k) || rawInput.includes(k));
  });
  return byKeywords;
}

function detectAddTask(plan: TodayPlan, input: string): Adjustment | null {
  if (!ADD_WORDS.test(input)) return null;

  const entities = extractEntities(input);
  for (const entity of entities) {
    const alreadyPlanned = plan.commitments.some(
      (c) => c.title.toLowerCase() === entity.normalized.toLowerCase()
    );
    if (!alreadyPlanned) {
      const times = extractTimes(input);
      return {
        type: "addTask",
        title: entity.normalized,
        startTime: times.startTime ?? "7:00 PM",
        endTime: times.endTime ?? "8:00 PM",
        priority: "medium",
      };
    }
  }

  return null;
}

function detectDurationExtension(plan: TodayPlan, input: string): Adjustment | null {
  if (!MORE_TIME_WORDS.test(input)) return null;

  const entities = extractEntities(input);
  const target = plan.commitments.find((c) =>
    entities.some(
      (e) => e.normalized.toLowerCase() === c.title.toLowerCase()
    )
  );

  if (target && !target.locked) {
    return { type: "updateDuration", taskId: target.id, minutes: 60 };
  }

  const lastFlexible = [...plan.commitments]
    .reverse()
    .find((c) => !c.locked);
  if (lastFlexible) {
    return { type: "updateDuration", taskId: lastFlexible.id, minutes: 60 };
  }

  return null;
}

function detectMove(plan: TodayPlan, input: string): Adjustment | null {
  const entities = extractEntities(input);
  if (entities.length === 0) return null;

  const target = plan.commitments.find((c) =>
    entities.some((e) => e.normalized.toLowerCase() === c.title.toLowerCase())
  );
  if (!target || target.locked) return null;

  if (MOVE_EARLIER_SHORT.test(input) && !MOVE_LATER_WORDS.test(input)) {
    return { type: "moveEarlier", taskId: target.id, minutes: 60 };
  }

  if (MOVE_LATER_SHORT.test(input)) {
    return { type: "moveLater", taskId: target.id, minutes: 60 };
  }

  return null;
}

function detectCancel(plan: TodayPlan, input: string): Adjustment | null {
  if (!CANCEL_WORDS.test(input)) return null;

  const entities = extractEntities(input);
  if (entities.length === 0) return null;

  const target = plan.commitments.find((c) =>
    entities.some((e) => e.normalized.toLowerCase() === c.title.toLowerCase())
  );
  if (!target || target.locked) return null;

  return { type: "delete", taskId: target.id };
}

function detectTired(plan: TodayPlan): Adjustment | null {
  const optional = plan.commitments.find(
    (c) => !c.locked && c.priority !== "high"
  );
  if (!optional) return null;
  return { type: "delete", taskId: optional.id };
}

function minutesBetween(start: string, end: string): number {
  return Math.max(toMinutes(end) - toMinutes(start), 0);
}

export function interpretAdjustment(
  plan: TodayPlan,
  input: string
): AdjustmentInterpretation {
  const trimmed = input.trim().toLowerCase();
  const adjustments: Adjustment[] = [];

  if (trimmed.length === 0) {
    return { adjustments: [], explanation: "nothing changed." };
  }

  if (TIRED_WORDS.test(trimmed)) {
    const tiredAdjustment = detectTired(plan);
    if (tiredAdjustment) {
      adjustments.push(tiredAdjustment);
      return {
        adjustments,
        explanation:
          "i hear you. i dropped a lower-priority commitment so today feels lighter.",
      };
    }
  }

  const cancel = detectCancel(plan, trimmed);
  if (cancel) {
    adjustments.push(cancel);
    const title = plan.commitments.find((c) => c.id === (cancel as { taskId: string }).taskId)?.title;
    return {
      adjustments,
      explanation: `i removed ${title?.toLowerCase() ?? "that commitment"} from today.`,
    };
  }

  const move = detectMove(plan, trimmed);
  if (move) {
    adjustments.push(move);
    const target = plan.commitments.find(
      (c) => c.id === (move as { taskId: string }).taskId
    );
    const direction = MOVE_EARLIER_SHORT.test(trimmed) ? "earlier" : "later";
    return {
      adjustments,
      explanation: `i moved ${target?.title.toLowerCase() ?? "it"} ${direction} by an hour.`,
    };
  }

  const duration = detectDurationExtension(plan, trimmed);
  if (duration) {
    adjustments.push(duration);
    return {
      adjustments,
      explanation: "i gave that commitment an extra hour.",
    };
  }

  const add = detectAddTask(plan, trimmed);
  if (add) {
    adjustments.push(add);
    return {
      adjustments,
      explanation: `i added ${(add as { title: string }).title.toLowerCase()} to today.`,
    };
  }

  return {
    adjustments,
    explanation: "i didn't find anything to change. try mentioning a commitment by name.",
  };
}

export function buildAdjustmentSummary(
  plan: TodayPlan,
  adjustments: Adjustment[]
): string {
  if (adjustments.length === 0) return "no changes";

  const parts = adjustments.map((adjustment) => {
    switch (adjustment.type) {
      case "moveEarlier": {
        const c = plan.commitments.find((x) => x.id === adjustment.taskId);
        return `move ${c?.title ?? "task"} earlier`;
      }
      case "moveLater": {
        const c = plan.commitments.find((x) => x.id === adjustment.taskId);
        return `move ${c?.title ?? "task"} later`;
      }
      case "delete": {
        const c = plan.commitments.find((x) => x.id === adjustment.taskId);
        return `remove ${c?.title ?? "task"}`;
      }
      case "addTask":
        return `add ${adjustment.title}`;
      case "updateDuration": {
        const c = plan.commitments.find((x) => x.id === adjustment.taskId);
        return `extend ${c?.title ?? "task"} by ${adjustment.minutes} min`;
      }
      default:
        return adjustment.type;
    }
  });

  return parts.join(", ");
}

export function describePlanChange(
  before: TodayPlan,
  after: TodayPlan,
  adjustments: Adjustment[]
): { before: string[]; after: string[] } {
  const beforeLines = before.commitments.map(
    (c) => `${c.title} — ${c.startTime} to ${c.endTime}`
  );
  const afterLines = after.commitments.map(
    (c) => `${c.title} — ${c.startTime} to ${c.endTime}`
  );

  const changed = adjustments.some((a) => a.type !== "delete");
  return { before: beforeLines, after: changed ? afterLines : beforeLines };
}

export function getFreeSlot(
  plan: TodayPlan,
  durationMinutes: number,
  fromMinute: number
): { startTime: string; endTime: string } | null {
  const sorted = [...plan.commitments]
    .map((c) => ({
      start: toMinutes(c.startTime),
      end: toMinutes(c.endTime),
      title: c.title,
    }))
    .sort((a, b) => a.start - b.start);

  let cursor = Math.max(fromMinute, 7 * 60);

  for (const block of sorted) {
    if (cursor + durationMinutes <= block.start) {
      break;
    }
    cursor = Math.max(cursor, block.end);
  }

  if (cursor + durationMinutes > 24 * 60) return null;
  return {
    startTime: formatTime(cursor / 60),
    endTime: formatTime((cursor + durationMinutes) / 60),
  };
}