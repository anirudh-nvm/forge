import { describe, it, expect } from "vitest";
import { findOpportunities } from "../src/opportunity/OpportunityEngine";
import type { OpportunityContext } from "../src/opportunity/OpportunityTypes";
import type { Commitment } from "../src/types/commitment";
import type { Observation } from "../src/observation/ObservationTypes";
import type { MemoryProfile } from "../src/memory/MemoryProfile";
import type { IdentityProgress } from "../src/identity/IdentityTypes";
import type { TrustScore } from "../src/types/todayPlan";

function makeCtx(overrides: Partial<OpportunityContext> = {}): OpportunityContext {
  return {
    now: new Date("2026-08-14T10:00:00Z"),
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
        activeGoals: ["CAT prep"],
        currentExperiments: [],
        activeFocus: ["Quant revision"],
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
    identity: {
      lifeDirectionId: "ld-1",
      lifeDirectionTitle: "crack CAT and get into a top B-school",
      goalProgress: [
        {
          goalId: "g-1",
          goalTitle: "CAT Preparation",
          projectProgress: [],
          overallRate: 0.6,
        },
      ],
      generatedAt: "2026-08-14T00:00:00Z",
    },
    observations: [],
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
    text: "Morning commitments completed consistently",
    confidence: 0.8,
    supportingEvents: [],
    firstSeen: "2026-08-01T00:00:00Z",
    lastSeen: "2026-08-13T00:00:00Z",
    status: "new",
    ...overrides,
  };
}

describe("OpportunityEngine", () => {
  describe("findOpportunities", () => {
    it("returns empty for empty context", () => {
      const ctx = makeCtx();
      const opps = findOpportunities(ctx);
      expect(opps.length).toBe(0);
    });

    it("detects upcoming deadlines", () => {
      const commitment = makeCommitment({
        title: "CAT Mock",
        endTime: "2026-08-21T10:00:00Z",
      });

      const ctx = makeCtx({
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
      });

      const opps = findOpportunities(ctx);
      const deadline = opps.find((o) => o.type === "prepare");
      expect(deadline).toBeDefined();
      expect(deadline!.headline).toContain("CAT Mock");
      expect(deadline!.question).toContain("protect time");
    });

    it("detects consistency patterns with high confidence", () => {
      const obs = makeObservation({
        category: "timing",
        confidence: 0.8,
        metadata: {
          commitmentTitle: "Morning study",
          trendDirection: "up",
        },
      });

      const ctx = makeCtx({ observations: [obs] });
      const opps = findOpportunities(ctx);
      const protect = opps.find((o) => o.type === "protect_time");
      expect(protect).toBeDefined();
      expect(protect!.question).toContain("keep protecting");
    });

    it("detects declining trends as recovery opportunities", () => {
      const obs = makeObservation({
        category: "timing",
        confidence: 0.6,
        metadata: {
          commitmentTitle: "VARC practice",
          trendDirection: "down",
        },
      });

      const ctx = makeCtx({ observations: [obs] });
      const opps = findOpportunities(ctx);
      const recover = opps.find((o) => o.type === "recover");
      expect(recover).toBeDefined();
      expect(recover!.headline).toContain("slipping");
    });

    it("detects rhythm changes as memory change opportunities", () => {
      const obs = makeObservation({
        category: "rhythm",
        confidence: 0.8,
        metadata: {
          patternType: "new_pattern",
        },
      });

      const ctx = makeCtx({ observations: [obs] });
      const opps = findOpportunities(ctx);
      const memory = opps.find((o) => o.type === "remember_change");
      expect(memory).toBeDefined();
      expect(memory!.question).toContain("remember this pattern");
    });

    it("detects celebration opportunities when many completed", () => {
      const commitments = [
        makeCommitment({ id: "c1", title: "Quant", completed: true }),
        makeCommitment({ id: "c2", title: "VARC", completed: true }),
        makeCommitment({ id: "c3", title: "LRDI", completed: true }),
      ];

      const ctx = makeCtx({
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
      });

      const opps = findOpportunities(ctx);
      const celebrate = opps.find((o) => o.type === "celebrate");
      expect(celebrate).toBeDefined();
      expect(celebrate!.headline).toContain("3 commitments");
    });

    it("includes identity link in all opportunities", () => {
      const commitment = makeCommitment({
        title: "CAT Mock",
        endTime: "2026-08-21T10:00:00Z",
      });

      const ctx = makeCtx({
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
      });

      const opps = findOpportunities(ctx);
      for (const opp of opps) {
        expect(opp.identityLink).toBeTruthy();
        expect(opp.identityLink.length).toBeGreaterThan(0);
      }
    });

    it("sorts by priority descending", () => {
      const commitments = [
        makeCommitment({ id: "c1", title: "Close", endTime: "2026-08-16T10:00:00Z" }),
        makeCommitment({ id: "c2", title: "Far", endTime: "2026-08-28T10:00:00Z" }),
      ];

      const ctx = makeCtx({
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
      });

      const opps = findOpportunities(ctx);
      for (let i = 1; i < opps.length; i++) {
        expect(opps[i - 1].priority).toBeGreaterThanOrEqual(opps[i].priority);
      }
    });

    it("never produces automatic actions — only questions", () => {
      const obs = makeObservation({
        category: "timing",
        confidence: 0.9,
        metadata: { commitmentTitle: "Study", trendDirection: "up" },
      });

      const commitment = makeCommitment({
        title: "Exam",
        endTime: "2026-08-18T10:00:00Z",
      });

      const ctx = makeCtx({
        observations: [obs],
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
      });

      const opps = findOpportunities(ctx);
      for (const opp of opps) {
        expect(opp.question).toBeTruthy();
        expect(opp.question.endsWith("?")).toBe(true);
      }
    });
  });
});
