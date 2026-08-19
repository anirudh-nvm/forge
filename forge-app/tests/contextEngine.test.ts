import { describe, it, expect } from "vitest";
import { buildContext } from "../src/context/ContextEngine";
import type { CurrentMoment } from "../src/context/ContextEngine";
import type { Commitment } from "../src/types/commitment";
import type { Observation } from "../src/observation/ObservationTypes";
import type { TrustScore } from "../src/types/todayPlan";

function makeMoment(overrides: Partial<CurrentMoment> = {}): CurrentMoment {
  return {
    now: new Date("2026-08-14T10:00:00Z"),
    todayPlan: {
      greeting: "Good morning",
      summary: [],
      commitments: [],
      timeline: [],
      unscheduled: [],
      warnings: [],
      recommendation: "",
      status: "active",
    },
    memory: {
      stable: {
        lifeSeason: "student",
        priorities: ["CAT prep"],
        values: ["discipline"],
        rhythm: { preferredWakeTime: "7:00 AM", preferredSleepTime: "11:00 PM", studyPreference: "morning" },
        constraints: [],
        lastUpdated: "2026-08-14T00:00:00Z",
      },
      working: {
        weekOf: "2026-08-14",
        activeGoals: ["CAT"],
        currentExperiments: [],
        activeFocus: ["Quant"],
        recentDecisions: [],
        lastUpdated: "2026-08-14T00:00:00Z",
      },
      recent: {
        date: "2026-08-14",
        planId: null,
        observations: [],
        adjustments: [],
        reflections: [],
        lastUpdated: "2026-08-14T00:00:00Z",
      },
      lastBuilt: "2026-08-14T00:00:00Z",
    },
    observations: [],
    experiments: [],
    trust: { current: 60, history: [] },
    ...overrides,
  };
}

function makeCommitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: "c1",
    title: "Quant revision",
    startTime: "2026-08-14T10:00:00Z",
    endTime: "2026-08-14T11:00:00Z",
    completed: false,
    locked: false,
    priority: "high",
    ...overrides,
  };
}

function makeObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    id: "obs-1",
    category: "timing",
    text: "Morning study works well",
    confidence: 0.8,
    supportingEvents: [],
    firstSeen: "2026-08-01T00:00:00Z",
    lastSeen: "2026-08-13T00:00:00Z",
    status: "new",
    ...overrides,
  };
}

describe("ContextEngine", () => {
  describe("buildContext", () => {
    it("returns identity from stable memory", () => {
      const ctx = buildContext(makeMoment());
      expect(ctx.identity.values).toContain("discipline");
      expect(ctx.identity.lifeSeason).toBe("student");
    });

    it("detects active commitment", () => {
      const commitment = makeCommitment({
        startTime: "2026-08-14T09:30:00Z",
        endTime: "2026-08-14T10:30:00Z",
      });

      const ctx = buildContext(
        makeMoment({
          now: new Date("2026-08-14T10:00:00Z"),
          todayPlan: {
            greeting: "Good morning",
            summary: [],
            commitments: [commitment],
            timeline: [],
            unscheduled: [],
            warnings: [],
            recommendation: "",
            status: "active",
          },
        })
      );

      expect(ctx.currentSession.activeCommitment).toBeDefined();
      expect(ctx.currentSession.activeCommitment!.title).toBe("Quant revision");
    });

    it("detects upcoming commitments", () => {
      const commitment = makeCommitment({
        startTime: "2026-08-14T14:00:00Z",
        endTime: "2026-08-14T15:00:00Z",
      });

      const ctx = buildContext(
        makeMoment({
          now: new Date("2026-08-14T10:00:00Z"),
          todayPlan: {
            greeting: "Good morning",
            summary: [],
            commitments: [commitment],
            timeline: [],
            unscheduled: [],
            warnings: [],
            recommendation: "",
            status: "active",
          },
        })
      );

      expect(ctx.currentSession.upcomingCommitments.length).toBe(1);
    });

    it("scores observations by relevance", () => {
      const obs1 = makeObservation({
        id: "obs-1",
        confidence: 0.9,
        lastSeen: "2026-08-14T00:00:00Z",
        metadata: { commitmentTitle: "Quant revision" },
      });
      const obs2 = makeObservation({
        id: "obs-2",
        text: "VARC is hard",
        confidence: 0.5,
        lastSeen: "2026-08-08T00:00:00Z",
        metadata: { commitmentTitle: "VARC" },
      });

      const ctx = buildContext(
        makeMoment({
          observations: [obs1, obs2],
          todayPlan: {
            greeting: "Good morning",
            summary: [],
            commitments: [makeCommitment()],
            timeline: [],
            unscheduled: [],
            warnings: [],
            recommendation: "",
            status: "active",
          },
        })
      );

      expect(ctx.relevantObservations.length).toBeGreaterThanOrEqual(1);
      expect(ctx.relevantObservations[0].id).toBe("obs-1");
    });

    it("computes today summary", () => {
      const commitments = [
        makeCommitment({ id: "c1", completed: true }),
        makeCommitment({ id: "c2", completed: true }),
        makeCommitment({ id: "c3", completed: false }),
      ];

      const ctx = buildContext(
        makeMoment({
          todayPlan: {
            greeting: "Good morning",
            summary: [],
            commitments,
            timeline: [],
            unscheduled: [],
            warnings: [],
            recommendation: "",
            status: "active",
          },
        })
      );

      expect(ctx.todaySummary.completed).toBe(2);
      expect(ctx.todaySummary.total).toBe(3);
      expect(ctx.todaySummary.percentComplete).toBe(67);
    });

    it("returns trust with trajectory", () => {
      const history = [
        { sessionId: "s1", outcome: "completed" as const, isProtected: true, trustChange: 6, timestamp: new Date("2026-08-10") },
        { sessionId: "s2", outcome: "completed" as const, isProtected: true, trustChange: 6, timestamp: new Date("2026-08-11") },
      ];

      const ctx = buildContext(makeMoment({ trust: { current: 70, history } }));
      expect(ctx.trust.trajectory).toBe("improving");
    });

    it("limits observations to 8", () => {
      const observations = Array.from({ length: 12 }, (_, i) =>
        makeObservation({
          id: `obs-${i}`,
          confidence: 0.9,
          lastSeen: "2026-08-14T00:00:00Z",
        })
      );

      const ctx = buildContext(makeMoment({ observations }));
      expect(ctx.relevantObservations.length).toBeLessThanOrEqual(8);
    });
  });
});
