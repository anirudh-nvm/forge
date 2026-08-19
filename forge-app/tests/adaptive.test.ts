import { describe, it, expect, beforeEach, vi } from "vitest";
import { interpretLearning } from "../src/adaptive/LearningInterpreter";
import { proposeAdaptations, applyAdaptations } from "../src/adaptive/AdaptivePlanner";
import * as PlanningProfile from "../src/adaptive/PlanningProfile";
import type { LearningReport } from "../src/memory/ExperimentTypes";
import type { TodayPlan } from "../src/types/todayPlan";
import type { PlanningProfile as PlanningProfileType } from "../src/adaptive/AdaptiveTypes";

let mockProfile: PlanningProfileType | null = null;

vi.mock("../src/storage/StorageEngine", () => ({
  StorageEngine: {
    loadPlanningProfile: async () => mockProfile,
    savePlanningProfile: async (p: PlanningProfileType) => {
      mockProfile = p;
    },
  },
}));

function makeExperiment(overrides: Record<string, unknown>) {
  return {
    id: "exp_1",
    title: "Morning Gym",
    hypothesis: "Morning exercise improves consistency",
    commitmentTitle: "Gym",
    status: "completed" as const,
    startDate: "2026-08-01",
    endDate: "2026-08-07",
    metrics: [],
    outcome: "successful" as const,
    notes: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    closedAt: "2026-08-07T00:00:00.000Z",
    ...overrides,
  };
}

function makePlan(commitments: Record<string, string | boolean>[]): TodayPlan {
  return {
    greeting: "Good morning",
    summary: [],
    commitments: commitments.map((c, i) => ({
      id: `c_${i}`,
      title: c.title as string,
      startTime: c.startTime as string,
      endTime: c.endTime as string,
      completed: false,
      locked: (c.locked as boolean) || false,
      priority: "medium" as const,
    })),
    unscheduled: [],
    warnings: [],
    recommendation: "",
  };
}

describe("LearningInterpreter", () => {
  it("returns empty preferences for empty report", () => {
    const report: LearningReport = {
      generatedAt: "2026-08-06T00:00:00.000Z",
      experiments: [],
      summary: { total: 0, active: 0, completed: 0, successful: 0, failed: 0, inconclusive: 0 },
      successfulPatterns: [],
      failedPatterns: [],
    };

    const prefs = interpretLearning(report);
    expect(prefs.timePreferences).toHaveLength(0);
    expect(prefs.durationPreferences).toHaveLength(0);
    expect(prefs.avoidancePreferences).toHaveLength(0);
  });

  it("extracts time preference from successful experiment", () => {
    const report: LearningReport = {
      generatedAt: "2026-08-06T00:00:00.000Z",
      experiments: [
        makeExperiment({ title: "Morning Gym", hypothesis: "Morning exercise works" }),
        makeExperiment({ id: "exp_2", title: "Morning Gym Week 2", hypothesis: "Morning consistency" }),
      ],
      summary: { total: 2, active: 0, completed: 2, successful: 2, failed: 0, inconclusive: 0 },
      successfulPatterns: [],
      failedPatterns: [],
    };

    const prefs = interpretLearning(report);
    expect(prefs.timePreferences).toHaveLength(1);
    expect(prefs.timePreferences[0].preferredWindow).toBe("morning");
    expect(prefs.timePreferences[0].commitmentTitle).toBe("Gym");
  });

  it("extracts avoidance preference from failed experiment", () => {
    const report: LearningReport = {
      generatedAt: "2026-08-06T00:00:00.000Z",
      experiments: [
        makeExperiment({
          title: "Late Night Study",
          hypothesis: "Study after 8 PM works",
          outcome: "failed",
        }),
      ],
      summary: { total: 1, active: 0, completed: 1, successful: 0, failed: 1, inconclusive: 0 },
      successfulPatterns: [],
      failedPatterns: [],
    };

    const prefs = interpretLearning(report);
    expect(prefs.avoidancePreferences).toHaveLength(1);
    expect(prefs.avoidancePreferences[0].avoidAfter).toBe("20:00");
  });

  it("calculates confidence based on experiment count", () => {
    const report: LearningReport = {
      generatedAt: "2026-08-06T00:00:00.000Z",
      experiments: [
        makeExperiment({ id: "exp_1", title: "Exp 1", hypothesis: "Morning works" }),
        makeExperiment({ id: "exp_2", title: "Exp 2", hypothesis: "Morning works" }),
        makeExperiment({ id: "exp_3", title: "Exp 3", hypothesis: "Morning works" }),
      ],
      summary: { total: 3, active: 0, completed: 3, successful: 3, failed: 0, inconclusive: 0 },
      successfulPatterns: [],
      failedPatterns: [],
    };

    const prefs = interpretLearning(report);
    expect(prefs.timePreferences[0].confidence).toBe(1);
  });
});

