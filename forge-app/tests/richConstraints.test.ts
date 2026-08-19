import { describe, it, expect } from "vitest";
import { extractConstraints } from "../src/brain/pipeline/ConstraintExtractor";
import { scheduleDay } from "../src/brain/Scheduler";
import type { FlexibleTask } from "../src/brain/types";

function makeTask(overrides: Partial<FlexibleTask>): FlexibleTask {
  return { title: "Task", constraints: [], confidence: 0.8, ...overrides };
}

function endHour24(time: string): number {
  const match = time.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  const p = match[3]?.toUpperCase();
  if (p === "PM" && h !== 12) h += 12;
  if (p === "AM" && h === 12) h = 0;
  return h;
}

function startHour24(time: string): number {
  return endHour24(time);
}

describe("Rich Constraints", () => {
  describe("extractConstraints", () => {
    it("maps 'before sleeping' to the bedtime anchor", () => {
      const [c] = extractConstraints("journal before sleeping");
      expect(c).toEqual({ type: "before", target: "Bedtime" });
    });

    it("maps 'before bed' to the bedtime anchor", () => {
      const [c] = extractConstraints("read before bed");
      expect(c).toEqual({ type: "before", target: "Bedtime" });
    });

    it("maps 'before bedtime' to the bedtime anchor", () => {
      const [c] = extractConstraints("stretch before bedtime");
      expect(c).toEqual({ type: "before", target: "Bedtime" });
    });

    it("maps 'after waking up' to the wake anchor", () => {
      const [c] = extractConstraints("meditate after waking up");
      expect(c).toEqual({ type: "after", target: "Wake" });
    });

    it("maps 'after waking' to the wake anchor", () => {
      const [c] = extractConstraints("run after waking");
      expect(c).toEqual({ type: "after", target: "Wake" });
    });

    it("maps 'this evening' to evening constraint", () => {
      const [c] = extractConstraints("call parents this evening");
      expect(c).toEqual({ type: "evening" });
    });

    it("maps 'later tonight' to evening constraint", () => {
      const [c] = extractConstraints("study later tonight");
      expect(c).toEqual({ type: "evening" });
    });

    it("maps 'after lunch' to after lunch constraint", () => {
      const [c] = extractConstraints("read after lunch");
      expect(c).toEqual({ type: "after", target: "Lunch" });
    });

    it("maps 'before class' to before class constraint", () => {
      const [c] = extractConstraints("review notes before class");
      expect(c).toEqual({ type: "before", target: "Class" });
    });

    it("maps 'after work' to after work constraint", () => {
      const [c] = extractConstraints("gym after work");
      expect(c).toEqual({ type: "after", target: "Work" });
    });

    it("deduplicates overlapping before/bedtime matches", () => {
      const constraints = extractConstraints("read before bed");
      const before = constraints.filter(c => c.type === "before");
      expect(before).toHaveLength(1);
      expect(before[0].target).toBe("Bedtime");
    });

    it("returns anytime when no constraint is expressed", () => {
      const [c] = extractConstraints("finish assignment");
      expect(c).toEqual({ type: "anytime" });
    });
  });

  describe("scheduling against anchors", () => {
    it("places a task before bedtime (11 PM)", () => {
      const { plan } = scheduleDay(
        [],
        [makeTask({ title: "Journal", constraints: [{ type: "before", target: "Bedtime" }] })],
        [],
        []
      );
      const journal = plan.commitments.find(c => c.title === "Journal");
      expect(journal).toBeDefined();
      expect(endHour24(journal!.endTime)).toBeLessThanOrEqual(23);
    });

    it("places a task after waking (7:30 AM)", () => {
      const { plan } = scheduleDay(
        [],
        [makeTask({ title: "Meditation", constraints: [{ type: "after", target: "Wake" }] })],
        [],
        []
      );
      const meditation = plan.commitments.find(c => c.title === "Meditation");
      expect(meditation).toBeDefined();
      expect(startHour24(meditation!.startTime)).toBeGreaterThanOrEqual(8);
    });

    it("places a task before dinner using the dinner anchor", () => {
      const { plan } = scheduleDay(
        [],
        [makeTask({ title: "Exercise", constraints: [{ type: "before", target: "dinner" }] })],
        [],
        []
      );
      const exercise = plan.commitments.find(c => c.title === "Exercise");
      expect(exercise).toBeDefined();
      expect(endHour24(exercise!.endTime)).toBeLessThanOrEqual(20);
    });
  });
});