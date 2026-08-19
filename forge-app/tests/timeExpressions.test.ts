import { describe, it, expect } from "vitest";
import { extractConstraints } from "../src/brain/pipeline/ConstraintExtractor";
import { detectDayExpression, isForToday } from "../src/brain/pipeline/TimeExpressions";
import { preprocessConversation } from "../src/brain/Preprocessor";

describe("Time Expressions", () => {
  describe("day detection", () => {
    it("detects tomorrow", () => {
      expect(detectDayExpression("finish cat tomorrow morning")).toEqual({ daysFromNow: 1, label: "tomorrow" });
    });

    it("detects the day after tomorrow", () => {
      expect(detectDayExpression("dentist the day after tomorrow")).toEqual({ daysFromNow: 2, label: "day after tomorrow" });
    });

    it("treats unqualified items as today", () => {
      expect(detectDayExpression("gym at 5")).toEqual({ daysFromNow: 0, label: "today" });
    });

    it("isForToday returns false for tomorrow", () => {
      expect(isForToday("first thing tomorrow gym")).toBe(false);
      expect(isForToday("study this evening")).toBe(true);
    });
  });

  describe("first thing / late afternoon constraints", () => {
    it("extracts first_thing", () => {
      const [c] = extractConstraints("first thing tomorrow cat");
      expect(c).toEqual({ type: "first_thing", target: undefined, tight: undefined });
    });

    it("extracts late_afternoon", () => {
      const [c] = extractConstraints("study late afternoon");
      expect(c.type).toBe("late_afternoon");
    });
  });

  describe("right after coupling", () => {
    it("adds tight after constraint for right after an entity", () => {
      const constraints = extractConstraints("decompress right after college");
      const after = constraints.find(c => c.type === "after" && c.target === "College");
      expect(after).toBeDefined();
      expect(after!.tight).toBe(true);
    });

    it("keeps plain after loose", () => {
      const constraints = extractConstraints("decompress after college");
      const after = constraints.find(c => c.type === "after" && c.target === "College");
      expect(after).toBeDefined();
      expect(after!.tight).not.toBe(true);
    });
  });

  describe("natural phrase understanding", () => {
    it("understands after lunch", () => {
      const [c] = extractConstraints("dsa anytime after lunch");
      const after = c.type === "after" && c.target === "Lunch" ? c : undefined;
      expect(after).toBeDefined();
    });

    it("understands before bed", () => {
      const [c] = extractConstraints("finish cat before bed");
      expect(c).toEqual({ type: "before", target: "Bedtime", tight: undefined });
    });

    it("understands after dinner", () => {
      const [c] = extractConstraints("cat after dinner");
      expect(c).toEqual({ type: "after", target: "Dinner", tight: undefined });
    });
  });

  describe("preprocessor deferral", () => {
    it("defers tomorrow items out of today's plan", () => {
      const { output } = preprocessConversation({
        conversation: "college from 9 to 5. gym tomorrow afternoon.",
        priorities: [],
        currentTime: new Date("2026-08-11T09:00:00"),
      });
      const todays = output.extractedItems.filter(i => i.name === "Gym");
      expect(todays).toHaveLength(0);
      expect(output.deferredItems.some(i => i.name === "Gym")).toBe(true);
    });

    it("keeps today items in plan", () => {
      const { output } = preprocessConversation({
        conversation: "gym at 5pm. college 9 to 5.",
        priorities: [],
        currentTime: new Date("2026-08-11T09:00:00"),
      });
      expect(output.extractedItems.some(i => i.name === "Gym")).toBe(true);
      expect(output.deferredItems).toHaveLength(0);
    });
  });
});