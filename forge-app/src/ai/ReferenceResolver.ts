import type { TodayPlan } from "../types/todayPlan";
import type { Commitment } from "../types/commitment";
import type { ConversationMemory } from "./ConversationMemory";
import { parseTimeToMinutes as toMinutes } from "../utils/timeUtils";

const REFERENCE_PRONOUNS = /\b(it|that|this|them|those)\b/i;
const REFERENCE_PHRASES = /\b(the session|the meeting|the class|the workout|the study|the prep|the exam|the assignment)\b/i;

function findCurrentActivity(plan: TodayPlan, now: Date): Commitment | null {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const ongoing = plan.commitments.find((c) => {
    const start = toMinutes(c.startTime);
    const end = toMinutes(c.endTime);
    return currentMinutes >= start && currentMinutes <= end;
  });
  if (ongoing) return ongoing;

  const upcoming = plan.commitments
    .filter((c) => toMinutes(c.startTime) > currentMinutes)
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  if (upcoming.length > 0) return upcoming[0];

  const recent = plan.commitments
    .filter((c) => toMinutes(c.endTime) <= currentMinutes)
    .sort((a, b) => toMinutes(b.endTime) - toMinutes(a.endTime));
  if (recent.length > 0) return recent[0];

  return null;
}

function findRecentTopic(memory: ConversationMemory): string | null {
  const recent = [...memory.turns].reverse().slice(0, 5);
  for (const turn of recent) {
    if (turn.intent && "target" in turn.intent && turn.intent.target) {
      return String(turn.intent.target);
    }
    if (turn.intent && "title" in turn.intent && turn.intent.title) {
      return String(turn.intent.title);
    }
  }
  return null;
}

export function resolveReference(
  input: string,
  plan: TodayPlan,
  memory: ConversationMemory,
  now: Date
): { resolved: string; target: Commitment | null } {
  const hasReference = REFERENCE_PRONOUNS.test(input) || REFERENCE_PHRASES.test(input);
  if (!hasReference) {
    return { resolved: input, target: null };
  }

  const currentActivity = findCurrentActivity(plan, now);
  if (currentActivity) {
    const pronoun = input.match(REFERENCE_PRONOUNS)?.[0] ?? input.match(REFERENCE_PHRASES)?.[0] ?? "it";
    const resolved = input.replace(REFERENCE_PRONOUNS, currentActivity.title.toLowerCase())
      .replace(REFERENCE_PHRASES, currentActivity.title.toLowerCase());
    return { resolved, target: currentActivity };
  }

  const recentTopic = findRecentTopic(memory);
  if (recentTopic) {
    const resolved = input.replace(REFERENCE_PRONOUNS, recentTopic.toLowerCase())
      .replace(REFERENCE_PHRASES, recentTopic.toLowerCase());
    const target = plan.commitments.find(
      (c) => c.title.toLowerCase() === recentTopic.toLowerCase()
    );
    return { resolved, target: target ?? null };
  }

  return { resolved: input, target: null };
}
