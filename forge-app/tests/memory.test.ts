import { describe, it, expect } from "vitest";
import {
  createDefaultStableMemory,
  createDefaultWorkingMemory,
  createDefaultRecentMemory,
} from "../src/memory/MemoryProfile";
import {
  buildStableMemory,
  buildWorkingMemory,
  buildRecentMemory,
  assembleMemory,
} from "../src/memory/MemoryBuilder";
import {
  updateStable,
  updateWorking,
  clearRecent,
  archiveWorking,
  promoteWorking,
} from "../src/memory/MemoryUpdater";
import type { StableMemory, WorkingMemory, RecentMemory } from "../src/memory/MemoryProfile";
import type { MemoryBuildContext } from "../src/memory/MemoryBuilder";
import type { Observation } from "../src/observation/ObservationTypes";
import type { Experiment } from "../src/memory/ExperimentTypes";

// ─── Helpers ──────────────────────────────────────────────

function makeContext(overrides: Partial<MemoryBuildContext> = {}): MemoryBuildContext {
  return {
    userProfile: null,
    observations: [],
    experiments: [],
    trustScore: { current: 50, history: [] },
    planId: null,
    adjustments: [],
    ...overrides,
  };
}

function makeObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    id: "obs1",
    category: "consistency",
    text: "DSA has been skipped 3 of the last 5 times.",
    confidence: 0.7,
    supportingEvents: [],
    firstSeen: "2026-08-10T09:00:00Z",
    lastSeen: "2026-08-14T09:00:00Z",
    status: "new",
    metadata: { commitmentTitle: "DSA", patternType: "completion_rate", sampleSize: 5 },
    ...overrides,
  };
}

