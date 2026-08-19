import { describe, it, expect } from "vitest";
import { routeConversation } from "../src/context/ConversationRouter";
import type { RelevantContext } from "../src/context/ContextEngine";

function makeCtx(overrides: Partial<RelevantContext> = {}): RelevantContext {
  return {
    identity: {
      values: ["discipline"],
      priorities: ["CAT"],
      lifeSeason: "student",
      rhythm: { preferredWakeTime: "7:00 AM", preferredSleepTime: "11:00 PM", studyPreference: "morning" },
    },
    currentSession: {
      activeCommitment: null,
      upcomingCommitments: [],
      completedToday: [],
    },
    workingMemory: {
      weekOf: "2026-08-14",
      activeGoals: ["CAT"],
      currentExperiments: [],
      activeFocus: ["Quant"],
      recentDecisions: [],
      lastUpdated: "2026-08-14T00:00:00Z",
    },
    relevantObservations: [],
    activeExperiments: [],
    recentReflections: [],
    trust: { score: 60, level: "building", trajectory: "stable" },
    todaySummary: { completed: 0, total: 3, percentComplete: 0 },
    ...overrides,
  };
}

describe("ConversationRouter", () => {
  it("routes planning keywords to daily_planning", () => {
    const result = routeConversation("plan my day", makeCtx());
    expect(result.reason).toBe("daily_planning");
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("routes reflection keywords", () => {
    const result = routeConversation("reflect on my patterns", makeCtx());
    expect(result.reason).toBe("reflection");
  });

  it("routes adjustment keywords", () => {
    const result = routeConversation("can we move this to tomorrow", makeCtx());
    expect(result.reason).toBe("adjustment");
  });

  it("routes identity keywords", () => {
    const result = routeConversation("who am I becoming", makeCtx());
    expect(result.reason).toBe("identity");
  });

  it("routes to session_start when in active session", () => {
    const ctx = makeCtx({
      currentSession: {
        activeCommitment: {
          id: "c1",
          title: "Quant",
          startTime: "2026-08-14T10:00:00Z",
          endTime: "2026-08-14T11:00:00Z",
          completed: false,
          locked: true,
          priority: "high",
        },
        upcomingCommitments: [],
        completedToday: [],
      },
    });

    const result = routeConversation("I'm here", ctx);
    expect(result.reason).toBe("session_start");
  });

  it("routes help requests to adjustment", () => {
    const result = routeConversation("I'm stuck", makeCtx());
    expect(result.reason).toBe("adjustment");
  });

  it("routes general chat as fallback", () => {
    const result = routeConversation("hello", makeCtx());
    expect(result.reason).toBe("general_chat");
    expect(result.confidence).toBeLessThan(0.6);
  });

  it("always returns a reason", () => {
    const result = routeConversation("anything", makeCtx());
    expect(result.reason).toBeTruthy();
    expect(result.confidence).toBeGreaterThan(0);
  });
});
