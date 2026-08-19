import { describe, it, expect } from "vitest";
import { calculateTrustChange, updateTrustScore, getTrustLevel, getTrustMessage } from "../src/engine/TrustEngine";
import type { TrustScore } from "../src/types/todayPlan";

function makeScore(current: number): TrustScore {
  return { current, history: [] };
}

describe("TrustEngine", () => {
  describe("calculateTrustChange", () => {
    it("completed protected +6", () => {
      expect(calculateTrustChange("completed", true)).toBe(6);
    });

    it("completed unprotected +3", () => {
      expect(calculateTrustChange("completed", false)).toBe(3);
    });

    it("mostlyCompleted protected +2", () => {
      expect(calculateTrustChange("mostlyCompleted", true)).toBe(2);
    });

    it("mostlyCompleted unprotected +1", () => {
      expect(calculateTrustChange("mostlyCompleted", false)).toBe(1);
    });

    it("notCompleted protected -2", () => {
      expect(calculateTrustChange("notCompleted", true)).toBe(-2);
    });

    it("notCompleted unprotected -1", () => {
      expect(calculateTrustChange("notCompleted", false)).toBe(-1);
    });

    it("skipped protected -4", () => {
      expect(calculateTrustChange("skipped", true)).toBe(-4);
    });

    it("skipped unprotected -2", () => {
      expect(calculateTrustChange("skipped", false)).toBe(-2);
    });
  });

  describe("updateTrustScore", () => {
    it("adds trust change to current score", () => {
      const result = updateTrustScore(makeScore(50), "s1", "completed", true);
      expect(result.current).toBe(56);
    });

    it("appends to history", () => {
      const result = updateTrustScore(makeScore(50), "s1", "completed", true);
      expect(result.history).toHaveLength(1);
      expect(result.history[0].sessionId).toBe("s1");
      expect(result.history[0].trustChange).toBe(6);
    });

    it("clamps to 0", () => {
      const result = updateTrustScore(makeScore(2), "s1", "skipped", true);
      expect(result.current).toBe(0);
    });

    it("clamps to 100", () => {
      const result = updateTrustScore(makeScore(98), "s1", "completed", true);
      expect(result.current).toBe(100);
    });

    it("preserves existing history", () => {
      const score: TrustScore = {
        current: 50,
        history: [{ sessionId: "old", outcome: "completed", isProtected: true, trustChange: 6, timestamp: new Date() }],
      };
      const result = updateTrustScore(score, "s2", "completed", false);
      expect(result.history).toHaveLength(2);
      expect(result.history[0].sessionId).toBe("old");
    });
  });

  describe("getTrustLevel", () => {
    it("strong >= 80", () => {
      expect(getTrustLevel(80)).toBe("strong");
      expect(getTrustLevel(100)).toBe("strong");
    });

    it("building >= 60", () => {
      expect(getTrustLevel(60)).toBe("building");
      expect(getTrustLevel(79)).toBe("building");
    });

    it("developing >= 40", () => {
      expect(getTrustLevel(40)).toBe("developing");
      expect(getTrustLevel(59)).toBe("developing");
    });

    it("recovering >= 20", () => {
      expect(getTrustLevel(20)).toBe("recovering");
      expect(getTrustLevel(39)).toBe("recovering");
    });

    it("rebuilding < 20", () => {
      expect(getTrustLevel(0)).toBe("rebuilding");
      expect(getTrustLevel(19)).toBe("rebuilding");
    });
  });

  describe("getTrustMessage", () => {
    it("returns contextual message with score", () => {
      expect(getTrustMessage(80)).toContain("Trust: 80");
      expect(getTrustMessage(60)).toContain("Trust: 60");
      expect(getTrustMessage(0)).toContain("Trust: 0");
    });

    it("reflects improving trajectory in message", () => {
      const history = [
        { sessionId: "s1", outcome: "completed" as const, isProtected: true, trustChange: 6, timestamp: new Date("2026-08-10") },
        { sessionId: "s2", outcome: "completed" as const, isProtected: true, trustChange: 6, timestamp: new Date("2026-08-11") },
      ];
      const msg = getTrustMessage(62, history);
      expect(msg).toContain("Going up");
    });

    it("reflects declining trajectory in message", () => {
      const history = [
        { sessionId: "s1", outcome: "skipped" as const, isProtected: true, trustChange: -4, timestamp: new Date("2026-08-10") },
        { sessionId: "s2", outcome: "skipped" as const, isProtected: true, trustChange: -4, timestamp: new Date("2026-08-11") },
        { sessionId: "s3", outcome: "skipped" as const, isProtected: true, trustChange: -4, timestamp: new Date("2026-08-12") },
      ];
      const msg = getTrustMessage(30, history);
      expect(msg).toContain("Slipping");
    });

    it("handles empty history gracefully", () => {
      const msg = getTrustMessage(50);
      expect(msg).toContain("Trust: 50");
    });
  });
});
