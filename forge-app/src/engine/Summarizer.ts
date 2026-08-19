import type { TodayPlan, TrustScore } from "../types/todayPlan";

const MOMENTUM_SENTENCES = [
  "today is about protecting momentum.",
  "today is about finishing what you already started.",
  "today is about building consistency.",
  "today is about keeping promises to yourself.",
  "today is about showing up.",
];

const RECOVERY_SENTENCES = [
  "today is a fresh start.",
  "today is about rebuilding trust.",
  "today is about small wins.",
  "today is about progress, not perfection.",
  "today is about moving forward.",
];

const STRONG_SENTENCES = [
  "today is about maintaining your rhythm.",
  "today is about trust built over time.",
  "today is about protecting what works.",
  "today is about steady progress.",
  "today is about your commitment to yourself.",
];

export function generateMorningSentence(
  plan: TodayPlan,
  trustScore: TrustScore
): string {
  const commitmentCount = plan.commitments.length;
  const hasHighPriority = plan.commitments.some((c) => c.priority === "high");
  const score = trustScore.current;

  if (commitmentCount === 0) {
    return "today is a fresh start.";
  }

  if (score < 40) {
    return pickRandom(RECOVERY_SENTENCES);
  }

  if (score >= 70 && hasHighPriority) {
    return pickRandom(MOMENTUM_SENTENCES);
  }

  if (score >= 50) {
    return pickRandom(STRONG_SENTENCES);
  }

  return pickRandom(MOMENTUM_SENTENCES);
}

export function generateDaySummary(plan: TodayPlan): string {
  const count = plan.commitments.length;
  const highPriority = plan.commitments.filter((c) => c.priority === "high").length;

  if (count === 0) {
    return "no commitments scheduled.";
  }

  if (highPriority > 0) {
    return `${count} commitments today, ${highPriority} protected.`;
  }

  return `${count} commitments today.`;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
