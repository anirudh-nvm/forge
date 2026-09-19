import { describe, it, expect } from "vitest";
import { formatPredictionsForChat } from "../src/intelligence/chatPredictions";
import { formatPredictionsForLLM } from "../src/ai/PredictionContext";
import type { Prediction } from "../src/memory/PredictionEngine";

// ── Prediction Chat Test Suite ──────────────────────────────────
// Tests for Sprint 6: Predictions in Chat
// Verifies that predictions are surfaced during chat

describe("Predictions in Chat (Sprint 6)", () => {
  describe("formatPredictionsForChat", () => {
    it("formats predictions into chat text", () => {
      const predictions: Prediction[] = [
        {
          title: "Gym",
          trigger: "You usually skip Gym on Monday",
          suggestion: "Consider moving Gym to a different day",
          confidence: 0.8,
          dataPoints: 5,
          type: "reschedule",
        },
      ];

      const result = formatPredictionsForChat(predictions);
      expect(result).toBeTruthy();
      expect(result.toLowerCase()).toContain("gym");
    });

    it("returns empty string for no predictions", () => {
      const result = formatPredictionsForChat([]);
      expect(result).toBe("");
    });

    it("limits to 2 predictions", () => {
      const predictions: Prediction[] = [
        {
          title: "Gym",
          trigger: "skip on Monday",
          suggestion: "move to different day",
          confidence: 0.8,
          dataPoints: 5,
          type: "reschedule",
        },
        {
          title: "Study",
          trigger: "takes longer",
          suggestion: "add buffer",
          confidence: 0.9,
          dataPoints: 4,
          type: "add_buffer",
        },
        {
          title: "Work",
          trigger: "low completion",
          suggestion: "make optional",
          confidence: 0.7,
          dataPoints: 3,
          type: "skip_warning",
        },
      ];

      const result = formatPredictionsForChat(predictions);
      const lines = result.split(". ").filter(Boolean);
      expect(lines.length).toBeLessThanOrEqual(2);
    });
  });

  describe("formatPredictionsForLLM", () => {
    it("formats predictions into LLM context", () => {
      const predictions: Prediction[] = [
        {
          title: "Gym",
          trigger: "You usually skip Gym on Monday",
          suggestion: "Consider moving Gym to a different day",
          confidence: 0.8,
          dataPoints: 5,
          type: "reschedule",
        },
      ];

      const result = formatPredictionsForLLM(predictions);
      expect(result).toContain("PREDICTIONS BASED ON HISTORY");
      expect(result).toContain("Gym");
    });

    it("returns empty string for no predictions", () => {
      const result = formatPredictionsForLLM([]);
      expect(result).toBe("");
    });

    it("includes prediction type icons", () => {
      const predictions: Prediction[] = [
        {
          title: "Gym",
          trigger: "skip on Monday",
          suggestion: "move to different day",
          confidence: 0.8,
          dataPoints: 5,
          type: "reschedule",
        },
        {
          title: "Study",
          trigger: "takes longer",
          suggestion: "add buffer",
          confidence: 0.9,
          dataPoints: 4,
          type: "add_buffer",
        },
      ];

      const result = formatPredictionsForLLM(predictions);
      expect(result).toContain("📅");
      expect(result).toContain("➕");
    });
  });

  describe("Prediction Types", () => {
    it("reschedule prediction has valid structure", () => {
      const pred: Prediction = {
        title: "Gym",
        trigger: "You usually skip Gym on Monday",
        suggestion: "Consider moving Gym to a different day",
        confidence: 0.8,
        dataPoints: 5,
        type: "reschedule",
      };

      expect(pred.title).toBeTruthy();
      expect(pred.trigger).toBeTruthy();
      expect(pred.suggestion).toBeTruthy();
      expect(pred.confidence).toBeGreaterThan(0);
      expect(pred.confidence).toBeLessThanOrEqual(1);
      expect(pred.dataPoints).toBeGreaterThan(0);
    });

    it("adjust_duration prediction has valid structure", () => {
      const pred: Prediction = {
        title: "Study",
        trigger: "Study usually takes 90 min (planned 60 min)",
        suggestion: "Allocate 100 min for Study in future plans",
        confidence: 0.85,
        dataPoints: 6,
        type: "adjust_duration",
      };

      expect(pred.type).toBe("adjust_duration");
      expect(pred.confidence).toBeGreaterThan(0);
    });

    it("add_buffer prediction has valid structure", () => {
      const pred: Prediction = {
        title: "Work",
        trigger: "Work takes longer than planned",
        suggestion: "Add a 20-minute buffer",
        confidence: 0.8,
        dataPoints: 4,
        type: "add_buffer",
      };

      expect(pred.type).toBe("add_buffer");
      expect(pred.suggestion).toContain("buffer");
    });

    it("skip_warning prediction has valid structure", () => {
      const pred: Prediction = {
        title: "Gym",
        trigger: "You complete Gym only 40% of the time",
        suggestion: "Consider making Gym optional or shorter",
        confidence: 0.7,
        dataPoints: 5,
        type: "skip_warning",
      };

      expect(pred.type).toBe("skip_warning");
      expect(pred.confidence).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe("Edge Cases", () => {
    it("handles very long suggestion text", () => {
      const pred: Prediction = {
        title: "Gym",
        trigger: "skip on Monday",
        suggestion: "a".repeat(500),
        confidence: 0.8,
        dataPoints: 5,
        type: "reschedule",
      };

      const result = formatPredictionsForChat([pred]);
      expect(result.length).toBeGreaterThan(0);
    });

    it("handles special characters in title", () => {
      const pred: Prediction = {
        title: "CAT Prep (2024)",
        trigger: "skip on Tuesday",
        suggestion: "move to different day for CAT Prep",
        confidence: 0.8,
        dataPoints: 5,
        type: "reschedule",
      };

      const result = formatPredictionsForChat([pred]);
      expect(result.toLowerCase()).toContain("cat prep");
    });

    it("handles zero data points", () => {
      const pred: Prediction = {
        title: "New Task",
        trigger: "no history",
        suggestion: "start tracking",
        confidence: 0.5,
        dataPoints: 0,
        type: "skip_warning",
      };

      const result = formatPredictionsForChat([pred]);
      expect(result).toBeTruthy();
    });

    it("handles very low confidence", () => {
      const pred: Prediction = {
        title: "Gym",
        trigger: "skip on Monday",
        suggestion: "move to different day",
        confidence: 0.1,
        dataPoints: 1,
        type: "reschedule",
      };

      const result = formatPredictionsForChat([pred]);
      expect(result).toBeTruthy();
    });
  });
});
