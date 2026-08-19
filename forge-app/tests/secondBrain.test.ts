import { describe, it, expect } from "vitest";
import { secondBrainScan } from "../src/memory/SecondBrain";
import type { SecondBrainContext } from "../src/memory/SecondBrain";
import type { Commitment } from "../src/types/commitment";
import type { TrustScore } from "../src/types/todayPlan";
import type { Observation } from "../src/observation/ObservationTypes";
import type { Experiment } from "../src/memory/ExperimentTypes";
import type { MemoryProfile } from "../src/memory/MemoryProfile";

function makeContext(overrides: Partial<SecondBrainContext> = {}): SecondBrainContext {
  return {
    today: new Date("2026-08-14"),
    commitments: [],
    observations: [],
    experiments: [],
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
    trust: { current: 50, history: [] },
    upcomingDeadlines: [],
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
    category: "consistency",
    text: "User completes morning commitments",
    confidence: 0.8,
    supportingEvents: [],
    firstSeen: "2026-08-01T00:00:00Z",
    lastSeen: "2026-08-10T00:00:00Z",
    status: "new",
    ...overrides,
  };
}

describe("SecondBrain", () => {
  describe("secondBrainScan", () => {
    it("detects upcoming deadlines within 30 days", () => {
      const ctx = makeContext({
        upcomingDeadlines: [
          { title: "CAT Exam", date: new Date("2026-08-26") },
        ],
      });

      const notices = secondBrainScan(ctx);
      const deadline = notices.find((n) => n.type === "deadline");

      expect(deadline).toBeDefined();
      expect(deadline!.text).toContain("CAT Exam");
      expect(deadline!.text).toContain("12 days");
      expect(deadline!.question).toBeDefined();
    });

    it("ignores deadlines beyond 30 days", () => {
      const ctx = makeContext({
        upcomingDeadlines: [
          { title: "Far Away", date: new Date("2026-12-01") },
        ],
      });

      const notices = secondBrainScan(ctx);
      expect(notices.find((n) => n.type === "deadline")).toBeUndefined();
    });

    it("detects neglected commitments (4+ days)", () => {
      const obs = makeObservation({
        metadata: { commitmentTitle: "Quant revision" },
        lastSeen: "2026-08-08T00:00:00Z",
      });

      const ctx = makeContext({
        commitments: [makeCommitment()],
        observations: [obs],
      });

      const notices = secondBrainScan(ctx);
      const neglect = notices.find((n) => n.type === "neglect");

      expect(neglect).toBeDefined();
      expect(neglect!.text).toContain("Quant revision");
      expect(neglect!.question).toContain("schedule a short session");
    });

    it("ignores recently touched commitments", () => {
      const obs = makeObservation({
        metadata: { commitmentTitle: "Quant revision" },
        lastSeen: "2026-08-13T00:00:00Z",
      });

      const ctx = makeContext({
        commitments: [makeCommitment()],
        observations: [obs],
      });

      const notices = secondBrainScan(ctx);
      expect(notices.find((n) => n.type === "neglect")).toBeUndefined();
    });

    it("detects declining trust trajectory", () => {
      const history = [
        { sessionId: "s1", outcome: "skipped" as const, isProtected: true, trustChange: -4, timestamp: new Date("2026-08-10") },
        { sessionId: "s2", outcome: "skipped" as const, isProtected: true, trustChange: -4, timestamp: new Date("2026-08-11") },
        { sessionId: "s3", outcome: "notCompleted" as const, isProtected: false, trustChange: -1, timestamp: new Date("2026-08-12") },
      ];

      const ctx = makeContext({
        trust: { current: 30, history },
      });

      const notices = secondBrainScan(ctx);
      const trust = notices.find((n) => n.type === "trust");

      expect(trust).toBeDefined();
      expect(trust!.text).toContain("dipping");
      expect(trust!.question).toBeDefined();
    });

    it("detects improving trust trajectory", () => {
      const history = [
        { sessionId: "s1", outcome: "completed" as const, isProtected: true, trustChange: 6, timestamp: new Date("2026-08-10") },
        { sessionId: "s2", outcome: "completed" as const, isProtected: true, trustChange: 6, timestamp: new Date("2026-08-11") },
      ];

      const ctx = makeContext({
        trust: { current: 70, history },
      });

      const notices = secondBrainScan(ctx);
      const trust = notices.find((n) => n.type === "trust");

      expect(trust).toBeDefined();
      expect(trust!.text).toContain("trending up");
    });

    it("detects wrapping up experiments", () => {
      const exp: Experiment = {
        id: "exp-1",
        title: "Morning Quant",
        hypothesis: "Mornings are better",
        commitmentTitle: "Quant revision",
        status: "active",
        startDate: "2026-08-01",
        endDate: "2026-08-16",
        metrics: [],
        notes: [],
        createdAt: "2026-08-01T00:00:00Z",
      };

      const ctx = makeContext({ experiments: [exp] });
      const notices = secondBrainScan(ctx);
      const experiment = notices.find((n) => n.type === "experiment");

      expect(experiment).toBeDefined();
      expect(experiment!.text).toContain("wrapping up");
    });

    it("sorts by priority (high first)", () => {
      const ctx = makeContext({
        upcomingDeadlines: [
          { title: "Close Deadline", date: new Date("2026-08-16") },
        ],
        trust: { current: 50, history: [
          { sessionId: "s1", outcome: "skipped" as const, isProtected: true, trustChange: -4, timestamp: new Date("2026-08-10") },
          { sessionId: "s2", outcome: "skipped" as const, isProtected: true, trustChange: -4, timestamp: new Date("2026-08-11") },
          { sessionId: "s3", outcome: "skipped" as const, isProtected: true, trustChange: -4, timestamp: new Date("2026-08-12") },
        ] },
      });

      const notices = secondBrainScan(ctx);
      expect(notices[0].priority).toBe("high");
    });

    it("returns empty array when nothing notable", () => {
      const ctx = makeContext();
      const notices = secondBrainScan(ctx);
      expect(notices.length).toBe(0);
    });

    it("detects strengths from confirmed observations", () => {
      const obs = makeObservation({
        category: "consistency",
        confidence: 0.8,
        status: "confirmed",
      });

      const ctx = makeContext({
        observations: [obs],
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
            activeGoals: [],
            currentExperiments: [],
            activeFocus: ["A", "B", "C"],
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
      });

      const notices = secondBrainScan(ctx);
      const strength = notices.find((n) => n.type === "strength");
      expect(strength).toBeDefined();
    });
  });
});
