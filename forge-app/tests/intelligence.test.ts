import { describe, it, expect } from "vitest";
import {
  buildTrustObservation,
  buildIdentityCard,
  buildSessionStreak,
  buildReflectionPrompt,
  buildForgeMoment,
} from "../src/intelligence/IntelligenceBuilder";
import type { IntelligenceContext } from "../src/intelligence/IntelligenceBuilder";
import type { TrustScore, Session } from "../src/types/todayPlan";
import type { Observation } from "../src/observation/ObservationTypes";

function makeCtx(overrides: Partial<IntelligenceContext> = {}): IntelligenceContext {
  return {
    trustScore: { current: 60, history: [] },
    observations: [],
    memory: {
      stable: {
        lifeSeason: "student",
        priorities: ["CAT"],
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
    identity: {
      lifeDirectionId: "ld-1",
      lifeDirectionTitle: "crack CAT",
      goalProgress: [
        { goalId: "g-1", goalTitle: "CAT Preparation", projectProgress: [], overallRate: 0.6 },
      ],
      generatedAt: "2026-08-14T00:00:00Z",
    },
    completedSessions: [],
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "s1",
    title: "DSA",
    scheduledStart: "2026-08-14T10:00:00",
    scheduledEnd: "2026-08-14T11:00:00",
    status: "completed",
    outcome: "completed",
    durationMinutes: 60,
    message: [],
    isProtected: true,
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

describe("IntelligenceBuilder", () => {
  describe("buildTrustObservation", () => {
    it("returns score and level", () => {
      const result = buildTrustObservation(makeCtx());
      expect(result.score).toBe(60);
      expect(result.level).toBe("building");
    });

    it("detects improving trajectory", () => {
      const history = [
        { sessionId: "s1", outcome: "completed" as const, isProtected: true, trustChange: 6, timestamp: new Date() },
        { sessionId: "s2", outcome: "completed" as const, isProtected: true, trustChange: 6, timestamp: new Date() },
      ];
      const result = buildTrustObservation(makeCtx({ trustScore: { current: 70, history } }));
      expect(result.trajectory).toBe("improving");
    });

    it("builds streak message when completions are high", () => {
      const history = Array.from({ length: 6 }, (_, i) => ({
        sessionId: `s${i}`,
        outcome: "completed" as const,
        isProtected: true,
        trustChange: 6,
        timestamp: new Date(),
      }));
      const result = buildTrustObservation(makeCtx({ trustScore: { current: 80, history } }));
      expect(result.streakMessage).toContain("promises");
    });
  });

  describe("buildIdentityCard", () => {
    it("returns identity connection", () => {
      const result = buildIdentityCard(makeCtx(), "Quant revision");
      expect(result).toBeDefined();
      expect(result!.connectionText).toContain("crack CAT");
    });

    it("returns null when no life direction", () => {
      const ctx = makeCtx({
        identity: { lifeDirectionId: "", lifeDirectionTitle: "", goalProgress: [], generatedAt: "" },
      });
      const result = buildIdentityCard(ctx);
      expect(result).toBeNull();
    });

    it("matches goal to commitment title", () => {
      const result = buildIdentityCard(makeCtx(), "CAT Preparation");
      expect(result!.goalTitle).toBe("CAT Preparation");
      expect(result!.connectionText).toContain("CAT Preparation");
    });
  });

  describe("buildSessionStreak", () => {
    it("returns null for empty sessions", () => {
      const result = buildSessionStreak(makeCtx());
      expect(result).toBeNull();
    });

    it("calculates completion rate", () => {
      const sessions = [
        makeSession({ id: "s1", outcome: "completed" }),
        makeSession({ id: "s2", outcome: "completed" }),
        makeSession({ id: "s3", outcome: "skipped" }),
      ];
      const result = buildSessionStreak(makeCtx({ completedSessions: sessions }));
      expect(result).toBeDefined();
      expect(result!.completedCount).toBe(2);
      expect(result!.totalCount).toBe(3);
    });

    it("detects consecutive streak", () => {
      const sessions = [
        makeSession({ id: "s1", outcome: "completed" }),
        makeSession({ id: "s2", outcome: "completed" }),
        makeSession({ id: "s3", outcome: "completed" }),
      ];
      const result = buildSessionStreak(makeCtx({ completedSessions: sessions }));
      expect(result!.currentStreak).toBe(3);
      expect(result!.message).toContain("3 in a row");
    });
  });

  describe("buildReflectionPrompt", () => {
    it("returns null when no observations", () => {
      const result = buildReflectionPrompt(makeCtx());
      expect(result).toBeNull();
    });

    it("builds prompt from high-confidence observation", () => {
      const obs = makeObservation({ confidence: 0.8 });
      const result = buildReflectionPrompt(makeCtx({ observations: [obs] }));
      expect(result).toBeDefined();
      expect(result!.observationText).toBe("Morning study works well");
      expect(result!.question).toContain("describe your schedule");
    });

    it("filters dismissed observations", () => {
      const obs = makeObservation({ status: "dismissed" });
      const result = buildReflectionPrompt(makeCtx({ observations: [obs] }));
      expect(result).toBeNull();
    });
  });

  describe("buildForgeMoment", () => {
    it("returns greeting based on time", () => {
      const moment = buildForgeMoment(makeCtx(), 0);
      expect(moment.greeting).toBeTruthy();
      expect(
        moment.greeting === "Good morning." ||
        moment.greeting === "Good afternoon." ||
        moment.greeting === "Good evening."
      ).toBe(true);
    });

    it("shows consistency win when observation exists", () => {
      const obs = makeObservation({
        category: "timing",
        confidence: 0.8,
        metadata: {
          commitmentTitle: "Quant",
          trendDirection: "up",
          sampleSize: 6,
        },
      });
      const moment = buildForgeMoment(makeCtx({ observations: [obs] }), 0);
      expect(moment.observation).toContain("Quant");
      expect(moment.question).toContain("keep protecting");
    });

    it("shows celebration when commitments completed", () => {
      const moment = buildForgeMoment(makeCtx(), 3);
      expect(moment.observation).toContain("3 commitments");
    });

    it("returns default when nothing notable", () => {
      const moment = buildForgeMoment(makeCtx(), 0);
      expect(moment.observation).toBeTruthy();
    });
  });
});
