import type {
  StableMemory,
  WorkingMemory,
  RecentMemory,
  MemoryProfile,
} from "./MemoryProfile";
import {
  createDefaultStableMemory,
  createDefaultWorkingMemory,
  createDefaultRecentMemory,
} from "./MemoryProfile";
import { StorageEngine } from "../storage/StorageEngine";

export function updateStable(
  current: StableMemory,
  patch: Partial<Pick<StableMemory, "lifeSeason" | "priorities" | "values" | "rhythm" | "constraints">>
): StableMemory {
  const updated = { ...current, ...patch, lastUpdated: new Date().toISOString() };
  StorageEngine.saveStableMemory(updated).catch(() => {});
  return updated;
}

export function updateWorking(
  current: WorkingMemory,
  patch: Partial<Pick<WorkingMemory, "activeGoals" | "currentExperiments" | "activeFocus" | "recentDecisions">>
): WorkingMemory {
  const updated = { ...current, ...patch, lastUpdated: new Date().toISOString() };
  StorageEngine.saveWorkingMemory(updated).catch(() => {});
  return updated;
}

export function clearRecent(): RecentMemory {
  const recent = createDefaultRecentMemory();
  return recent;
}

export function archiveWorking(working: WorkingMemory): WorkingMemory {
  const archived: WorkingMemory = {
    ...working,
    activeFocus: [],
    recentDecisions: [],
    lastUpdated: new Date().toISOString(),
  };
  StorageEngine.saveWorkingMemory(archived).catch(() => {});
  return archived;
}

export function promoteWorking(
  working: WorkingMemory,
  newGoals: string[]
): WorkingMemory {
  const promoted: WorkingMemory = {
    ...working,
    activeGoals: newGoals,
    activeFocus: [],
    recentDecisions: [],
    lastUpdated: new Date().toISOString(),
  };
  StorageEngine.saveWorkingMemory(promoted).catch(() => {});
  return promoted;
}