describe("AdaptivePlanner", () => {
  it("proposes reschedule when commitment is outside preferred window", () => {
    const plan = makePlan([
      { title: "Gym", startTime: "7:00 PM", endTime: "8:00 PM" },
    ]);

    const preferences = {
      timePreferences: [
        {
          commitmentTitle: "Gym",
          preferredWindow: "morning" as const,
          confidence: 0.8,
          basedOnExperiments: ["exp_1"],
        },
      ],
      durationPreferences: [],
      avoidancePreferences: [],
      generatedAt: "2026-08-06T00:00:00.000Z",
      windowDays: 7,
    };

    const proposals = proposeAdaptations(plan, preferences);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].type).toBe("reschedule");
    expect(proposals[0].proposedPlan.title).toBe("Gym");
  });

  it("does not propose for locked commitments", () => {
    const plan = makePlan([
      { title: "College", startTime: "9:00 AM", endTime: "5:00 PM", locked: true },
    ]);

    const preferences = {
      timePreferences: [
        {
          commitmentTitle: "College",
          preferredWindow: "morning" as const,
          confidence: 0.8,
          basedOnExperiments: ["exp_1"],
        },
      ],
      durationPreferences: [],
      avoidancePreferences: [],
      generatedAt: "2026-08-06T00:00:00.000Z",
      windowDays: 7,
    };

    const proposals = proposeAdaptations(plan, preferences);
    expect(proposals).toHaveLength(0);
  });

  it("does not propose when already in preferred window", () => {
    const plan = makePlan([
      { title: "Gym", startTime: "8:00 AM", endTime: "9:00 AM" },
    ]);

    const preferences = {
      timePreferences: [
        {
          commitmentTitle: "Gym",
          preferredWindow: "morning" as const,
          confidence: 0.8,
          basedOnExperiments: ["exp_1"],
        },
      ],
      durationPreferences: [],
      avoidancePreferences: [],
      generatedAt: "2026-08-06T00:00:00.000Z",
      windowDays: 7,
    };

    const proposals = proposeAdaptations(plan, preferences);
    expect(proposals).toHaveLength(0);
  });

  it("applies accepted adaptations to plan", () => {
    const plan = makePlan([
      { title: "Gym", startTime: "7:00 PM", endTime: "8:00 PM" },
    ]);

    const proposals = [
      {
        id: "adapt_1",
        type: "reschedule" as const,
        currentPlan: { title: "Gym", startTime: "7:00 PM", endTime: "8:00 PM" },
        proposedPlan: { title: "Gym", startTime: "8:00 AM", endTime: "9:00 AM" },
        reason: "Morning preferred",
        confidence: 0.8,
        createdAt: "2026-08-06T00:00:00.000Z",
      },
    ];

    const updated = applyAdaptations(plan, proposals);
    expect(updated.commitments[0].startTime).toBe("8:00 AM");
    expect(updated.commitments[0].endTime).toBe("9:00 AM");
  });

  it("sorts commitments chronologically after adaptation", () => {
    const plan = makePlan([
      { title: "Gym", startTime: "7:00 PM", endTime: "8:00 PM" },
      { title: "Study", startTime: "9:00 AM", endTime: "10:00 AM" },
    ]);

    const proposals = [
      {
        id: "adapt_1",
        type: "reschedule" as const,
        currentPlan: { title: "Gym", startTime: "7:00 PM", endTime: "8:00 PM" },
        proposedPlan: { title: "Gym", startTime: "8:00 AM", endTime: "9:00 AM" },
        reason: "Morning preferred",
        confidence: 0.8,
        createdAt: "2026-08-06T00:00:00.000Z",
      },
    ];

    const updated = applyAdaptations(plan, proposals);
    expect(updated.commitments[0].title).toBe("Gym");
    expect(updated.commitments[1].title).toBe("Study");
  });
});

