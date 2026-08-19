import type { MemoryProfile, StableMemory, WorkingMemory, RecentMemory } from "../memory/MemoryProfile";
import type { Observation } from "../observation/ObservationTypes";
import type { Experiment } from "../memory/ExperimentTypes";
import type { TrustScore } from "../types/todayPlan";
import type { TodayPlan } from "../types/todayPlan";
import type { Commitment } from "../types/commitment";

export interface CurrentMoment {
  now: Date;
  todayPlan: TodayPlan;
  memory: MemoryProfile;
  observations: Observation[];
  experiments: Experiment[];
  trust: TrustScore;
}

export interface RelevantContext {
  identity: {
    values: string[];
    priorities: string[];
    lifeSeason: string;
    rhythm: StableMemory["rhythm"];
  };
  currentSession: {
    activeCommitment: Commitment | null;
    upcomingCommitments: Commitment[];
    completedToday: Commitment[];
  };
  workingMemory: WorkingMemory;
  relevantObservations: Observation[];
  activeExperiments: Experiment[];
  recentReflections: string[];
  trust: {
    score: number;
    level: string;
    trajectory: "improving" | "stable" | "declining";
  };
  todaySummary: {
    completed: number;
    total: number;
    percentComplete: number;
  };
}

function getTrajectory(history: TrustScore["history"]): "improving" | "stable" | "declining" {
  const recent = history.slice(-5);
  if (recent.length < 2) return "stable";
  const avg = recent.reduce((s, e) => s + e.trustChange, 0) / recent.length;
  if (avg > 2) return "improving";
  if (avg < -2) return "declining";
  return "stable";
}

function getTrustLevel(score: number): string {
  if (score >= 80) return "strong";
  if (score >= 60) return "building";
  if (score >= 40) return "developing";
  if (score >= 20) return "recovering";
  return "rebuilding";
}

function scoreObservationRelevance(obs: Observation, moment: CurrentMoment): number {
  let score = 0;
  const now = moment.now;

  const daysSinceSeen = Math.floor(
    (now.getTime() - new Date(obs.lastSeen).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceSeen <= 1) score += 0.3;
  else if (daysSinceSeen <= 3) score += 0.2;
  else if (daysSinceSeen <= 7) score += 0.1;

  if (obs.confidence >= 0.7) score += 0.2;
  else if (obs.confidence >= 0.5) score += 0.1;

  if (obs.status === "new") score += 0.1;
  if (obs.status === "confirmed") score += 0.15;

  for (const commitment of moment.todayPlan.commitments) {
    if (obs.metadata?.commitmentTitle === commitment.title) {
      score += 0.3;
    }
  }

  return score;
}

export function buildContext(moment: CurrentMoment): RelevantContext {
  const now = moment.now;
  const plan = moment.todayPlan;

  const activeCommitment =
    plan.commitments.find(
      (c) =>
        !c.completed &&
        new Date(c.startTime) <= now &&
        new Date(c.endTime) >= now
    ) || null;

  const upcomingCommitments = plan.commitments
    .filter((c) => !c.completed && new Date(c.startTime) > now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const completedToday = plan.commitments.filter((c) => c.completed);

  const scoredObs = moment.observations
    .map((obs) => ({ obs, score: scoreObservationRelevance(obs, moment) }))
    .filter((x) => x.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.obs)
    .slice(0, 8);

  const activeExperiments = moment.experiments.filter((e) => e.status === "active");

  const recentReflections = moment.memory.recent.reflections.slice(-5);

  const total = plan.commitments.length;
  const completed = completedToday.length;

  return {
    identity: {
      values: moment.memory.stable.values,
      priorities: moment.memory.stable.priorities,
      lifeSeason: moment.memory.stable.lifeSeason,
      rhythm: moment.memory.stable.rhythm,
    },
    currentSession: {
      activeCommitment,
      upcomingCommitments,
      completedToday,
    },
    workingMemory: moment.memory.working,
    relevantObservations: scoredObs,
    activeExperiments,
    recentReflections,
    trust: {
      score: moment.trust.current,
      level: getTrustLevel(moment.trust.current),
      trajectory: getTrajectory(moment.trust.history),
    },
    todaySummary: {
      completed,
      total,
      percentComplete: total > 0 ? Math.round((completed / total) * 100) : 0,
    },
  };
}
