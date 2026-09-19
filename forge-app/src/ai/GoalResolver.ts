import type { TodayPlan } from "../types/todayPlan";
import type { GoalType } from "./IntentTypes";
import { parseTimeToMinutes as toMinutes, formatTime } from "../utils/timeUtils";
import type { Commitment } from "../types/commitment";

const STUDY_KEYWORDS = ["dsa", "cat", "study", "revision", "exam", "homework", "assignment", "prep", "pyq", "answer writing"];
const HEALTH_KEYWORDS = ["gym", "walk", "run", "yoga", "stretch", "meditation", "swim"];

function isStudy(commitment: Commitment): boolean {
  const lower = commitment.title.toLowerCase();
  return STUDY_KEYWORDS.some((k) => lower.includes(k));
}

function isHealth(commitment: Commitment): boolean {
  const lower = commitment.title.toLowerCase();
  return HEALTH_KEYWORDS.some((k) => lower.includes(k));
}

function shortenCommitment(plan: TodayPlan, title: string, byMinutes: number): TodayPlan {
  const newPlan = structuredClone(plan);
  const c = newPlan.commitments.find((x) => x.title.toLowerCase() === title.toLowerCase());
  if (!c || c.locked) return newPlan;

  const start = toMinutes(c.startTime);
  const end = toMinutes(c.endTime);
  const newEnd = Math.max(start + 30, end - byMinutes);
  c.endTime = formatTime(newEnd / 60);
  return newPlan;
}

function removeCommitment(plan: TodayPlan, title: string): TodayPlan {
  const newPlan = structuredClone(plan);
  newPlan.commitments = newPlan.commitments.filter(
    (c) => c.title.toLowerCase() !== title.toLowerCase() || c.locked
  );
  return newPlan;
}

function moveToEndOfDay(plan: TodayPlan, title: string): TodayPlan {
  const newPlan = structuredClone(plan);
  const c = newPlan.commitments.find((x) => x.title.toLowerCase() === title.toLowerCase());
  if (!c || c.locked) return newPlan;

  const duration = toMinutes(c.endTime) - toMinutes(c.startTime);
  const lastEnd = Math.max(
    ...newPlan.commitments
      .filter((x) => x.id !== c.id)
      .map((x) => toMinutes(x.endTime)),
    22 * 60
  );
  const newStart = Math.max(toMinutes(c.startTime), lastEnd - duration);
  c.startTime = formatTime(newStart / 60);
  c.endTime = formatTime((newStart + duration) / 60);
  return newPlan;
}

export function resolveGoal(plan: TodayPlan, goal: GoalType, reason: string): {
  plan: TodayPlan;
  changes: string[];
} {
  const changes: string[] = [];
  let newPlan = structuredClone(plan);

  switch (goal) {
    case "reduce_load": {
      const studyTasks = newPlan.commitments.filter((c) => !c.locked && isStudy(c));
      if (studyTasks.length > 0) {
        const longest = studyTasks.reduce((a, b) => {
          const durA = toMinutes(a.endTime) - toMinutes(a.startTime);
          const durB = toMinutes(b.endTime) - toMinutes(b.startTime);
          return durA > durB ? a : b;
        });
        newPlan = shortenCommitment(newPlan, longest.title, 30);
        changes.push(`shortened ${longest.title} by 30 minutes`);
      }
      const healthTasks = newPlan.commitments.filter((c) => !c.locked && isHealth(c));
      if (healthTasks.length > 1) {
        const last = healthTasks[healthTasks.length - 1];
        newPlan = removeCommitment(newPlan, last.title);
        changes.push(`removed ${last.title} to reduce load`);
      }
      break;
    }
    case "lighter_day": {
      const unlocked = newPlan.commitments.filter((c) => !c.locked);
      for (const c of unlocked) {
        const duration = toMinutes(c.endTime) - toMinutes(c.startTime);
        if (duration > 60) {
          newPlan = shortenCommitment(newPlan, c.title, Math.round(duration * 0.25));
          changes.push(`shortened ${c.title}`);
        }
      }
      break;
    }
    case "postpone_heavy": {
      const studyTasks = newPlan.commitments.filter((c) => !c.locked && isStudy(c));
      for (const c of studyTasks) {
        newPlan = moveToEndOfDay(newPlan, c.title);
        changes.push(`moved ${c.title} to later`);
      }
      break;
    }
    case "skip_day": {
      const unlocked = newPlan.commitments.filter((c) => !c.locked);
      for (const c of unlocked) {
        newPlan = removeCommitment(newPlan, c.title);
        changes.push(`removed ${c.title}`);
      }
      break;
    }
    case "reschedule_study": {
      const studyTasks = newPlan.commitments.filter((c) => !c.locked && isStudy(c));
      for (const c of studyTasks) {
        newPlan = moveToEndOfDay(newPlan, c.title);
        changes.push(`moved ${c.title} to later`);
      }
      break;
    }
  }

  return { plan: newPlan, changes };
}
