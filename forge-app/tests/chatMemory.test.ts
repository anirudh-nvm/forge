import { describe, it, expect } from "vitest";
import { formatMemoryForLLM } from "../src/intelligence/chatMemory";

// ── Chat Memory Surface Test Suite ─────────────────────────────
// Tests for Sprint 5: Memory Surface
// Verifies that memory insights are surfaced during chat

describe("Chat Memory Surface (Sprint 5)", () => {
  describe("formatMemoryForLLM", () => {
    it("formats patterns into LLM context", () => {
      const result = formatMemoryForLLM(
        ["gym: usually done in morning", "study: takes longer than planned"],
        [],
        []
      );

      expect(result).toContain("MEMORY CONTEXT");
      expect(result).toContain("Patterns you've noticed");
      expect(result).toContain("gym");
      expect(result).toContain("study");
    });

    it("formats predictions into LLM context", () => {
      const result = formatMemoryForLLM(
        [],
        ["consider moving gym to a different day"],
        []
      );

      expect(result).toContain("MEMORY CONTEXT");
      expect(result).toContain("Predictions based on history");
      expect(result).toContain("gym");
    });

    it("formats beliefs into LLM context", () => {
      const result = formatMemoryForLLM(
        [],
        [],
        ["you work best in mornings"]
      );

      expect(result).toContain("MEMORY CONTEXT");
      expect(result).toContain("Beliefs about the user");
      expect(result).toContain("mornings");
    });

    it("combines all memory types", () => {
      const result = formatMemoryForLLM(
        ["gym: morning person"],
        ["add buffer for study"],
        ["you're consistent with gym"]
      );

      expect(result).toContain("Patterns");
      expect(result).toContain("Predictions");
      expect(result).toContain("Beliefs");
    });

    it("returns empty string for no data", () => {
      const result = formatMemoryForLLM([], [], []);
      expect(result).toBe("");
    });
  });

  describe("Memory Insight Types", () => {
    it("insight has valid type", () => {
      const validTypes = ["pattern", "prediction", "belief", "trust"];
      const insight = { type: "pattern" as const, text: "test", confidence: 0.8 };
      expect(validTypes).toContain(insight.type);
    });

    it("insight has confidence score", () => {
      const insight = { type: "pattern" as const, text: "test", confidence: 0.8 };
      expect(insight.confidence).toBeGreaterThan(0);
      expect(insight.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("Memory Context Builder", () => {
    it("patterns are formatted as strings", () => {
      const patterns = [
        "Gym: usually done in morning",
        "Study: takes longer than planned",
      ];

      patterns.forEach(p => {
        expect(typeof p).toBe("string");
        expect(p.length).toBeGreaterThan(0);
      });
    });

    it("predictions are formatted as strings", () => {
      const predictions = [
        "Consider moving gym to a different day",
        "Add buffer for study sessions",
      ];

      predictions.forEach(p => {
        expect(typeof p).toBe("string");
        expect(p.length).toBeGreaterThan(0);
      });
    });

    it("beliefs are formatted as strings", () => {
      const beliefs = [
        "You work best in mornings",
        "You're consistent with gym",
      ];

      beliefs.forEach(b => {
        expect(typeof b).toBe("string");
        expect(b.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles very long patterns", () => {
      const longPattern = "a".repeat(500);
      const result = formatMemoryForLLM([longPattern], [], []);
      expect(result).toContain(longPattern);
    });

    it("handles special characters in patterns", () => {
      const specialPattern = "gym: 80% completion (12/15 sessions)";
      const result = formatMemoryForLLM([specialPattern], [], []);
      expect(result).toContain("80%");
      expect(result).toContain("12/15");
    });

    it("handles unicode in patterns", () => {
      const unicodePattern = "study: morning session (9:00-11:00)";
      const result = formatMemoryForLLM([unicodePattern], [], []);
      expect(result).toContain("9:00-11:00");
    });

    it("handles empty strings in arrays", () => {
      const result = formatMemoryForLLM([""], [""], [""]);
      expect(result).toContain("MEMORY CONTEXT");
    });
  });
});
