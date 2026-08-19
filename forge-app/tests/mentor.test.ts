import { describe, it, expect } from "vitest";
import { buildInsights } from "../src/mentor/InsightBuilder";
import { buildPrompt } from "../src/mentor/PromptBuilder";
import { generateReflection } from "../src/mentor/ReflectionEngine";
import type { PatternReport } from "../src/memory/PatternTypes";

function makeReport(patterns: PatternReport["patterns"]): PatternReport {
  return {
    generatedAt: "2026-08-06T12:00:00.000Z",
    windowDays: 7,
    patterns,
  };
}

describe("InsightBuilder", () => {
  it("returns empty insights for empty patterns", () => {
    const report = makeReport([]);
    const result = buildInsights(report);
    expect(result.insights).toHaveLength(0);
  });

  it("generates high severity insight for low completion rate", () => {
    const report = makeReport([
      {
        id: "cr_gym",
        type: "completion_rate",
        confidence: 0.5,
        commitment: "Gym",
        completed: 2,
        total: 10,
        rate: 0.2,
      },
    ]);
    const result = buildInsights(report);
    expect(result.insights.length).toBeGreaterThan(0);
    const gymInsight = result.insights.find((i) => i.text.includes("Gym"));
    expect(gymInsight).toBeDefined();
    expect(gymInsight?.severity).toBe("high");
  });

  it("generates low severity insight for high completion rate", () => {
    const report = makeReport([
      {
        id: "cr_dsa",
        type: "completion_rate",
        confidence: 0.9,
        commitment: "DSA",
        completed: 9,
        total: 10,
        rate: 0.9,
      },
    ]);
    const result = buildInsights(report);
    const dsaInsight = result.insights.find((i) => i.text.includes("DSA"));
    expect(dsaInsight?.severity).toBe("low");
  });

  it("generates time preference insight", () => {
    const report = makeReport([
      {
        id: "tp",
        type: "time_preference",
        confidence: 0.7,
        preferred: "morning",
        counts: { morning: 8, afternoon: 2, evening: 1 },
      },
    ]);
    const result = buildInsights(report);
    const timeInsight = result.insights.find((i) => i.category === "time");
    expect(timeInsight).toBeDefined();
    expect(timeInsight?.text).toContain("morning");
  });

  it("generates trust trend insight", () => {
    const report = makeReport([
      {
        id: "tt",
        type: "trust_trend",
        confidence: 0.6,
        direction: "up",
        startScore: 55,
        endScore: 70,
      },
    ]);
    const result = buildInsights(report);
    const trustInsight = result.insights.find((i) => i.category === "trust");
    expect(trustInsight).toBeDefined();
    expect(trustInsight?.text).toContain("increased");
  });

  it("generates adjustment insight for high ratio", () => {
    const report = makeReport([
      {
        id: "af",
        type: "adjustment_frequency",
        confidence: 0.4,
        adjustments: 15,
        totalSessions: 30,
        ratio: 0.5,
      },
    ]);
    const result = buildInsights(report);
    const adjInsight = result.insights.find((i) => i.category === "adjustment");
    expect(adjInsight).toBeDefined();
    expect(adjInsight?.severity).toBe("medium");
  });

  it("generates consistency insight for low rate commitment", () => {
    const report = makeReport([
      {
        id: "cc",
        type: "commitment_consistency",
        confidence: 0.8,
        commitments: [
          { title: "Gym", rate: 0.3 },
          { title: "DSA", rate: 0.95 },
        ],
      },
    ]);
    const result = buildInsights(report);
    const gymInsight = result.insights.find(
      (i) => i.category === "consistency" && i.text.includes("Gym")
    );
    expect(gymInsight).toBeDefined();
    expect(gymInsight?.severity).toBe("medium");
  });
});

describe("PromptBuilder", () => {
  it("returns system and user strings", () => {
    const report = makeReport([]);
    const insights = buildInsights(report);
    const prompt = buildPrompt({ insights });
    expect(prompt.system).toBeTruthy();
    expect(prompt.user).toBeTruthy();
  });

  it("includes insights in user prompt", () => {
    const report = makeReport([
      {
        id: "cr_gym",
        type: "completion_rate",
        confidence: 0.5,
        commitment: "Gym",
        completed: 3,
        total: 5,
        rate: 0.6,
      },
    ]);
    const insights = buildInsights(report);
    const prompt = buildPrompt({ insights });
    expect(prompt.user).toContain("Gym");
    expect(prompt.user).toContain("60%");
  });

  it("includes window days in user prompt", () => {
    const report = makeReport([]);
    report.windowDays = 14;
    const insights = buildInsights(report);
    const prompt = buildPrompt({ insights });
    expect(prompt.user).toContain("14");
  });

  it("includes observations when provided", () => {
    const report = makeReport([]);
    const insights = buildInsights(report);
    const prompt = buildPrompt({
      insights,
      observations: [{ text: "User skips after lunch", category: "timing", confidence: 0.8 }],
    });
    expect(prompt.user).toContain("User skips after lunch");
  });

  it("includes trust context when provided", () => {
    const report = makeReport([]);
    const insights = buildInsights(report);
    const prompt = buildPrompt({
      insights,
      trustContext: { score: 72, level: "building", trajectory: "improving" },
    });
    expect(prompt.user).toContain("Trust: 72");
  });
});

describe("ReflectionEngine", () => {
  it("returns fallback response when no API key", async () => {
    const report = makeReport([
      {
        id: "cr_gym",
        type: "completion_rate",
        confidence: 0.5,
        commitment: "Gym",
        completed: 3,
        total: 5,
        rate: 0.6,
      },
    ]);
    const response = await generateReflection(report);
    expect(response.observation).toBeTruthy();
    expect(response.encouragement).toBeTruthy();
  });

  it("returns structured MentorResponse", async () => {
    const report = makeReport([]);
    const response = await generateReflection(report);
    expect(typeof response.observation).toBe("string");
    expect(typeof response.hypothesis).toBe("string");
    expect(typeof response.experiment).toBe("string");
    expect(typeof response.encouragement).toBe("string");
  });
});
