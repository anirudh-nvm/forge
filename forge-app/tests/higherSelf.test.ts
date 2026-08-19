import { describe, it, expect } from "vitest";
import { generateHigherSelfMessage } from "../src/memory/HigherSelf";
import type { HigherSelfContext } from "../src/memory/HigherSelf";
import type { TrustScore } from "../src/types/todayPlan";

function makeCtx(overrides: Partial<HigherSelfContext> = {}): HigherSelfContext {
  return {
    trustScore: { current: 50, history: [] },
    observations: [],
    milestones: [],
    daysSinceFirstUse: 0,
    now: new Date("2026-08-14T10:00:00Z"),
    ...overrides,
  };
}

function makeHistory(count: number, outcome: "completed" | "skipped" = "completed"): TrustScore["history"] {
  return Array.from({ length: count }, (_, i) => ({
    sessionId: `s${i}`,
    outcome,
    isProtected: true,
    trustChange: outcome === "completed" ? 6 : -4,
    timestamp: new Date(`2026-08-${String(i + 1).padStart(2, "0")}T10:00:00Z`),
  }));
}

describe("HigherSelf", () => {
  describe("generateHigherSelfMessage", () => {
    it("returns null for new users", () => {
      const result = generateHigherSelfMessage(makeCtx());
      expect(result).toBeNull();
    });

    it("speaks when no previous message", () => {
      const result = generateHigherSelfMessage(
        makeCtx({
          trustScore: { current: 60, history: makeHistory(20) },
        })
      );
      expect(result).not.toBeNull();
    });

    it("does not speak too frequently", () => {
      const result = generateHigherSelfMessage(
        makeCtx({
          trustScore: { current: 60, history: makeHistory(20) },
          lastHigherSelfDate: "2026-08-13T10:00:00Z",
          now: new Date("2026-08-14T10:00:00Z"),
        })
      );
      expect(result).toBeNull();
    });

    it("speaks after 7 days", () => {
      const result = generateHigherSelfMessage(
        makeCtx({
          trustScore: { current: 60, history: makeHistory(20) },
          lastHigherSelfDate: "2026-08-07T10:00:00Z",
          now: new Date("2026-08-14T10:00:00Z"),
        })
      );
      expect(result).not.toBeNull();
    });

    it("detects growth trajectory", () => {
      const history = [
        ...makeHistory(10, "skipped"),
        ...makeHistory(10, "completed"),
      ];

      const result = generateHigherSelfMessage(
        makeCtx({
          trustScore: { current: 60, history },
        })
      );

      expect(result).not.toBeNull();
      expect(result!.category).toBe("growth");
      expect(result!.text).toContain("consistent");
    });

    it("detects setback", () => {
      const result = generateHigherSelfMessage(
        makeCtx({
          trustScore: {
            current: 30,
            history: [
              ...makeHistory(3, "completed"),
              ...makeHistory(4, "skipped"),
            ],
          },
        })
      );

      if (result) {
        expect(result.category).toBe("setback");
        expect(result.text).toContain("hard");
      }
    });

    it("detects high consistency", () => {
      const result = generateHigherSelfMessage(
        makeCtx({
          trustScore: {
            current: 80,
            history: makeHistory(10),
          },
        })
      );

      if (result) {
        expect(result.category).toBe("consistency");
        expect(result.text).toContain("10");
      }
    });

    it("returns heavy weight for growth messages", () => {
      const history = [
        ...makeHistory(10, "skipped"),
        ...makeHistory(10, "completed"),
      ];

      const result = generateHigherSelfMessage(
        makeCtx({
          trustScore: { current: 60, history },
        })
      );

      if (result) {
        expect(result.weight).toBe("heavy");
      }
    });
  });
});
