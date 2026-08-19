import { describe, it, expect } from "vitest";
import { generateAnchors, detectAnchorType, DEFAULT_ANCHOR_TIMES } from "../src/day/DayAnchorEngine";
import type { TodayPlan } from "../src/types/todayPlan";
import type { Commitment } from "../src/types/commitment";

function makeCommitment(overrides: Partial<Commitment>): Commitment {
  return {
    id: "c",
    title: "Event",
    startTime: "9:00 AM",
    endTime: "10:00 AM",
    completed: false,
    locked: true,
    priority: "high",
    ...overrides,
  };
}

function makePlan(commitments: Commitment[] = []): TodayPlan {
  return {
    greeting: "hi",
    summary: [],
    commitments,
    unscheduled: [],
    warnings: [],
    recommendation: "",
  };
}

describe("DayAnchorEngine", () => {
  describe("detectAnchorType", () => {
    it("detects known anchor titles", () => {
      expect(detectAnchorType("Dinner")).toBe("dinner");
      expect(detectAnchorType("wake up")).toBe("wake");
      expect(detectAnchorType("Bedtime")).toBe("bedtime");
      expect(detectAnchorType("sleep")).toBe("bedtime");
      expect(detectAnchorType("lunch")).toBe("lunch");
      expect(detectAnchorType("breakfast")).toBe("breakfast");
    });

    it("returns null for non-anchor titles", () => {
      expect(detectAnchorType("College")).toBeNull();
      expect(detectAnchorType("Gym")).toBeNull();
      expect(detectAnchorType("")).toBeNull();
    });
  });

  describe("generateAnchors", () => {
    it("uses defaults for an empty plan", () => {
      const anchors = generateAnchors(makePlan());
      expect(anchors).toHaveLength(5);
      expect(anchors.every(a => !a.locked)).toBe(true);
      expect(anchors.find(a => a.type === "wake")!.time).toBe(DEFAULT_ANCHOR_TIMES.wake);
      expect(anchors.find(a => a.type === "dinner")!.time).toBe(DEFAULT_ANCHOR_TIMES.dinner);
      expect(anchors.find(a => a.type === "bedtime")!.time).toBe(DEFAULT_ANCHOR_TIMES.bedtime);
    });

    it("uses explicit dinner time when present", () => {
      const plan = makePlan([
        makeCommitment({ title: "Dinner", startTime: "7:00 PM", endTime: "8:00 PM" }),
      ]);
      const anchors = generateAnchors(plan);
      const dinner = anchors.find(a => a.type === "dinner")!;
      expect(dinner.time).toBe("7:00 PM");
      expect(dinner.locked).toBe(true);
    });

    it("keeps defaults for anchors not explicitly mentioned", () => {
      const plan = makePlan([
        makeCommitment({ title: "Dinner", startTime: "7:00 PM", endTime: "8:00 PM" }),
      ]);
      const anchors = generateAnchors(plan);
      expect(anchors.find(a => a.type === "lunch")!.locked).toBe(false);
      expect(anchors.find(a => a.type === "lunch")!.time).toBe(DEFAULT_ANCHOR_TIMES.lunch);
      expect(anchors.find(a => a.type === "breakfast")!.time).toBe(DEFAULT_ANCHOR_TIMES.breakfast);
    });

    it("sorts anchors chronologically", () => {
      const plan = makePlan([
        makeCommitment({ title: "Dinner", startTime: "8:00 PM", endTime: "9:00 PM" }),
      ]);
      const anchors = generateAnchors(plan);
      const times = anchors.map(a => a.time);
      expect(times).toEqual([
        "7:30 AM",
        "8:30 AM",
        "1:00 PM",
        "8:00 PM",
        "11:00 PM",
      ]);
    });

    it("does not mutate the input plan", () => {
      const commitments = [
        makeCommitment({ title: "Dinner", startTime: "7:00 PM", endTime: "8:00 PM" }),
      ];
      const plan = makePlan(commitments);
      generateAnchors(plan);
      expect(plan.commitments).toHaveLength(1);
      expect(plan.commitments[0].title).toBe("Dinner");
    });

    it("returns fresh anchor objects on each call", () => {
      const plan = makePlan();
      const first = generateAnchors(plan);
      const second = generateAnchors(plan);
      expect(first).not.toBe(second);
      expect(first[0]).not.toBe(second[0]);
    });

    it("handles single-commitment plans without anchor titles", () => {
      const plan = makePlan([
        makeCommitment({ title: "College", startTime: "9:00 AM", endTime: "5:00 PM" }),
      ]);
      const anchors = generateAnchors(plan);
      expect(anchors).toHaveLength(5);
      expect(anchors.every(a => !a.locked)).toBe(true);
    });
  });
});