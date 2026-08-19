import { describe, it, expect } from "vitest";
import { detectMilestones } from "../src/memory/MilestoneEngine";
import type { MilestoneContext } from "../src/memory/MilestoneEngine";
import type { TrustScore } from "../src/types/todayPlan";

function makeCtx(overrides: Partial<MilestoneContext> = {}): MilestoneContext {
  return {
    trustScore: { current: 50, history: [] },
    experiments: [],
    observations: [],
    reflections: [],
    dayArchiveCount: 0,
    totalSessions: 0,
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

describe("MilestoneEngine", () => {
  describe("detectMilestones", () => {
    it("returns empty for fresh user", () => {
      const milestones = detectMilestones(makeCtx());
      expect(milestones).toHaveLength(0);
    });

    it("detects first use", () => {
      const milestones = detectMilestones(
        makeCtx({
          firstUseDate: "2026-08-14T10:00:00Z",
          now: new Date("2026-08-14T10:00:00Z"),
        })
      );
      const first = milestones.find((m) => m.category === "first_use");
      expect(first).toBeDefined();
      expect(first!.title).toBe("Started Forge");
    });

    it("detects 10-session milestone", () => {
      const milestones = detectMilestones(
        makeCtx({ totalSessions: 10 })
      );
      const session = milestones.find((m) => m.category === "session_count");
      expect(session).toBeDefined();
      expect(session!.title).toContain("10");
    });

    it("detects trust reaching 60", () => {
      const history = makeHistory(15);
      const milestones = detectMilestones(
        makeCtx({
          trustScore: { current: 62, history },
        })
      );
      const trust = milestones.find((m) => m.category === "trust_milestone");
      expect(trust).toBeDefined();
      expect(trust!.title).toContain("60");
    });

    it("detects 7-day streak", () => {
      const milestones = detectMilestones(
        makeCtx({
          trustScore: {
            current: 80,
            history: makeHistory(7),
          },
        })
      );
      const streak = milestones.find((m) => m.category === "streak");
      expect(streak).toBeDefined();
      expect(streak!.title).toContain("7");
    });

    it("detects successful experiments", () => {
      const milestones = detectMilestones(
        makeCtx({
          experiments: [
            {
              id: "exp-1",
              title: "Morning Quant",
              hypothesis: "Mornings are better",
              commitmentTitle: "Quant",
              status: "completed",
              startDate: "2026-08-01",
              endDate: "2026-08-14",
              metrics: [],
              outcome: "successful",
              notes: ["Worked great"],
              createdAt: "2026-08-01T00:00:00Z",
              closedAt: "2026-08-14T00:00:00Z",
            },
          ],
        })
      );
      const exp = milestones.find((m) => m.category === "experiment");
      expect(exp).toBeDefined();
      expect(exp!.title).toContain("Morning Quant");
    });

    it("detects recovery from rough patch", () => {
      const history = [
        ...makeHistory(5, "skipped"),
        ...makeHistory(5, "completed"),
        ...makeHistory(5, "completed"),
      ];

      const milestones = detectMilestones(
        makeCtx({
          trustScore: { current: 60, history },
        })
      );
      const recovery = milestones.find((m) => m.category === "recovery");
      expect(recovery).toBeDefined();
    });

    it("sorts by weight descending", () => {
      const milestones = detectMilestones(
        makeCtx({
          totalSessions: 10,
          trustScore: {
            current: 80,
            history: makeHistory(7),
          },
        })
      );

      for (let i = 1; i < milestones.length; i++) {
        expect(milestones[i - 1].weight).toBeGreaterThanOrEqual(milestones[i].weight);
      }
    });

    it("all milestones have required fields", () => {
      const milestones = detectMilestones(
        makeCtx({
          totalSessions: 10,
          trustScore: {
            current: 62,
            history: makeHistory(15),
          },
        })
      );

      for (const m of milestones) {
        expect(m.id).toBeTruthy();
        expect(m.date).toBeTruthy();
        expect(m.month).toBeTruthy();
        expect(m.title).toBeTruthy();
        expect(m.description).toBeTruthy();
        expect(m.weight).toBeGreaterThan(0);
      }
    });
  });
});
