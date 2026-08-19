import type { TrustScore } from "../types/todayPlan";
import type { Experiment } from "./ExperimentTypes";
import type { Observation } from "../observation/ObservationTypes";
import type { ReflectionMemory } from "../reflection/ReflectionTypes";

export type MilestoneCategory =
  | "first_use"
  | "session_count"
  | "trust_milestone"
  | "streak"
  | "experiment"
  | "setback"
  | "recovery"
  | "identity"
  | "consistency"
  | "monthly";

export interface Milestone {
  id: string;
  date: string;
  month: string;
  category: MilestoneCategory;
  title: string;
  description: string;
  weight: number;
  createdAt: string;
}

export interface MilestoneContext {
  trustScore: TrustScore;
  experiments: Experiment[];
  observations: Observation[];
  reflections: ReflectionMemory[];
  dayArchiveCount: number;
  totalSessions: number;
  firstUseDate?: string;
  now: Date;
}

function generateId(): string {
  return `ms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getMonth(date: Date): string {
  return date.toLocaleString("default", { month: "long", year: "numeric" });
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function detectFirstUse(ctx: MilestoneContext): Milestone | null {
  if (!ctx.firstUseDate) return null;
  const first = new Date(ctx.firstUseDate);
  const days = daysBetween(ctx.now, first);
  if (days > 1) return null;

  return {
    id: generateId(),
    date: ctx.firstUseDate,
    month: getMonth(first),
    category: "first_use",
    title: "Started Forge",
    description: "The beginning of something.",
    weight: 10,
    createdAt: ctx.now.toISOString(),
  };
}

function detectSessionMilestones(ctx: MilestoneContext): Milestone[] {
  const milestones: Milestone[] = [];
  const counts = [10, 25, 50, 100, 200, 500];

  for (const count of counts) {
    if (ctx.totalSessions === count) {
      milestones.push({
        id: generateId(),
        date: ctx.now.toISOString(),
        month: getMonth(ctx.now),
        category: "session_count",
        title: `${count} sessions completed`,
        description: `${count} promises kept. That's real commitment.`,
        weight: count >= 100 ? 8 : count >= 50 ? 6 : 4,
        createdAt: ctx.now.toISOString(),
      });
    }
  }

  return milestones;
}

function detectTrustMilestones(ctx: MilestoneContext): Milestone[] {
  const milestones: Milestone[] = [];
  const score = ctx.trustScore.current;
  const thresholds = [
    { value: 20, label: "trust reached 20", desc: "Rebuilding is happening." },
    { value: 40, label: "trust reached 40", desc: "You're developing real habits." },
    { value: 60, label: "trust reached 60", desc: "Trust is growing. Consistency is showing." },
    { value: 80, label: "trust reached 80", desc: "Strong trust. You've built something real." },
    { value: 90, label: "trust reached 90", desc: "Exceptional consistency." },
    { value: 100, label: "trust reached 100", desc: "Perfect trust. Unprecedented." },
  ];

  const prev = ctx.trustScore.history;
  if (prev.length < 2) return milestones;

  const prevScore = prev[prev.length - 2]
    ? ctx.trustScore.current - prev[prev.length - 1].trustChange
    : ctx.trustScore.current;

  for (const t of thresholds) {
    if (prevScore < t.value && score >= t.value) {
      milestones.push({
        id: generateId(),
        date: ctx.now.toISOString(),
        month: getMonth(ctx.now),
        category: "trust_milestone",
        title: t.label,
        description: t.desc,
        weight: t.value >= 80 ? 9 : t.value >= 60 ? 7 : 5,
        createdAt: ctx.now.toISOString(),
      });
    }
  }

  return milestones;
}

function detectStreaks(ctx: MilestoneContext): Milestone | null {
  const history = ctx.trustScore.history;
  if (history.length < 5) return null;

  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].outcome === "completed") streak++;
    else break;
  }

  const streakThresholds = [7, 14, 21, 30, 60, 90];
  if (!streakThresholds.includes(streak)) return null;

  return {
    id: generateId(),
    date: ctx.now.toISOString(),
    month: getMonth(ctx.now),
    category: "streak",
    title: `${streak}-day streak`,
    description: `${streak} days in a row. You're building something that lasts.`,
    weight: streak >= 30 ? 9 : streak >= 14 ? 7 : 5,
    createdAt: ctx.now.toISOString(),
  };
}

