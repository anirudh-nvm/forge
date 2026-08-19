import type { Commitment } from "../types/commitment";
import type { SessionOutcome } from "../types/todayPlan";

export interface PlanningEvent {
  id: string;
  date: string;
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  commitments: string[];
  completedCount: number;
  totalCount: number;
  completionRate: number;
  sessionOutcomes: SessionOutcome[];
  adjustments: number;
  createdAt: string;
}

export interface PlanningMemorySummary {
  preferredTimeWindow: "morning" | "afternoon" | "evening" | "night";
  timeWindowSuccessRate: number;
  avgCompletionRate: number;
  totalEvents: number;
  recentTrend: "improving" | "stable" | "declining";
}

function getTimeOfDay(hour: number): "morning" | "afternoon" | "evening" | "night" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function categorizeCommitments(commitments: Commitment[]): {
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  completed: number;
  total: number;
} {
  if (commitments.length === 0) {
    return { timeOfDay: "morning", completed: 0, total: 0 };
  }

  const startHour = new Date(commitments[0].startTime).getHours();
  const timeOfDay = getTimeOfDay(startHour);
  const completed = commitments.filter((c) => c.completed).length;

  return { timeOfDay, completed, total: commitments.length };
}

export function recordPlanningEvent(
  commitments: Commitment[],
  outcomes: SessionOutcome[],
  adjustments: number,
  date?: string
): PlanningEvent {
  const { timeOfDay, completed, total } = categorizeCommitments(commitments);
  const now = date || new Date().toISOString().split("T")[0];

  return {
    id: `pe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    date: now,
    timeOfDay,
    commitments: commitments.map((c) => c.title),
    completedCount: completed,
    totalCount: total,
    completionRate: total > 0 ? completed / total : 0,
    sessionOutcomes: outcomes,
    adjustments,
    createdAt: new Date().toISOString(),
  };
}

export function analyzePlanningMemory(events: PlanningEvent[]): PlanningMemorySummary {
  if (events.length === 0) {
    return {
      preferredTimeWindow: "morning",
      timeWindowSuccessRate: 0,
      avgCompletionRate: 0,
      totalEvents: 0,
      recentTrend: "stable",
    };
  }

  const byTime = {
    morning: events.filter((e) => e.timeOfDay === "morning"),
    afternoon: events.filter((e) => e.timeOfDay === "afternoon"),
    evening: events.filter((e) => e.timeOfDay === "evening"),
    night: events.filter((e) => e.timeOfDay === "night"),
  };

  const avgRate = (arr: PlanningEvent[]) =>
    arr.length > 0
      ? arr.reduce((s, e) => s + e.completionRate, 0) / arr.length
      : 0;

  const rates = {
    morning: avgRate(byTime.morning),
    afternoon: avgRate(byTime.afternoon),
    evening: avgRate(byTime.evening),
    night: avgRate(byTime.night),
  };

  const preferred = (Object.keys(rates) as Array<keyof typeof rates>).reduce((a, b) =>
    rates[a] >= rates[b] ? a : b
  ) as "morning" | "afternoon" | "evening" | "night";

  const sorted = [...events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const recentHalf = sorted.slice(Math.floor(sorted.length / 2));
  const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));

  const recentAvg = avgRate(recentHalf);
  const firstAvg = avgRate(firstHalf);
  const trendDiff = recentAvg - firstAvg;

  let trend: "improving" | "stable" | "declining" = "stable";
  if (trendDiff > 0.1) trend = "improving";
  else if (trendDiff < -0.1) trend = "declining";

  return {
    preferredTimeWindow: preferred,
    timeWindowSuccessRate: rates[preferred],
    avgCompletionRate: avgRate(events),
    totalEvents: events.length,
    recentTrend: trend,
  };
}
