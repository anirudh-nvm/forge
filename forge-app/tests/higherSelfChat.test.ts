import { describe, it, expect } from "vitest";
import { formatHigherSelfForLLM, formatIdentityForLLM } from "../src/ai/HigherSelfContext";
import type { HigherSelfMessage } from "../src/memory/HigherSelf";

// ── Higher Self Test Suite ──────────────────────────────────────
// Tests for Sprint 7: Higher Self
// Verifies that identity growth insights are surfaced in chat

describe("Higher Self (Sprint 7)", () => {
  describe("formatHigherSelfForLLM", () => {
    it("formats Higher Self message for LLM", () => {
      const message: HigherSelfMessage = {
        id: "hs_1",
        text: "You've completed 8 of your last 10 sessions. That level of consistency is rare.",
        weight: "medium",
        category: "consistency",
        createdAt: new Date().toISOString(),
      };

      const result = formatHigherSelfForLLM(message);
      expect(result).toContain("HIGHER SELF INSIGHT");
      expect(result).toContain("8 of your last 10");
    });

    it("returns empty string for null message", () => {
      const result = formatHigherSelfForLLM(null);
      expect(result).toBe("");
    });

    it("includes message text", () => {
      const message: HigherSelfMessage = {
        id: "hs_2",
        text: "I've been watching quietly. You're becoming much more consistent.",
        weight: "heavy",
        category: "growth",
        createdAt: new Date().toISOString(),
      };

      const result = formatHigherSelfForLLM(message);
      expect(result).toContain("watching quietly");
    });
  });

  describe("formatIdentityForLLM", () => {
    it("formats identity for LLM", () => {
      const result = formatIdentityForLLM("Engineering Student", ["Clear JEE", "Get Internship"]);
      expect(result).toContain("IDENTITY CONTEXT");
      expect(result).toContain("Engineering Student");
      expect(result).toContain("Clear JEE");
    });

    it("formats identity without goals", () => {
      const result = formatIdentityForLLM("Student", []);
      expect(result).toContain("IDENTITY CONTEXT");
      expect(result).toContain("Student");
    });

    it("returns empty string for undefined identity", () => {
      const result = formatIdentityForLLM("undefined", []);
      expect(result).toBe("");
    });

    it("returns empty string for empty goals with undefined identity", () => {
      const result = formatIdentityForLLM("undefined", []);
      expect(result).toBe("");
    });

    it("formats multiple goals", () => {
      const result = formatIdentityForLLM("Developer", ["Build App", "Learn React", "Get Job"]);
      expect(result).toContain("Build App");
      expect(result).toContain("Learn React");
      expect(result).toContain("Get Job");
    });
  });

  describe("Higher Self Message Types", () => {
    it("growth message has valid structure", () => {
      const msg: HigherSelfMessage = {
        id: "hs_1",
        text: "You're becoming much more consistent than you were two months ago.",
        weight: "heavy",
        category: "growth",
        createdAt: new Date().toISOString(),
      };

      expect(msg.category).toBe("growth");
      expect(msg.weight).toBe("heavy");
      expect(msg.text.length).toBeGreaterThan(0);
    });

    it("setback message has valid structure", () => {
      const msg: HigherSelfMessage = {
        id: "hs_2",
        text: "I noticed the last few days have been hard. That's okay.",
        weight: "medium",
        category: "setback",
        createdAt: new Date().toISOString(),
      };

      expect(msg.category).toBe("setback");
      expect(msg.weight).toBe("medium");
    });

    it("consistency message has valid structure", () => {
      const msg: HigherSelfMessage = {
        id: "hs_3",
        text: "You've completed 8 of your last 10 sessions.",
        weight: "medium",
        category: "consistency",
        createdAt: new Date().toISOString(),
      };

      expect(msg.category).toBe("consistency");
      expect(msg.text).toContain("8");
    });

    it("milestone message has valid structure", () => {
      const msg: HigherSelfMessage = {
        id: "hs_4",
        text: "30-day streak. You've been consistent for a month.",
        weight: "heavy",
        category: "milestone",
        createdAt: new Date().toISOString(),
      };

      expect(msg.category).toBe("milestone");
      expect(msg.weight).toBe("heavy");
    });

    it("quiet message has valid structure", () => {
      const msg: HigherSelfMessage = {
        id: "hs_5",
        text: "It's been 2 months since you started. Look how far you've come.",
        weight: "light",
        category: "quiet",
        createdAt: new Date().toISOString(),
      };

      expect(msg.category).toBe("quiet");
      expect(msg.weight).toBe("light");
    });
  });

  describe("Edge Cases", () => {
    it("handles very long message text", () => {
      const msg: HigherSelfMessage = {
        id: "hs_1",
        text: "a".repeat(500),
        weight: "heavy",
        category: "growth",
        createdAt: new Date().toISOString(),
      };

      const result = formatHigherSelfForLLM(msg);
      expect(result.length).toBeGreaterThan(500);
    });

    it("handles special characters in identity", () => {
      const result = formatIdentityForLLM("CS & Engineering Student", []);
      expect(result).toContain("CS & Engineering Student");
    });

    it("handles unicode in goals", () => {
      const result = formatIdentityForLLM("Student", ["Score 95%+ in JEE"]);
      expect(result).toContain("95%+");
    });

    it("handles empty text gracefully", () => {
      const msg: HigherSelfMessage = {
        id: "hs_1",
        text: "",
        weight: "light",
        category: "quiet",
        createdAt: new Date().toISOString(),
      };

      const result = formatHigherSelfForLLM(msg);
      expect(result).toContain("HIGHER SELF INSIGHT");
    });
  });
});
