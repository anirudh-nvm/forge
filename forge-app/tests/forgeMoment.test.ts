import { describe, it, expect } from "vitest";
import { generateForgeMoment } from "../src/experience/ForgeMoment";
import type { ForgeMomentInput } from "../src/experience/ForgeMoment";

function makeInput(overrides: Partial<ForgeMomentInput> = {}): ForgeMomentInput {
  return {
    memory: {
      stable: {
        lifeSeason: "student",
        priorities: [],
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
    planningMemory: {
      preferredTimeWindow: "morning",
      timeWindowSuccessRate: 0.85,
      avgCompletionRate: 0.7,
      totalEvents: 10,
      recentTrend: "improving",
    },
    todayPlan: { commitments: [] },
    ...overrides,
  };
}

describe("ForgeMoment", () => {
  describe("generateForgeMoment", () => {
    it("returns a greeting based on time of day", () => {
      const moment = generateForgeMoment(makeInput());
      expect(moment.greeting).toBeTruthy();
      expect(
        moment.greeting === "Good morning" ||
        moment.greeting === "Good afternoon" ||
        moment.greeting === "Good evening"
      ).toBe(true);
    });

    it("returns observation and question", () => {
      const moment = generateForgeMoment(makeInput());
      expect(moment.observation).toBeTruthy();
      expect(moment.timestamp).toBeTruthy();
    });

    it("generates consistency win when observations exist", () => {
      const input = makeInput({
        observations: [
          {
            id: "obs-1",
            category: "timing",
            text: "Morning study works",
            confidence: 0.8,
            supportingEvents: [],
            firstSeen: "2026-08-01T00:00:00Z",
            lastSeen: "2026-08-13T00:00:00Z",
            status: "new",
            metadata: {
              commitmentTitle: "Morning Quant",
              trendDirection: "up",
              sampleSize: 6,
            },
          },
        ],
      });

      const moment = generateForgeMoment(input);
      expect(moment.observation).toContain("Morning Quant");
      expect(moment.question).toContain("keep protecting");
    });

    it("generates planning insight when memory exists", () => {
      const input = makeInput({
        observations: [],
        planningMemory: {
          preferredTimeWindow: "morning",
          timeWindowSuccessRate: 0.85,
          avgCompletionRate: 0.7,
          totalEvents: 5,
          recentTrend: "stable",
        },
      });

      const moment = generateForgeMoment(input);
      expect(moment.observation).toContain("morning");
      expect(moment.observation).toContain("85%");
    });

    it("generates celebration when commitments completed", () => {
      const input = makeInput({
        observations: [],
        planningMemory: {
          preferredTimeWindow: "morning",
          timeWindowSuccessRate: 0,
          avgCompletionRate: 0,
          totalEvents: 0,
          recentTrend: "stable",
        },
        memory: {
          stable: {
            lifeSeason: "student",
            priorities: [],
            values: [],
            rhythm: { preferredWakeTime: "7:00 AM", preferredSleepTime: "11:00 PM", studyPreference: "morning" },
            constraints: [],
            lastUpdated: "2026-08-14T00:00:00Z",
          },
          working: {
            weekOf: "2026-08-14",
            activeGoals: [],
            currentExperiments: [],
            activeFocus: [],
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
          commitments: [
            { title: "Quant", completed: true },
            { title: "VARC", completed: true },
            { title: "LRDI", completed: true },
          ],
        },
      });

      const moment = generateForgeMoment(input);
      expect(moment.observation).toContain("3 commitments");
      expect(moment.question).toContain("what worked");
    });

    it("always has a timestamp", () => {
      const moment = generateForgeMoment(makeInput());
      expect(moment.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });
  });
});
