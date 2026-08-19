import type { MemoryProfile } from "../memory/MemoryProfile";
import type { Observation } from "../observation/ObservationTypes";
import type { Experiment } from "../memory/ExperimentTypes";
import type { TrustScore } from "../types/todayPlan";
import type { PlanningMemorySummary } from "../memory/PlanningMemory";

export interface ForgeMomentInput {
  memory: MemoryProfile;
  observations: Observation[];
  experiments: Experiment[];
  trust: TrustScore;
  planningMemory: PlanningMemorySummary;
  todayPlan: { commitments: { title: string; completed: boolean }[] };
}

export interface ForgeMoment {
  greeting: string;
  observation: string;
  question: string;
  timestamp: string;
}

function getTimeGreeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function findNotablePattern(observations: Observation[]): Observation | null {
  const highConf = observations
    .filter((o) => o.confidence >= 0.7 && o.status !== "dismissed")
    .sort((a, b) => b.confidence - a.confidence);

  return highConf[0] || null;
}

function findConsistencyWin(observations: Observation[]): string | null {
  const consistencyObs = observations.filter(
    (o) =>
      o.category === "timing" &&
      o.confidence >= 0.7 &&
      o.metadata?.trendDirection === "up" &&
      o.metadata?.commitmentTitle
  );

  if (consistencyObs.length === 0) return null;

  const obs = consistencyObs[0];
  const title = obs.metadata!.commitmentTitle!;
  const sampleSize = obs.metadata?.sampleSize || 4;

  return `The last ${sampleSize} times you've planned ${title}, you've completed it.`;
}

function findPlanningInsight(planningMemory: PlanningMemorySummary): string | null {
  if (planningMemory.totalEvents < 3) return null;

  const rate = Math.round(planningMemory.timeWindowSuccessRate * 100);
  if (rate >= 70) {
    return `${planningMemory.preferredTimeWindow} plans work ${rate}% of the time for you.`;
  }

  return null;
}

function buildIdentityQuestion(
  memory: MemoryProfile,
  trust: TrustScore
): string | null {
  const activeGoals = memory.working.activeGoals;
  if (activeGoals.length === 0) return null;

  const goal = activeGoals[0];
  return `One focused session on ${goal} tomorrow moves you closer to becoming who you're trying to be.`;
}

export function generateForgeMoment(input: ForgeMomentInput): ForgeMoment {
  const now = new Date();
  const greeting = getTimeGreeting(now);

  const consistencyWin = findConsistencyWin(input.observations);
  const planningInsight = findPlanningInsight(input.planningMemory);
  const identityQuestion = buildIdentityQuestion(input.memory, input.trust);

  let observation = "";
  let question = "";

  if (consistencyWin) {
    observation = `I noticed something. ${consistencyWin}`;
    question = "Would you like me to keep protecting that time?";
  } else if (planningInsight) {
    observation = `Here's what I see: ${planningInsight}`;
    question = "Should we try that again tomorrow?";
  } else if (identityQuestion) {
    observation = identityQuestion;
    question = "Would protecting tomorrow morning help?";
  } else {
    const completed = input.todayPlan.commitments.filter((c) => c.completed).length;
    if (completed > 0) {
      observation = `You completed ${completed} commitment${completed > 1 ? "s" : ""} today.`;
      question = "That's real progress. Want to note what worked?";
    } else {
      observation = "I'm here. What's on your mind?";
      question = "";
    }
  }

  return {
    greeting,
    observation,
    question,
    timestamp: now.toISOString(),
  };
}
