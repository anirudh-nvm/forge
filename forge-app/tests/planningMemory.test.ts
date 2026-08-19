import { describe, it, expect } from "vitest";
import { recordPlanningEvent, analyzePlanningMemory } from "../src/memory/PlanningMemory";
import type { PlanningEvent } from "../src/memory/PlanningMemory";
import type { Commitment } from "../src/types/commitment";

function makeCommitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: "c1",
    title: "Study",
    startTime: "2026-08-14T09:00:00Z",
    endTime: "2026-08-14T10:00:00Z",
    completed: false,
    locked: false,
    priority: "high",
    ...overrides,
  };
}

describe("PlanningMemory", () => {
  describe("recordPlanningEvent", () => {
    it("creates event with correct time of day", () => {
      const commitments = [
        makeCommitment({ startTime: "2026-08-14T06:00:00Z", completed: true }),
      ];
      const event = recordPlanningEvent(commitments, ["completed"], 0, "2026-08-14");
      expect(event.timeOfDay).toBe("morning");
      expect(event.completedCount).toBe(1);
      expect(event.completionRate).toBe(1);
    });

    it("handles empty commitments", () => {
      const event = recordPlanningEvent([], [], 0, "2026-08-14");
      expect(event.totalCount).toBe(0);
      expect(event.completionRate).toBe(0);
    });

    it("tracks adjustments", () => {
      const event = recordPlanningEvent(
        [makeCommitment()],
        ["completed"],
        3,
        "2026-08-14"
      );
      expect(event.adjustments).toBe(3);
    });
  });

  describe("analyzePlanningMemory", () => {
    it("returns defaults for empty events", () => {
      const summary = analyzePlanningMemory([]);
      expect(summary.totalEvents).toBe(0);
      expect(summary.preferredTimeWindow).toBe("morning");
    });

    it("finds preferred time window", () => {
      const events: PlanningEvent[] = [
        { ...recordPlanningEvent([makeCommitment({ startTime: "2026-08-10T09:00:00Z", completed: true })], ["completed"], 0, "2026-08-10"), timeOfDay: "morning", completionRate: 1 },
        { ...recordPlanningEvent([makeCommitment({ startTime: "2026-08-11T09:00:00Z", completed: true })], ["completed"], 0, "2026-08-11"), timeOfDay: "morning", completionRate: 1 },
        { ...recordPlanningEvent([makeCommitment({ startTime: "2026-08-12T19:00:00Z", completed: false })], ["skipped"], 0, "2026-08-12"), timeOfDay: "evening", completionRate: 0 },
      ];

      const summary = analyzePlanningMemory(events);
      expect(summary.preferredTimeWindow).toBe("morning");
      expect(summary.timeWindowSuccessRate).toBeGreaterThan(0.8);
    });

    it("detects improving trend", () => {
      const events: PlanningEvent[] = [
        { ...recordPlanningEvent([makeCommitment({ completed: false })], ["skipped"], 0, "2026-08-07"), timeOfDay: "morning", completionRate: 0 },
        { ...recordPlanningEvent([makeCommitment({ completed: false })], ["skipped"], 0, "2026-08-08"), timeOfDay: "morning", completionRate: 0 },
        { ...recordPlanningEvent([makeCommitment({ completed: true })], ["completed"], 0, "2026-08-13"), timeOfDay: "morning", completionRate: 1 },
        { ...recordPlanningEvent([makeCommitment({ completed: true })], ["completed"], 0, "2026-08-14"), timeOfDay: "morning", completionRate: 1 },
      ];

      const summary = analyzePlanningMemory(events);
      expect(summary.recentTrend).toBe("improving");
    });

    it("computes average completion rate", () => {
      const events: PlanningEvent[] = [
        { ...recordPlanningEvent([], [], 0), timeOfDay: "morning", completionRate: 0.8 },
        { ...recordPlanningEvent([], [], 0), timeOfDay: "morning", completionRate: 0.6 },
      ];

      const summary = analyzePlanningMemory(events);
      expect(summary.avgCompletionRate).toBeCloseTo(0.7, 1);
    });
  });
});
