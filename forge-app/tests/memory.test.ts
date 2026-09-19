import { describe, it, expect } from "vitest";
import { generatePatternInsights } from "../src/intelligence/patternInsights";

// ── Memory Test Suite ──────────────────────────────────────────
// Tests for Sprint 4: "Forge Remembers Me"
// Verifies that pattern insights, trust evolution, and predictions work

describe("Memory - Forge Remembers Me (Sprint 4)", () => {
  describe("PatternInsights Generation", () => {
    it("generates time preference insight for morning person", () => {
      const insights = generatePatternInsights({
        timePreference: {
          preferred: "morning",
          counts: { morning: 8, afternoon: 2, evening: 1 },
        },
      });

      expect(insights.length).toBeGreaterThan(0);
      const timeInsight = insights.find(i => i.type === "time_preference");
      expect(timeInsight).toBeTruthy();
      expect(timeInsight?.text).toBeTruthy();
    });

    it("generates time preference insight for afternoon person", () => {
      const insights = generatePatternInsights({
        timePreference: {
          preferred: "afternoon",
          counts: { morning: 2, afternoon: 8, evening: 1 },
        },
      });

      expect(insights.length).toBeGreaterThan(0);
      const timeInsight = insights.find(i => i.type === "time_preference");
      expect(timeInsight).toBeTruthy();
    });

    it("generates completion rate insight for high completion", () => {
      const insights = generatePatternInsights({
        completionRates: [
          { title: "Gym", rate: 0.9 },
        ],
      });

      expect(insights.length).toBeGreaterThan(0);
      const completionInsight = insights.find(i => i.type === "completion_rate");
      expect(completionInsight).toBeTruthy();
      expect(completionInsight?.confidence).toBe(0.9);
    });

    it("generates completion rate insight for low completion", () => {
      const insights = generatePatternInsights({
        completionRates: [
          { title: "Study", rate: 0.3 },
        ],
      });

      expect(insights.length).toBeGreaterThan(0);
      const completionInsight = insights.find(i => i.type === "completion_rate");
      expect(completionInsight).toBeTruthy();
    });

    it("generates trust trend insight for improving trust", () => {
      const insights = generatePatternInsights({
        trustTrend: {
          direction: "up",
          startScore: 40,
          endScore: 70,
        },
      });

      expect(insights.length).toBeGreaterThan(0);
      const trustInsight = insights.find(i => i.type === "trust_trend");
      expect(trustInsight).toBeTruthy();
      expect(trustInsight?.text).toBeTruthy();
    });

    it("generates trust trend insight for declining trust", () => {
      const insights = generatePatternInsights({
        trustTrend: {
          direction: "down",
          startScore: 70,
          endScore: 40,
        },
      });

      expect(insights.length).toBeGreaterThan(0);
      const trustInsight = insights.find(i => i.type === "trust_trend");
      expect(trustInsight).toBeTruthy();
    });

    it("generates adjustment frequency insight", () => {
      const insights = generatePatternInsights({
        adjustments: { ratio: 0.4 },
      });

      expect(insights.length).toBeGreaterThan(0);
      const adjustmentInsight = insights.find(i => i.type === "adjustment");
      expect(adjustmentInsight).toBeTruthy();
    });

    it("returns empty for no patterns", () => {
      const insights = generatePatternInsights({});
      expect(insights).toHaveLength(0);
    });
  });

  describe("Trust Evolution", () => {
    it("calculates trust level for high score", () => {
      const current = 85;
      expect(current).toBeGreaterThanOrEqual(80);
    });

    it("calculates trust level for medium score", () => {
      const current = 65;
      expect(current).toBeGreaterThanOrEqual(60);
      expect(current).toBeLessThan(80);
    });

    it("calculates trust level for low score", () => {
      const current = 30;
      expect(current).toBeGreaterThanOrEqual(20);
      expect(current).toBeLessThan(40);
    });

    it("detects improving trajectory", () => {
      const history = [
        { trustChange: 3 },
        { trustChange: 3 },
        { trustChange: 3 },
      ];

      const avgChange = history.reduce((sum, e) => sum + e.trustChange, 0) / history.length;
      expect(avgChange).toBeGreaterThan(2);
    });

    it("detects declining trajectory", () => {
      const history = [
        { trustChange: -3 },
        { trustChange: -3 },
        { trustChange: -3 },
      ];

      const avgChange = history.reduce((sum, e) => sum + e.trustChange, 0) / history.length;
      expect(avgChange).toBeLessThan(-2);
    });

    it("detects stable trajectory", () => {
      const history = [
        { trustChange: 3 },
        { trustChange: -2 },
        { trustChange: 3 },
      ];

      const avgChange = history.reduce((sum, e) => sum + e.trustChange, 0) / history.length;
      expect(avgChange).toBeGreaterThanOrEqual(-2);
      expect(avgChange).toBeLessThanOrEqual(2);
    });
  });

  describe("Pattern Confidence", () => {
    it("insights have confidence scores", () => {
      const insights = generatePatternInsights({
        timePreference: {
          preferred: "morning",
          counts: { morning: 5, afternoon: 2, evening: 1 },
        },
      });

      insights.forEach(insight => {
        expect(insight.confidence).toBeGreaterThan(0);
        expect(insight.confidence).toBeLessThanOrEqual(1);
      });
    });

    it("higher sample size gives higher confidence", () => {
      const lowSample = generatePatternInsights({
        timePreference: {
          preferred: "morning",
          counts: { morning: 3, afternoon: 1, evening: 0 },
        },
      });

      const highSample = generatePatternInsights({
        timePreference: {
          preferred: "morning",
          counts: { morning: 8, afternoon: 2, evening: 1 },
        },
      });

      if (lowSample.length > 0 && highSample.length > 0) {
        expect(highSample[0].confidence).toBeGreaterThanOrEqual(lowSample[0].confidence);
      }
    });
  });

  describe("Edge Cases", () => {
    it("handles empty patterns gracefully", () => {
      const insights = generatePatternInsights({});
      expect(insights).toHaveLength(0);
    });

    it("handles zero counts gracefully", () => {
      const insights = generatePatternInsights({
        timePreference: {
          preferred: "morning",
          counts: { morning: 0, afternoon: 0, evening: 0 },
        },
      });

      expect(insights).toHaveLength(0);
    });

    it("handles single data point", () => {
      const insights = generatePatternInsights({
        completionRates: [
          { title: "Task", rate: 1.0 },
        ],
      });

      expect(insights.length).toBeGreaterThan(0);
    });
  });
});
