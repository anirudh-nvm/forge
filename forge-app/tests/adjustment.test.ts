import { describe, it, expect } from "vitest";
import { adjustPlan } from "../src/engine/AdjustmentEngine";
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
    unscheduled: [],
    warnings: [],
    recommendation: "",
  };
}

describe("AdjustmentEngine", () => {
  describe("moveEarlier", () => {
    it("moves commitment earlier by 60 minutes", () => {
      const plan = makePlan([
        makeCommitment({ id: "homework", title: "Homework", startTime: "5:30 PM", endTime: "6:30 PM" }),
      ]);
      const { plan: result } = adjustPlan(plan, { type: "moveEarlier", taskId: "homework", minutes: 60 });
      expect(result.commitments[0].startTime).toBe("4:30 PM");
      expect(result.commitments[0].endTime).toBe("5:30 PM");
    });

    it("returns unchanged plan on locked commitment", () => {
      const plan = makePlan([
        makeCommitment({ id: "college", title: "College", startTime: "9:00 AM", endTime: "5:00 PM", locked: true }),
      ]);
      const { plan: result, events } = adjustPlan(plan, { type: "moveEarlier", taskId: "college" });
      expect(result.commitments[0].startTime).toBe("9:00 AM");
      expect(events).toHaveLength(0);
    });

    it("returns unchanged plan when moving before midnight", () => {
      const plan = makePlan([
        makeCommitment({ id: "homework", title: "Homework", startTime: "1:00 AM", endTime: "2:00 AM" }),
      ]);
      const { plan: result, events } = adjustPlan(plan, { type: "moveEarlier", taskId: "homework", minutes: 120 });
      expect(result.commitments[0].startTime).toBe("1:00 AM");
      expect(events).toHaveLength(0);
    });
  });

  describe("moveLater", () => {
    it("moves commitment later by 60 minutes", () => {
      const plan = makePlan([
        makeCommitment({ id: "homework", title: "Homework", startTime: "5:30 PM", endTime: "6:30 PM" }),
      ]);
      const { plan: result } = adjustPlan(plan, { type: "moveLater", taskId: "homework", minutes: 60 });
      expect(result.commitments[0].startTime).toBe("6:30 PM");
      expect(result.commitments[0].endTime).toBe("7:30 PM");
    });

    it("returns unchanged plan on locked commitment", () => {
      const plan = makePlan([
        makeCommitment({ id: "college", title: "College", startTime: "9:00 AM", endTime: "5:00 PM", locked: true }),
      ]);
      const { plan: result, events } = adjustPlan(plan, { type: "moveLater", taskId: "college" });
      expect(result.commitments[0].startTime).toBe("9:00 AM");
      expect(events).toHaveLength(0);
    });
  });

  describe("delete", () => {
    it("deletes unlocked commitment", () => {
      const plan = makePlan([
        makeCommitment({ id: "homework", title: "Homework", startTime: "5:30 PM", endTime: "6:30 PM" }),
      ]);
      const { plan: result } = adjustPlan(plan, { type: "delete", taskId: "homework" });
      expect(result.commitments).toHaveLength(0);
      expect(result.unscheduled).toHaveLength(1);
      expect(result.unscheduled[0].title).toBe("Homework");
    });

    it("returns unchanged plan on locked commitment", () => {
      const plan = makePlan([
        makeCommitment({ id: "college", title: "College", startTime: "9:00 AM", endTime: "5:00 PM", locked: true }),
      ]);
      const { plan: result, events } = adjustPlan(plan, { type: "delete", taskId: "college" });
      expect(result.commitments).toHaveLength(1);
      expect(events).toHaveLength(0);
    });
  });

  describe("addTask", () => {
    it("adds new task", () => {
      const plan = makePlan([]);
      const { plan: result } = adjustPlan(plan, {
        type: "addTask",
        title: "Exercise",
        startTime: "7:00 PM",
        endTime: "7:30 PM",
      });
      expect(result.commitments).toHaveLength(1);
      expect(result.commitments[0].title).toBe("Exercise");
    });

    it("returns unchanged plan on duplicate", () => {
      const plan = makePlan([
        makeCommitment({ id: "college", title: "College", startTime: "9:00 AM", endTime: "5:00 PM" }),
      ]);
      const { plan: result, events } = adjustPlan(plan, {
        type: "addTask",
        title: "College",
        startTime: "8:00 AM",
        endTime: "9:00 AM",
      });
      expect(result.commitments).toHaveLength(1);
      expect(events).toHaveLength(0);
    });
  });

  describe("updateDuration", () => {
    it("updates duration", () => {
      const plan = makePlan([
        makeCommitment({ id: "homework", title: "Homework", startTime: "5:30 PM", endTime: "6:30 PM" }),
      ]);
      const { plan: result } = adjustPlan(plan, { type: "updateDuration", taskId: "homework", minutes: 30 });
      expect(result.commitments[0].endTime).toBe("6:00 PM");
    });

    it("returns unchanged plan on locked commitment", () => {
      const plan = makePlan([
        makeCommitment({ id: "college", title: "College", startTime: "9:00 AM", endTime: "5:00 PM", locked: true }),
      ]);
      const { plan: result, events } = adjustPlan(plan, { type: "updateDuration", taskId: "college", minutes: 30 });
      expect(result.commitments[0].endTime).toBe("5:00 PM");
      expect(events).toHaveLength(0);
    });
  });

  describe("lock/unlock", () => {
    it("locks commitment", () => {
      const plan = makePlan([
        makeCommitment({ id: "homework", title: "Homework", startTime: "5:30 PM", endTime: "6:30 PM" }),
      ]);
      const { plan: result } = adjustPlan(plan, { type: "lock", taskId: "homework" });
      expect(result.commitments[0].locked).toBe(true);
    });

    it("unlocks commitment", () => {
      const plan = makePlan([
        makeCommitment({ id: "college", title: "College", startTime: "9:00 AM", endTime: "5:00 PM", locked: true }),
      ]);
      const { plan: result } = adjustPlan(plan, { type: "unlock", taskId: "college" });
      expect(result.commitments[0].locked).toBe(false);
    });
  });

  describe("events", () => {
    it("returns events for moveEarlier", () => {
      const plan = makePlan([
        makeCommitment({ id: "homework", title: "Homework", startTime: "5:30 PM", endTime: "6:30 PM" }),
      ]);
      const { events } = adjustPlan(plan, { type: "moveEarlier", taskId: "homework", minutes: 60 });
      expect(events).toHaveLength(1);
      expect(events[0].action).toBe("Moved Earlier");
      expect(events[0].engine).toBe("Adjustment");
    });

    it("returns events for delete", () => {
      const plan = makePlan([
        makeCommitment({ id: "homework", title: "Homework", startTime: "5:30 PM", endTime: "6:30 PM" }),
      ]);
      const { events } = adjustPlan(plan, { type: "delete", taskId: "homework" });
      expect(events).toHaveLength(1);
      expect(events[0].action).toBe("Deleted");
    });
  });

  describe("validation", () => {
    it("returns unchanged plan on overlap", () => {
      const plan = makePlan([
        makeCommitment({ id: "college", title: "College", startTime: "9:00 AM", endTime: "5:00 PM" }),
        makeCommitment({ id: "homework", title: "Homework", startTime: "5:30 PM", endTime: "6:30 PM" }),
      ]);
      const { plan: result, events } = adjustPlan(plan, { type: "moveEarlier", taskId: "homework", minutes: 60 });
      expect(result.commitments[1].startTime).toBe("5:30 PM");
      expect(events).toHaveLength(0);
    });

    it("returns unchanged plan on out of order", () => {
      const plan = makePlan([
        makeCommitment({ id: "read-book", title: "Read book", startTime: "7:00 PM", endTime: "7:30 PM" }),
        makeCommitment({ id: "homework", title: "Homework", startTime: "7:30 PM", endTime: "8:30 PM" }),
      ]);
      const { plan: result, events } = adjustPlan(plan, { type: "moveEarlier", taskId: "homework", minutes: 120 });
      expect(result.commitments[1].startTime).toBe("7:30 PM");
      expect(events).toHaveLength(0);
    });

    it("returns unchanged plan on duplicate times", () => {
      const plan = makePlan([
        makeCommitment({ id: "homework", title: "Homework", startTime: "7:00 PM", endTime: "8:00 PM" }),
      ]);
      const { plan: result, events } = adjustPlan(plan, { type: "addTask", title: "Read book", startTime: "7:00 PM", endTime: "8:00 PM" });
      expect(result.commitments).toHaveLength(1);
      expect(events).toHaveLength(0);
    });
  });

  describe("immutable", () => {
    it("does not mutate original plan", () => {
      const plan = makePlan([
        makeCommitment({ id: "homework", title: "Homework", startTime: "5:30 PM", endTime: "6:30 PM" }),
      ]);
      const original = structuredClone(plan);
      adjustPlan(plan, { type: "moveEarlier", taskId: "homework", minutes: 60 });
      expect(plan.commitments[0].startTime).toBe(original.commitments[0].startTime);
    });
  });
});
