export interface StableMemory {
  lifeSeason: string;
  priorities: string[];
  values: string[];
  rhythm: {
    preferredWakeTime: string;
    preferredSleepTime: string;
    studyPreference: "morning" | "afternoon" | "evening";
  };
  constraints: string[];
  lastUpdated: string;
}

export interface WorkingMemory {
  weekOf: string;
  activeGoals: string[];
  currentExperiments: string[];
  activeFocus: string[];
  recentDecisions: string[];
  lastUpdated: string;
}

export interface RecentMemory {
  date: string;
  planId: string | null;
  observations: string[];
  adjustments: string[];
  reflections: string[];
  lastUpdated: string;
}

export interface MemoryProfile {
  stable: StableMemory;
  working: WorkingMemory;
  recent: RecentMemory;
  lastBuilt: string;
}

export function createDefaultStableMemory(): StableMemory {
  return {
    lifeSeason: "student",
    priorities: [],
    values: [],
    rhythm: {
      preferredWakeTime: "7:00 AM",
      preferredSleepTime: "11:00 PM",
      studyPreference: "morning",
    },
    constraints: [],
    lastUpdated: new Date().toISOString(),
  };
}

export function createDefaultWorkingMemory(): WorkingMemory {
  return {
    weekOf: new Date().toISOString().split("T")[0],
    activeGoals: [],
    currentExperiments: [],
    activeFocus: [],
    recentDecisions: [],
    lastUpdated: new Date().toISOString(),
  };
}

export function createDefaultRecentMemory(): RecentMemory {
  return {
    date: new Date().toISOString().split("T")[0],
    planId: null,
    observations: [],
    adjustments: [],
    reflections: [],
    lastUpdated: new Date().toISOString(),
  };
}
