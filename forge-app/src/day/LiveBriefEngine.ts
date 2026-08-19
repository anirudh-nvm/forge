import type { DayState, CommitmentRef, RecoveryRef } from "./DayStateTypes";
import type { TodayPlan } from "../types/todayPlan";
import type { MentorPersonality } from "../onboarding/OnboardingTypes";
import { timeToMinutes } from "./DayStateEngine";

export interface LiveBrief {
  headline: string;
  subheadline?: string;
  cta?: { label: string; action?: string };
}

function getUserName(plan: TodayPlan): string {
  return plan.summary.find((s) => s.includes("good morning"))?.split(",")[1]?.trim() || "there";
}

function getReminderLines(
  personality: MentorPersonality,
  title: string,
  mins: number
): { headline: string; subheadline?: string } {
  const quiet = `${title} starts in ${mins} minute${mins !== 1 ? "s" : ""}.`;
  const support = "let's keep today's promise.";
  const mentor = `you told me this matters. today's ${title} session is one more step toward that.`;

  switch (personality) {
    case "quiet":
      return { headline: quiet };
    case "mentor":
      return { headline: quiet, subheadline: mentor };
    case "supportive":
    default:
      return { headline: quiet, subheadline: support };
  }
}

export function generateLiveBrief(
  state: DayState,
  plan: TodayPlan,
  personality: MentorPersonality = "supportive"
): LiveBrief {
  const name = getUserName(plan);

  switch (state.phase) {
    case "before_day": {
      const next = state.nextCommitment;
      if (next) {
        return {
          headline: `good morning, ${name}.`,
          subheadline: `first up: ${next.title} at ${next.startTime}`,
        };
      }
      return {
        headline: `good morning, ${name}.`,
        subheadline: "no commitments today. enjoy the space.",
      };
    }

    case "before_commitment": {
      const next = state.nextCommitment!;
      const mins = state.timeUntilNext ?? 0;
      return getReminderLines(personality, next.title, mins);
    }

    case "recovery": {
      const recovery = state.recovery!;
      const mins = recovery.minutesRemaining;
      const next = state.nextCommitment;
      if (next) {
        return {
          headline: "welcome back.",
          subheadline: `take ${mins} minute${mins !== 1 ? "s" : ""} before ${next.title}.`,
        };
      }
      return {
        headline: "welcome back.",
        subheadline: `take ${mins} minute${mins !== 1 ? "s" : ""} to reset.`,
      };
    }

    case "active_commitment": {
      const current = state.currentCommitment!;
      const endMins = timeToMinutes(current.endTime);
      const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
      const remaining = endMins - nowMins;
      return {
        headline: `you're in ${current.title}.`,
        subheadline: `${remaining} minute${remaining !== 1 ? "s" : ""} remaining.`,
      };
    }

    case "between_commitments": {
      const next = state.nextCommitment;
      if (next) {
        return {
          headline: "nice work.",
          subheadline: `next up: ${next.title} at ${next.startTime}`,
        };
      }
      return {
        headline: "day complete.",
        subheadline: "no more commitments today.",
      };
    }

    case "day_complete": {
      const completedCount = state.currentCommitment ? 1 : 0;
      return {
        headline: "day complete.",
        subheadline: `${completedCount} commitment${completedCount !== 1 ? "s" : ""} kept.`,
        cta: { label: "reflect", action: "reflect" },
      };
    }
  }
}