describe("PlanningProfile", () => {
  beforeEach(async () => {
    mockProfile = null;
    PlanningProfile.reset();
    await PlanningProfile.loadProfile();
  });

  it("creates a new profile", () => {
    const profile = PlanningProfile.createProfile();
    expect(profile.id).toBeTruthy();
    expect(profile.timePreferences).toHaveLength(0);
  });

  it("merges new time preferences", () => {
    PlanningProfile.createProfile();
    PlanningProfile.mergePreferences({
      timePreferences: [
        {
          commitmentTitle: "Gym",
          preferredWindow: "morning",
          confidence: 0.8,
          basedOnExperiments: ["exp_1"],
        },
      ],
      durationPreferences: [],
      avoidancePreferences: [],
      generatedAt: "2026-08-06T00:00:00.000Z",
      windowDays: 7,
    });

    const profile = PlanningProfile.getProfile();
    expect(profile?.timePreferences).toHaveLength(1);
    expect(profile?.timePreferences[0].preferredWindow).toBe("morning");
  });

  it("updates preference when new confidence is higher", () => {
    PlanningProfile.createProfile();
    PlanningProfile.mergePreferences({
      timePreferences: [
        {
          commitmentTitle: "Gym",
          preferredWindow: "morning",
          confidence: 0.5,
          basedOnExperiments: ["exp_1"],
        },
      ],
      durationPreferences: [],
      avoidancePreferences: [],
      generatedAt: "2026-08-06T00:00:00.000Z",
      windowDays: 7,
    });

    PlanningProfile.mergePreferences({
      timePreferences: [
        {
          commitmentTitle: "Gym",
          preferredWindow: "evening",
          confidence: 0.9,
          basedOnExperiments: ["exp_1", "exp_2"],
        },
      ],
      durationPreferences: [],
      avoidancePreferences: [],
      generatedAt: "2026-08-07T00:00:00.000Z",
      windowDays: 7,
    });

    const profile = PlanningProfile.getProfile();
    expect(profile?.timePreferences).toHaveLength(1);
    expect(profile?.timePreferences[0].preferredWindow).toBe("evening");
  });

  it("removes preference by type and title", () => {
    PlanningProfile.createProfile();
    PlanningProfile.mergePreferences({
      timePreferences: [
        {
          commitmentTitle: "Gym",
          preferredWindow: "morning",
          confidence: 0.8,
          basedOnExperiments: ["exp_1"],
        },
      ],
      durationPreferences: [],
      avoidancePreferences: [],
      generatedAt: "2026-08-06T00:00:00.000Z",
      windowDays: 7,
    });

    PlanningProfile.removePreference("time", "Gym");
    const profile = PlanningProfile.getProfile();
    expect(profile?.timePreferences).toHaveLength(0);
  });

  it("returns preferences from profile", () => {
    PlanningProfile.createProfile();
    PlanningProfile.mergePreferences({
      timePreferences: [
        {
          commitmentTitle: "Gym",
          preferredWindow: "morning",
          confidence: 0.8,
          basedOnExperiments: ["exp_1"],
        },
      ],
      durationPreferences: [],
      avoidancePreferences: [],
      generatedAt: "2026-08-06T00:00:00.000Z",
      windowDays: 7,
    });

    const prefs = PlanningProfile.getPreferences();
    expect(prefs?.timePreferences).toHaveLength(1);
  });
});
