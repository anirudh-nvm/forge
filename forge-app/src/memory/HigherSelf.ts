import type { TrustScore } from "../types/todayPlan";
import type { Observation } from "../observation/ObservationTypes";
import type { Milestone } from "./MilestoneEngine";

export interface HigherSelfMessage {
  id: string;
  text: string;
  weight: "light" | "medium" | "heavy";
  category: "growth" | "setback" | "consistency" | "milestone" | "quiet";
  createdAt: string;
}

export interface HigherSelfContext {
  trustScore: TrustScore;
  observations: Observation[];
  milestones: Milestone[];
  daysSinceFirstUse: number;
  lastHigherSelfDate?: string;
  now: Date;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function shouldSpeak(ctx: HigherSelfContext): boolean {
  if (!ctx.lastHigherSelfDate) return true;
  const last = new Date(ctx.lastHigherSelfDate);
  const days = daysBetween(ctx.now, last);
  return days >= 7;
}

function detectGrowthMessage(ctx: HigherSelfContext): HigherSelfMessage | null {
  const history = ctx.trustScore.history;
  if (history.length < 20) return null;

  const recent = history.slice(-10);
  const older = history.slice(-20, -10);

  const recentAvg = recent.reduce((s, e) => s + e.trustChange, 0) / recent.length;
  const olderAvg = older.reduce((s, e) => s + e.trustChange, 0) / older.length;

  if (recentAvg > olderAvg + 1) {
    return {
      id: `hs_${Date.now()}`,
      text: `I've been watching quietly. You're becoming much more consistent than you were two months ago. Don't lose that.`,
      weight: "heavy",
      category: "growth",
      createdAt: ctx.now.toISOString(),
    };
  }

  return null;
}

function detectSetbackMessage(ctx: HigherSelfContext): HigherSelfMessage | null {
  const history = ctx.trustScore.history;
  if (history.length < 15) return null;

  const recent = history.slice(-5);
  const skips = recent.filter((e) => e.outcome === "skipped").length;

  if (skips >= 3) {
    return {
      id: `hs_${Date.now()}`,
      text: "I noticed the last few days have been hard. That's okay. One small commitment today changes the direction.",
      weight: "medium",
      category: "setback",
      createdAt: ctx.now.toISOString(),
    };
  }

  return null;
}

function detectConsistencyMessage(ctx: HigherSelfContext): HigherSelfMessage | null {
  const history = ctx.trustScore.history;
  if (history.length < 10) return null;

  const recent = history.slice(-10);
  const completions = recent.filter((e) => e.outcome === "completed").length;

  if (completions >= 8) {
    return {
      id: `hs_${Date.now()}`,
      text: `You've completed ${completions} of your last 10 sessions. That level of consistency is rare. Keep going.`,
      weight: "medium",
      category: "consistency",
      createdAt: ctx.now.toISOString(),
    };
  }

  return null;
}

function detectMilestoneMessage(ctx: HigherSelfContext): HigherSelfMessage | null {
  const heavy = ctx.milestones.filter((m) => m.weight >= 8);
  if (heavy.length === 0) return null;

  const milestone = heavy[0];
  return {
    id: `hs_${Date.now()}`,
    text: `${milestone.title}. ${milestone.description}`,
    weight: "heavy",
    category: "milestone",
    createdAt: ctx.now.toISOString(),
  };
}

function detectQuietMessage(ctx: HigherSelfContext): HigherSelfMessage | null {
  if (ctx.daysSinceFirstUse < 30) return null;

  const months = Math.floor(ctx.daysSinceFirstUse / 30);
  if (months >= 1 && ctx.trustScore.current >= 60) {
    return {
      id: `hs_${Date.now()}`,
      text: `It's been ${months} month${months > 1 ? "s" : ""} since you started. Look how far you've come.`,
      weight: "light",
      category: "quiet",
      createdAt: ctx.now.toISOString(),
    };
  }

  return null;
}

export function generateHigherSelfMessage(ctx: HigherSelfContext): HigherSelfMessage | null {
  if (!shouldSpeak(ctx)) return null;

  const growth = detectGrowthMessage(ctx);
  if (growth) return growth;

  const setback = detectSetbackMessage(ctx);
  if (setback) return setback;

  const consistency = detectConsistencyMessage(ctx);
  if (consistency) return consistency;

  const milestone = detectMilestoneMessage(ctx);
  if (milestone) return milestone;

  const quiet = detectQuietMessage(ctx);
  if (quiet) return quiet;

  return null;
}
