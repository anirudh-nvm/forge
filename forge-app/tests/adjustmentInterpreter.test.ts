import { describe, it, expect } from "vitest";
import { interpretAdjustment, buildAdjustmentSummary, describePlanChange } from "../src/engine/AdjustmentInterpreter";
import { buildAdjustmentSuggestions } from "../src/engine/AdjustmentSuggestions";
import type { TodayPlan } from "../src/types/todayPlan";
import type { Commitment } from "../src/types/commitment";

function makeCommitment(overrides: Partial<Commitment>): Commitment {
  return {
    id: "test",
    title: "Test",
    startTime: "9:00 AM",
    endTime: "10:00 AM",
    completed: false,
    locked: false,
    priority: "medium",
    ...overrides,
  };
}

function makePlan(commitments: Commitment[]): TodayPlan {
  return {
    greeting: "test",
    summary: [],
    commitments,
    timeline: [],
    unscheduled: [],
    warnings: [],
    recommendation: "",
    status: "active",
  };
}

describe("interpretAdjustment", () => {
  const plan = makePlan([
    makeCommitment({ id: "college", title: "College", startTime: "9:00 AM", endTime: "5:00 PM", locked: true }),
    makeCommitment({ id: "gym", title: "Gym", startTime: "5:30 PM", endTime: "6:30 PM" }),
    makeCommitment({ id: "dsa", title: "DSA Practice", startTime: "7:00 PM", endTime: "8:00 PM" }),
  ]);

  it("detects cancel", () => {
    const { adjustments } = interpretAdjustment(plan, "gym got cancelled");
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].type).toBe("delete");
    expect((adjustments[0] as { taskId: string }).taskId).toBe("gym");
  });

  it("detects remove", () => {
    const { adjustments } = interpretAdjustment(plan, "remove gym");
    expect(adjustments[0].type).toBe("delete");
  });

  it("does not delete locked commitments", () => {
    const { adjustments } = interpretAdjustment(plan, "college got cancelled");
    expect(adjustments).toHaveLength(0);
  });

  it("detects move later", () => {
    const { adjustments } = interpretAdjustment(plan, "move gym later");
    expect(adjustments[0].type).toBe("moveLater");
  });

  it("detects move earlier", () => {
    const { adjustments } = interpretAdjustment(plan, "move dsa earlier");
    expect(adjustments[0].type).toBe("moveEarlier");
  });

  it("does not move locked commitments", () => {
    const { adjustments } = interpretAdjustment(plan, "move college later");
    expect(adjustments).toHaveLength(0);
  });

  it("detects add task", () => {
    const { adjustments } = interpretAdjustment(plan, "add a doctor appointment");
    expect(adjustments[0].type).toBe("addTask");
  });

  it("detects feeling tired and drops an optional task", () => {
    const { adjustments } = interpretAdjustment(plan, "i'm feeling tired");
    expect(adjustments.length).toBeGreaterThan(0);
    expect(adjustments[0].type).toBe("delete");
  });

  it("detects more time", () => {
    const { adjustments } = interpretAdjustment(plan, "i need another hour for gym");
    expect(adjustments[0].type).toBe("updateDuration");
  });

  it("returns no adjustments for gibberish", () => {
    const { adjustments } = interpretAdjustment(plan, "lorem ipsum dolor");
    expect(adjustments).toHaveLength(0);
  });
});

describe("buildAdjustmentSummary", () => {
  it("formats delete summary", () => {
    const plan = makePlan([makeCommitment({ id: "gym", title: "Gym" })]);
    const summary = buildAdjustmentSummary(plan, [{ type: "delete", taskId: "gym" }]);
    expect(summary).toContain("remove Gym");
  });

  it("returns no changes for empty", () => {
    const plan = makePlan([]);
    expect(buildAdjustmentSummary(plan, [])).toBe("no changes");
  });
});

describe("describePlanChange", () => {
  it("describes before and after", () => {
    const before = makePlan([
      makeCommitment({ id: "dsa", title: "DSA Practice", startTime: "7:00 PM", endTime: "8:00 PM" }),
    ]);
    const after = makePlan([
      makeCommitment({ id: "dsa", title: "DSA Practice", startTime: "8:00 PM", endTime: "9:00 PM" }),
    ]);
    const { before: beforeLines, after: afterLines } = describePlanChange(before, after, [
      { type: "moveLater", taskId: "dsa", minutes: 60 },
    ]);
    expect(beforeLines[0]).toContain("7:00 PM");
    expect(afterLines[0]).toContain("8:00 PM");
  });
});

describe("buildAdjustmentSuggestions", () => {
  it("returns contextual suggestions for upcoming commitments", () => {
    const plan = makePlan([
      makeCommitment({ id: "college", title: "College", startTime: "9:00 AM", endTime: "5:00 PM", locked: true }),
      makeCommitment({ id: "dsa", title: "DSA Practice", startTime: "7:00 PM", endTime: "8:00 PM" }),
    ]);
    const suggestions = buildAdjustmentSuggestions(plan);
    expect(suggestions.some((s) => s.message.includes("college"))).toBe(true);
    expect(suggestions.some((s) => s.message.includes("dsa"))).toBe(true);
    expect(suggestions.some((s) => s.message.includes("tired"))).toBe(true);
    expect(suggestions.some((s) => s.message.includes("add a new task"))).toBe(true);
  });

  it("returns empty for empty plan", () => {
    expect(buildAdjustmentSuggestions(makePlan([]))).toHaveLength(0);
  });
});