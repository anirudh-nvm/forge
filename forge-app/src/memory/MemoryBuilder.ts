import type {
  MemoryProfile,
  StableMemory,
  WorkingMemory,
  RecentMemory,
} from "./MemoryProfile";
import {
  createDefaultStableMemory,
  createDefaultWorkingMemory,
  createDefaultRecentMemory,
} from "./MemoryProfile";
import { StorageEngine } from "../storage/StorageEngine";
import type { Observation } from "../observation/ObservationTypes";
import type { Experiment } from "./ExperimentTypes";
import type { TrustScore } from "../types/todayPlan";

export interface MemoryBuildContext {
  userProfile: { lifeSeason?: string; priorities?: string[] } | null;
  observations: Observation[];
  experiments: Experiment[];
  trustScore: TrustScore;
  planId: string | null;
  adjustments: string[];
}

export async function buildMemory(): Promise<MemoryProfile> {
  const [stable, working] = await Promise.all([
    StorageEngine.loadStableMemory(),
    StorageEngine.loadWorkingMemory(),
  ]);

  return {
    stable: stable ?? createDefaultStableMemory(),
    working: working ?? createDefaultWorkingMemory(),
    recent: createDefaultRecentMemory(),
    lastBuilt: new Date().toISOString(),
  };
}

export function buildStableMemory(
  profile: StableMemory,
  context: MemoryBuildContext
): StableMemory {
  if (!context.userProfile) return profile;

  const updated = { ...profile };
  if (context.userProfile.lifeSeason) {
    updated.lifeSeason = context.userProfile.lifeSeason;
  }
  if (context.userProfile.priorities && context.userProfile.priorities.length > 0) {
    updated.priorities = context.userProfile.priorities;
  }
  updated.lastUpdated = new Date().toISOString();
  return updated;
}

export function buildWorkingMemory(
  profile: WorkingMemory,
  context: MemoryBuildContext
): WorkingMemory {
  const updated = { ...profile };

  updated.activeGoals = context.userProfile?.priorities ?? [];
  updated.currentExperiments = context.experiments
    .filter((e) => e.status === "active")
    .map((e) => e.title);
  updated.lastUpdated = new Date().toISOString();
  return updated;
}

export function buildRecentMemory(
  context: MemoryBuildContext
): RecentMemory {
  return {
    date: new Date().toISOString().split("T")[0],
    planId: context.planId,
    observations: context.observations.map((o) => o.text),
    adjustments: context.adjustments,
    reflections: [],
    lastUpdated: new Date().toISOString(),
  };
}

export function assembleMemory(
  stable: StableMemory,
  working: WorkingMemory,
  recent: RecentMemory
): MemoryProfile {
  return {
    stable,
    working,
    recent,
    lastBuilt: new Date().toISOString(),
  };
}