function makeExperiment(overrides: Partial<Experiment> = {}): Experiment {
  return {
    id: "exp1",
    title: "Morning Study",
    hypothesis: "Morning study improves completion",
    commitmentTitle: "DSA",
    status: "active",
    startDate: "2026-08-01",
    endDate: "2026-08-14",
    metrics: [],
    notes: [],
    createdAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

// ─── MemoryProfile defaults ───────────────────────────────

describe("MemoryProfile defaults", () => {
  it("createDefaultStableMemory returns valid defaults", () => {
    const stable = createDefaultStableMemory();
    expect(stable.lifeSeason).toBe("student");
    expect(stable.priorities).toEqual([]);
    expect(stable.values).toEqual([]);
    expect(stable.rhythm).toBeDefined();
    expect(stable.constraints).toEqual([]);
    expect(stable.lastUpdated).toBeDefined();
  });

  it("createDefaultWorkingMemory returns valid defaults", () => {
    const working = createDefaultWorkingMemory();
    expect(working.activeGoals).toEqual([]);
    expect(working.currentExperiments).toEqual([]);
    expect(working.activeFocus).toEqual([]);
    expect(working.recentDecisions).toEqual([]);
    expect(working.weekOf).toBeDefined();
  });

  it("createDefaultRecentMemory returns valid defaults", () => {
    const recent = createDefaultRecentMemory();
    expect(recent.planId).toBeNull();
    expect(recent.observations).toEqual([]);
    expect(recent.adjustments).toEqual([]);
    expect(recent.reflections).toEqual([]);
    expect(recent.date).toBeDefined();
  });
});

// ─── MemoryBuilder ────────────────────────────────────────

describe("MemoryBuilder", () => {
  it("buildStableMemory updates lifeSeason from user profile", () => {
    const stable = createDefaultStableMemory();
    const context = makeContext({ userProfile: { lifeSeason: "working_professional", priorities: ["career"] } });
    const updated = buildStableMemory(stable, context);
    expect(updated.lifeSeason).toBe("working_professional");
    expect(updated.priorities).toEqual(["career"]);
  });

  it("buildStableMemory preserves existing values when no user profile", () => {
    const stable = createDefaultStableMemory();
    const context = makeContext({ userProfile: null });
    const updated = buildStableMemory(stable, context);
    expect(updated.lifeSeason).toBe("student");
  });

  it("buildWorkingMemory sets active goals from user profile priorities", () => {
    const working = createDefaultWorkingMemory();
    const context = makeContext({
      userProfile: { priorities: ["CAT", "DSA"] },
      experiments: [makeExperiment({ status: "active" }), makeExperiment({ id: "exp2", title: "Evening Gym", status: "completed" })],
    });
    const updated = buildWorkingMemory(working, context);
    expect(updated.activeGoals).toEqual(["CAT", "DSA"]);
    expect(updated.currentExperiments).toEqual(["Morning Study"]);
  });

  it("buildRecentMemory captures observations and adjustments", () => {
    const context = makeContext({
      observations: [makeObservation()],
      adjustments: ["Moved DSA earlier"],
      planId: "plan_123",
    });
    const recent = buildRecentMemory(context);
    expect(recent.planId).toBe("plan_123");
    expect(recent.observations).toEqual(["DSA has been skipped 3 of the last 5 times."]);
    expect(recent.adjustments).toEqual(["Moved DSA earlier"]);
  });

  it("assembleMemory produces a valid MemoryProfile", () => {
    const stable = createDefaultStableMemory();
    const working = createDefaultWorkingMemory();
    const recent = createDefaultRecentMemory();
    const profile = assembleMemory(stable, working, recent);
    expect(profile.stable).toBe(stable);
    expect(profile.working).toBe(working);
    expect(profile.recent).toBe(recent);
    expect(profile.lastBuilt).toBeDefined();
  });
});

// ─── MemoryUpdater ────────────────────────────────────────

describe("MemoryUpdater", () => {
  it("updateStable patches fields and updates timestamp", () => {
    const stable = createDefaultStableMemory();
    const updated = updateStable(stable, { lifeSeason: "taking_a_break", priorities: ["health"] });
    expect(updated.lifeSeason).toBe("taking_a_break");
    expect(updated.priorities).toEqual(["health"]);
    expect(updated.lastUpdated).toBeDefined();
    expect(new Date(updated.lastUpdated).toISOString()).toBe(updated.lastUpdated);
  });

  it("updateStable preserves unpatched fields", () => {
    const stable = createDefaultStableMemory();
    const originalValues = [...stable.values];
    const updated = updateStable(stable, { lifeSeason: "working_professional" });
    expect(updated.values).toEqual(originalValues);
    expect(updated.rhythm).toEqual(stable.rhythm);
  });

  it("updateWorking patches fields and updates timestamp", () => {
    const working = createDefaultWorkingMemory();
    const updated = updateWorking(working, { activeGoals: ["interview prep"], activeFocus: ["DSA"] });
    expect(updated.activeGoals).toEqual(["interview prep"]);
    expect(updated.activeFocus).toEqual(["DSA"]);
    expect(updated.lastUpdated).toBeDefined();
    expect(new Date(updated.lastUpdated).toISOString()).toBe(updated.lastUpdated);
  });

  it("updateWorking preserves unpatched fields", () => {
    const working = createDefaultWorkingMemory();
    const originalExperiments = [...working.currentExperiments];
    const updated = updateWorking(working, { activeGoals: ["new goal"] });
    expect(updated.currentExperiments).toEqual(originalExperiments);
  });

  it("clearRecent returns fresh default recent memory", () => {
    const recent: RecentMemory = {
      date: "2026-08-10",
      planId: "plan_1",
      observations: ["obs1", "obs2"],
      adjustments: ["adj1"],
      reflections: ["ref1"],
      lastUpdated: "2026-08-10T12:00:00Z",
    };
    const cleared = clearRecent();
    expect(cleared.planId).toBeNull();
    expect(cleared.observations).toEqual([]);
    expect(cleared.adjustments).toEqual([]);
    expect(cleared.reflections).toEqual([]);
  });

  it("archiveWorking clears activeFocus and recentDecisions", () => {
    const working: WorkingMemory = {
      weekOf: "2026-08-10",
      activeGoals: ["CAT"],
      currentExperiments: ["exp1"],
      activeFocus: ["DSA", "CAT"],
      recentDecisions: ["moved DSA"],
      lastUpdated: "2026-08-10T12:00:00Z",
    };
    const archived = archiveWorking(working);
    expect(archived.activeGoals).toEqual(["CAT"]);
    expect(archived.currentExperiments).toEqual(["exp1"]);
    expect(archived.activeFocus).toEqual([]);
    expect(archived.recentDecisions).toEqual([]);
  });

  it("promoteWorking replaces activeGoals and clears working fields", () => {
    const working: WorkingMemory = {
      weekOf: "2026-08-10",
      activeGoals: ["old goal"],
      currentExperiments: ["exp1"],
      activeFocus: ["DSA"],
      recentDecisions: ["moved DSA"],
      lastUpdated: "2026-08-10T12:00:00Z",
    };
    const promoted = promoteWorking(working, ["new goal 1", "new goal 2"]);
    expect(promoted.activeGoals).toEqual(["new goal 1", "new goal 2"]);
    expect(promoted.activeFocus).toEqual([]);
    expect(promoted.recentDecisions).toEqual([]);
  });
});

// ─── Integration ──────────────────────────────────────────

describe("Memory integration", () => {
  it("full build cycle produces consistent MemoryProfile", () => {
    const stable = createDefaultStableMemory();
    const working = createDefaultWorkingMemory();
    const context = makeContext({
      userProfile: { lifeSeason: "student", priorities: ["CAT"] },
      observations: [makeObservation()],
      experiments: [makeExperiment()],
      planId: "plan_1",
      adjustments: ["Moved DSA"],
    });

    const updatedStable = buildStableMemory(stable, context);
    const updatedWorking = buildWorkingMemory(working, context);
    const recent = buildRecentMemory(context);
    const profile = assembleMemory(updatedStable, updatedWorking, recent);

    expect(profile.stable.priorities).toEqual(["CAT"]);
    expect(profile.working.activeGoals).toEqual(["CAT"]);
    expect(profile.working.currentExperiments).toEqual(["Morning Study"]);
    expect(profile.recent.planId).toBe("plan_1");
    expect(profile.recent.observations).toHaveLength(1);
    expect(profile.recent.adjustments).toEqual(["Moved DSA"]);
  });

  it("promotion chain: working → archive → promote", () => {
    let working = createDefaultWorkingMemory();
    working = updateWorking(working, {
      activeGoals: ["week 1 goal"],
      activeFocus: ["DSA"],
      recentDecisions: ["evening DSA"],
    });

    // Archive end of week
    working = archiveWorking(working);
    expect(working.activeFocus).toEqual([]);
    expect(working.recentDecisions).toEqual([]);

    // Promote new week
    working = promoteWorking(working, ["week 2 goal"]);
    expect(working.activeGoals).toEqual(["week 2 goal"]);
    expect(working.activeFocus).toEqual([]);
  });

  it("recent memory resets daily", () => {
    let recent = createDefaultRecentMemory();
    recent = {
      ...recent,
      planId: "plan_1",
      observations: ["obs1"],
      adjustments: ["adj1"],
      reflections: ["ref1"],
    };

    const cleared = clearRecent();
    expect(cleared.planId).toBeNull();
    expect(cleared.observations).toEqual([]);
    expect(cleared.adjustments).toEqual([]);
    expect(cleared.reflections).toEqual([]);
  });
});
