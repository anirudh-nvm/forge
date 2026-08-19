import { describe, it, expect } from "vitest";
import { retrieveMemory, extractKeywords } from "../src/memory/MemoryRetriever";
import type { MemoryProfile } from "../src/memory/MemoryProfile";
import type { Observation } from "../src/observation/ObservationTypes";
import type { Experiment } from "../src/memory/ExperimentTypes";
import type { ReflectionMemory } from "../src/reflection/ReflectionTypes";
import type { TrustScore } from "../src/types/todayPlan";

function makeMemory(overrides: Partial<MemoryProfile> = {}): MemoryProfile {
  return {
    stable: {
      lifeSeason: "student",
      priorities: ["CAT prep"],
      values: ["discipline", "growth"],
      rhythm: { preferredWakeTime: "7:00 AM", preferredSleepTime: "11:00 PM", studyPreference: "morning" },
      constraints: [],
      lastUpdated: "2026-08-14T00:00:00Z",
      ...overrides.stable,
    },
    working: {
      weekOf: "2026-08-14",
      activeGoals: ["CAT prep"],
      currentExperiments: ["Morning Quant"],
      activeFocus: ["Quant revision", "VARC practice"],
      recentDecisions: [],
      lastUpdated: "2026-08-14T00:00:00Z",
      ...overrides.working,
    },
    recent: {
      date: "2026-08-14",
      planId: null,
      observations: [],
      adjustments: [],
      reflections: [],
      lastUpdated: "2026-08-14T00:00:00Z",
      ...overrides.recent,
    },
    lastBuilt: "2026-08-14T00:00:00Z",
  };
}

function makeObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    id: "obs-1",
    category: "consistency",
    text: "User completes more morning commitments",
    confidence: 0.8,
    supportingEvents: [],
    firstSeen: "2026-08-01T00:00:00Z",
    lastSeen: "2026-08-10T00:00:00Z",
    status: "new",
    metadata: { commitmentTitle: "Quant revision" },
    ...overrides,
  };
}

function makeExperiment(overrides: Partial<Experiment> = {}): Experiment {
  return {
    id: "exp-1",
    title: "Morning Quant",
    hypothesis: "Quant is better in mornings",
    commitmentTitle: "Quant revision",
    status: "active",
    startDate: "2026-08-01",
    endDate: "2026-08-14",
    metrics: [],
    notes: [],
    createdAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function makeReflection(overrides: Partial<ReflectionMemory> = {}): ReflectionMemory {
  return {
    date: "2026-08-10",
    observationId: "obs-1",
    category: "consistency",
    observationText: "You skip Quant after lunch",
    userExplanation: "Post-lunch energy dip",
    summary: "",
    linkedExperiments: [],
    ...overrides,
  };
}

function makeTrust(current: number, history: TrustScore["history"] = []): TrustScore {
  return { current, history };
}

describe("MemoryRetriever", () => {
  describe("retrieveMemory", () => {
    it("returns stable and working memory", () => {
      const memory = makeMemory();
      const result = retrieveMemory(memory, [], [], [], makeTrust(50), {
        situation: "planning",
        keywords: ["quant"],
      });

      expect(result.stable.values).toContain("discipline");
      expect(result.working.activeFocus).toContain("Quant revision");
    });

    it("scores observations by keyword relevance", () => {
      const obs1 = makeObservation({
        id: "obs-1",
        text: "Quant revision mornings are strong",
        metadata: { commitmentTitle: "Quant revision" },
      });
      const obs2 = makeObservation({
        id: "obs-2",
        text: "VARC practice is inconsistent",
        metadata: { commitmentTitle: "VARC practice" },
      });

      const result = retrieveMemory(
        makeMemory(),
        [obs1, obs2],
        [],
        [],
        makeTrust(50),
        { situation: "planning", keywords: ["quant"] }
      );

      expect(result.relevantObservations.length).toBeGreaterThanOrEqual(1);
      expect(result.relevantObservations[0].id).toBe("obs-1");
    });

    it("scores experiments by keyword relevance", () => {
      const exp1 = makeExperiment({ id: "exp-1", title: "Morning Quant" });
      const exp2 = makeExperiment({
        id: "exp-2",
        title: "Evening VARC",
        commitmentTitle: "VARC practice",
      });

      const result = retrieveMemory(
        makeMemory(),
        [],
        [exp1, exp2],
        [],
        makeTrust(50),
        { situation: "planning", keywords: ["quant"] }
      );

      expect(result.relevantExperiments.length).toBeGreaterThanOrEqual(1);
      expect(result.relevantExperiments[0].id).toBe("exp-1");
    });

    it("scores reflections by keyword relevance", () => {
      const ref1 = makeReflection({
        observationId: "obs-1",
        observationText: "Quant feels hard after lunch",
        userExplanation: "Energy dip",
      });
      const ref2 = makeReflection({
        observationId: "obs-2",
        observationText: "VARC is relaxing",
        userExplanation: "Enjoyable",
      });

      const result = retrieveMemory(
        makeMemory(),
        [],
        [],
        [ref1, ref2],
        makeTrust(50),
        { situation: "planning", keywords: ["quant"] }
      );

      expect(result.relevantReflections.length).toBeGreaterThanOrEqual(1);
      expect(result.relevantReflections[0].observationId).toBe("obs-1");
    });

    it("builds trust context from trust score", () => {
      const history = [
        { sessionId: "s1", outcome: "completed" as const, isProtected: true, trustChange: 6, timestamp: new Date("2026-08-10") },
        { sessionId: "s2", outcome: "completed" as const, isProtected: true, trustChange: 6, timestamp: new Date("2026-08-11") },
      ];

      const result = retrieveMemory(
        makeMemory(),
        [],
        [],
        [],
        makeTrust(62, history),
        { situation: "planning", keywords: ["quant"] }
      );

      expect(result.trustContext.currentScore).toBe(62);
      expect(result.trustContext.trajectory).toBe("improving");
    });

    it("limits observations to 10", () => {
      const observations = Array.from({ length: 15 }, (_, i) =>
        makeObservation({ id: `obs-${i}`, text: `quant observation ${i}` })
      );

      const result = retrieveMemory(
        makeMemory(),
        observations,
        [],
        [],
        makeTrust(50),
        { situation: "planning", keywords: ["quant"] }
      );

      expect(result.relevantObservations.length).toBeLessThanOrEqual(10);
    });

    it("filters out low-relevance observations", () => {
      const obs = makeObservation({
        text: "VARC practice is great",
        metadata: { commitmentTitle: "VARC practice" },
      });

      const result = retrieveMemory(
        makeMemory(),
        [obs],
        [],
        [],
        makeTrust(50),
        { situation: "planning", keywords: ["quant"] }
      );

      expect(result.relevantObservations.length).toBe(0);
    });
  });

  describe("extractKeywords", () => {
    it("extracts meaningful words", () => {
      const keywords = extractKeywords("I want to revise quant today");
      expect(keywords).toContain("revise");
      expect(keywords).toContain("quant");
    });

    it("filters stopwords", () => {
      const keywords = extractKeywords("I want to revise quant today");
      expect(keywords).not.toContain("want");
      expect(keywords).not.toContain("today");
    });

    it("handles empty string", () => {
      expect(extractKeywords("")).toEqual([]);
    });

    it("handles short words", () => {
      const keywords = extractKeywords("I am a big fan of AI");
      expect(keywords).not.toContain("am");
      expect(keywords).not.toContain("ai");
    });
  });
});
