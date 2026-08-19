import type { TodayPlan } from "../types/todayPlan";
import type { TrustScore } from "../types/todayPlan";
import type { Experiment } from "../memory/ExperimentTypes";
import type { LifeDirection, Goal } from "../identity/IdentityTypes";

export interface MorningBrief {
  greeting: string;
  focus: string;
  encouragement: string;
  reminder: string;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "good morning.";
  if (hour < 17) return "good afternoon.";
  return "good evening.";
}

function findTopCommitment(plan: TodayPlan) {
  const unlocked = plan.commitments.filter((c) => !c.locked);
  if (unlocked.length === 0) return plan.commitments[0];
  return unlocked[0];
}

function findNextHighPriority(plan: TodayPlan) {
  return plan.commitments.find((c) => c.priority === "high" && !c.completed);
}

function getTrustMessage(trust: TrustScore | null): string {
  if (!trust) return "";
  const { current } = trust;
  if (current >= 80) return "you've been building strong momentum.";
  if (current >= 60) return "you're making steady progress.";
  if (current >= 40) return "every step counts.";
  return "today is a fresh start.";
}

function getExperimentMessage(experiments: Experiment[]): string {
  const active = experiments.filter((e) => e.status === "active");
  if (active.length === 0) return "";
  if (active.length === 1) {
    return `you're continuing the ${active[0].title} experiment.`;
  }
  return `you're running ${active.length} experiments right now.`;
}

function getIdentityMessage(
  lifeDirections: LifeDirection[],
  goals: Goal[],
  plan: TodayPlan
): string {
  if (lifeDirections.length === 0) return "";

  const topDirection = lifeDirections[0];
  const directionGoals = goals.filter(
    (g) => g.lifeDirectionId === topDirection.id
  );

  if (directionGoals.length === 0) return "";

  const topGoal = directionGoals[0];
  return `completing today's tasks moves you closer to ${topGoal.title.toLowerCase()}.`;
}

function getFocusMessage(plan: TodayPlan): string {
  const top = findTopCommitment(plan) || findNextHighPriority(plan);
  if (!top) return "today is open. what matters most to you?";

  if (top.locked) {
    return `today your biggest commitment is ${top.title}.`;
  }

  return `today your biggest step is ${top.title}.`;
}

function getEncouragementMessage(
  trust: TrustScore | null,
  experiments: Experiment[]
): string {
  const trustMsg = getTrustMessage(trust);
  const expMsg = getExperimentMessage(experiments);

  if (trustMsg && expMsg) {
    return `${trustMsg} ${expMsg}`;
  }
  return trustMsg || expMsg || "let's see what today brings.";
}

function getReminderMessage(plan: TodayPlan): string {
  const unscheduled = plan.unscheduled;
  if (unscheduled.length === 0) {
    return "everything fits. let's make it count.";
  }

  const titles = unscheduled.map((u) => u.title).join(", ");
  return `${titles} couldn't fit today. we'll try again tomorrow.`;
}

export function generateMorningBrief(
  plan: TodayPlan,
  trust: TrustScore | null,
  experiments: Experiment[],
  lifeDirections: LifeDirection[],
  goals: Goal[]
): MorningBrief {
  return {
    greeting: getTimeGreeting(),
    focus: getFocusMessage(plan),
    encouragement: getEncouragementMessage(trust, experiments),
    reminder: getReminderMessage(plan),
  };
}