function detectExperiments(ctx: MilestoneContext): Milestone[] {
  const milestones: Milestone[] = [];

  const successful = ctx.experiments.filter((e) => e.outcome === "successful");
  for (const exp of successful) {
    const note = exp.notes.length > 0 ? exp.notes[0] : "";
    milestones.push({
      id: generateId(),
      date: exp.closedAt || ctx.now.toISOString(),
      month: getMonth(new Date(exp.closedAt || ctx.now)),
      category: "experiment",
      title: `"${exp.title}" succeeded`,
      description: note || "An experiment that taught you something real.",
      weight: 6,
      createdAt: ctx.now.toISOString(),
    });
  }

  return milestones;
}

function detectSetbacks(ctx: MilestoneContext): Milestone | null {
  const history = ctx.trustScore.history;
  if (history.length < 10) return null;

  const recent = history.slice(-10);
  const skips = recent.filter((e) => e.outcome === "skipped").length;
  if (skips < 4) return null;

  const prev = history.slice(-20, -10);
  const prevSkips = prev.filter((e) => e.outcome === "skipped").length;

  if (skips > prevSkips + 2) {
    return {
      id: generateId(),
      date: ctx.now.toISOString(),
      month: getMonth(ctx.now),
      category: "setback",
      title: "A difficult stretch",
      description: "Three weeks ago mornings were difficult. You've improved a lot.",
      weight: 3,
      createdAt: ctx.now.toISOString(),
    };
  }

  return null;
}

function detectRecovery(ctx: MilestoneContext): Milestone | null {
  const history = ctx.trustScore.history;
  if (history.length < 15) return null;

  const recent = history.slice(-5);
  const older = history.slice(-15, -10);

  const recentRate = recent.filter((e) => e.outcome === "completed").length / recent.length;
  const olderRate = older.filter((e) => e.outcome === "completed").length / older.length;

  if (recentRate >= 0.8 && olderRate < 0.5) {
    return {
      id: generateId(),
      date: ctx.now.toISOString(),
      month: getMonth(ctx.now),
      category: "recovery",
      title: "You turned it around",
      description: "After a rough patch, you rebuilt your consistency. That takes real strength.",
      weight: 7,
      createdAt: ctx.now.toISOString(),
    };
  }

  return null;
}

function detectConsistency(ctx: MilestoneContext): Milestone | null {
  const confirmedObs = ctx.observations.filter(
    (o) => o.category === "consistency" && o.confidence >= 0.8 && o.status === "confirmed"
  );

  if (confirmedObs.length < 3) return null;

  return {
    id: generateId(),
    date: ctx.now.toISOString(),
    month: getMonth(ctx.now),
    category: "consistency",
    title: "Patterns confirmed",
    description: `${confirmedObs.length} consistency patterns confirmed. Forge knows you better now.`,
    weight: 5,
    createdAt: ctx.now.toISOString(),
  };
}

export function detectMilestones(ctx: MilestoneContext): Milestone[] {
  const milestones: Milestone[] = [];

  const firstUse = detectFirstUse(ctx);
  if (firstUse) milestones.push(firstUse);

  milestones.push(...detectSessionMilestones(ctx));
  milestones.push(...detectTrustMilestones(ctx));

  const streak = detectStreaks(ctx);
  if (streak) milestones.push(streak);

  milestones.push(...detectExperiments(ctx));

  const setback = detectSetbacks(ctx);
  if (setback) milestones.push(setback);

  const recovery = detectRecovery(ctx);
  if (recovery) milestones.push(recovery);

  const consistency = detectConsistency(ctx);
  if (consistency) milestones.push(consistency);

  return milestones.sort((a, b) => b.weight - a.weight);
}
