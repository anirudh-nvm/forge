import { describe, it, expect, beforeEach, vi } from "vitest";
import * as ExperimentEngine from "../src/memory/ExperimentEngine";
import type { Experiment } from "../src/memory/ExperimentTypes";

let mockExperiments: Experiment[] = [];

vi.mock("../src/storage/StorageEngine", () => ({
  StorageEngine: {
    loadExperiments: async () => mockExperiments,
    saveExperiments: async (exps: Experiment[]) => {
      mockExperiments = exps;
    },
  },
}));

describe("ExperimentEngine", () => {
  beforeEach(async () => {
    mockExperiments = [];
    ExperimentEngine.reset();
    await ExperimentEngine.loadExperiments();
  });

  describe("create", () => {
    it("creates a new experiment with proposed status", () => {
      const exp = ExperimentEngine.create({
        title: "Morning Gym",
        hypothesis: "Exercising before 9 AM increases consistency",
        commitmentTitle: "Gym",
        durationDays: 7,
        metrics: [{ name: "completion_rate", baseline: 0.6, target: 0.8 }],
      });

      expect(exp.status).toBe("proposed");
      expect(exp.title).toBe("Morning Gym");
      expect(exp.hypothesis).toContain("9 AM");
      expect(exp.metrics).toHaveLength(1);
      expect(exp.metrics[0].baseline).toBe(0.6);
    });

    it("generates unique ids", () => {
      const exp1 = ExperimentEngine.create({
        title: "Exp 1",
        hypothesis: "Test",
        commitmentTitle: "Gym",
        durationDays: 7,
        metrics: [],
      });
      const exp2 = ExperimentEngine.create({
        title: "Exp 2",
        hypothesis: "Test",
        commitmentTitle: "Gym",
        durationDays: 7,
        metrics: [],
      });

      expect(exp1.id).not.toBe(exp2.id);
    });

    it("sets correct end date based on duration", () => {
      const exp = ExperimentEngine.create({
        title: "Test",
        hypothesis: "Test",
        commitmentTitle: "Gym",
        durationDays: 14,
        metrics: [],
      });

      const start = new Date(exp.startDate);
      const end = new Date(exp.endDate);
      const diffDays = Math.round(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(diffDays).toBe(14);
    });
  });

  describe("activate", () => {
    it("activates a proposed experiment", () => {
      const exp = ExperimentEngine.create({
        title: "Test",
        hypothesis: "Test",
        commitmentTitle: "Gym",
        durationDays: 7,
        metrics: [],
      });

      const activated = ExperimentEngine.activate(exp.id);
      expect(activated?.status).toBe("active");
    });

    it("cannot activate a non-existent experiment", () => {
      const result = ExperimentEngine.activate("nonexistent");
      expect(result).toBeUndefined();
    });

    it("cannot activate an already active experiment", () => {
      const exp = ExperimentEngine.create({
        title: "Test",
        hypothesis: "Test",
        commitmentTitle: "Gym",
        durationDays: 7,
        metrics: [],
      });

      ExperimentEngine.activate(exp.id);
      const result = ExperimentEngine.activate(exp.id);
      expect(result).toBeUndefined();
    });
  });

  describe("close", () => {
    it("closes an active experiment with outcome", () => {
      const exp = ExperimentEngine.create({
        title: "Test",
        hypothesis: "Test",
        commitmentTitle: "Gym",
        durationDays: 7,
        metrics: [],
      });
      ExperimentEngine.activate(exp.id);

      const closed = ExperimentEngine.close(exp.id, "successful");
      expect(closed?.status).toBe("completed");
      expect(closed?.outcome).toBe("successful");
      expect(closed?.closedAt).toBeTruthy();
    });

    it("cannot close a proposed experiment", () => {
      const exp = ExperimentEngine.create({
        title: "Test",
        hypothesis: "Test",
        commitmentTitle: "Gym",
        durationDays: 7,
        metrics: [],
      });

      const result = ExperimentEngine.close(exp.id, "successful");
      expect(result).toBeUndefined();
    });

    it("records failed outcome", () => {
      const exp = ExperimentEngine.create({
        title: "Test",
        hypothesis: "Test",
        commitmentTitle: "Gym",
        durationDays: 7,
        metrics: [],
      });
      ExperimentEngine.activate(exp.id);

      const closed = ExperimentEngine.close(exp.id, "failed");
      expect(closed?.outcome).toBe("failed");
    });
  });

  describe("cancel", () => {
    it("cancels an active experiment", () => {
      const exp = ExperimentEngine.create({
        title: "Test",
        hypothesis: "Test",
        commitmentTitle: "Gym",
        durationDays: 7,
        metrics: [],
      });
      ExperimentEngine.activate(exp.id);

      const cancelled = ExperimentEngine.cancel(exp.id);
      expect(cancelled?.status).toBe("cancelled");
    });

    it("cancels a proposed experiment", () => {
      const exp = ExperimentEngine.create({
        title: "Test",
        hypothesis: "Test",
        commitmentTitle: "Gym",
        durationDays: 7,
        metrics: [],
      });

      const cancelled = ExperimentEngine.cancel(exp.id);
      expect(cancelled?.status).toBe("cancelled");
    });

    it("cannot cancel a completed experiment", () => {
      const exp = ExperimentEngine.create({
        title: "Test",
        hypothesis: "Test",
        commitmentTitle: "Gym",
        durationDays: 7,
        metrics: [],
      });
      ExperimentEngine.activate(exp.id);
      ExperimentEngine.close(exp.id, "successful");

      const result = ExperimentEngine.cancel(exp.id);
      expect(result).toBeUndefined();
    });
  });

  describe("addNote", () => {
    it("adds a note to an experiment", () => {
      const exp = ExperimentEngine.create({
        title: "Test",
        hypothesis: "Test",
        commitmentTitle: "Gym",
        durationDays: 7,
        metrics: [],
      });

      const updated = ExperimentEngine.addNote(exp.id, "Felt great today");
      expect(updated?.notes).toContain("Felt great today");
    });

    it("returns undefined for non-existent experiment", () => {
      const result = ExperimentEngine.addNote("nonexistent", "note");
      expect(result).toBeUndefined();
    });
  });

  describe("updateMetric", () => {
    it("updates metric actual value", () => {
      const exp = ExperimentEngine.create({
        title: "Test",
        hypothesis: "Test",
        commitmentTitle: "Gym",
        durationDays: 7,
        metrics: [{ name: "completion_rate", baseline: 0.6, target: 0.8 }],
      });

      const updated = ExperimentEngine.updateMetric(exp.id, "completion_rate", 0.75);
      expect(updated?.metrics[0].actual).toBe(0.75);
    });

    it("returns undefined for non-existent metric", () => {
      const exp = ExperimentEngine.create({
        title: "Test",
        hypothesis: "Test",
        commitmentTitle: "Gym",
        durationDays: 7,
        metrics: [{ name: "completion_rate", baseline: 0.6, target: 0.8 }],
      });

      const result = ExperimentEngine.updateMetric(exp.id, "nonexistent", 0.5);
      expect(result).toBeUndefined();
    });
  });

  describe("getSummary", () => {
    it("returns correct summary counts", () => {
      const exp1 = ExperimentEngine.create({
        title: "Active",
        hypothesis: "Test",
        commitmentTitle: "Gym",
        durationDays: 7,
        metrics: [],
      });
      const exp2 = ExperimentEngine.create({
        title: "Done",
        hypothesis: "Test",
        commitmentTitle: "Gym",
        durationDays: 7,
        metrics: [],
      });

      ExperimentEngine.activate(exp1.id);
      ExperimentEngine.activate(exp2.id);
      ExperimentEngine.close(exp2.id, "successful");

      const summary = ExperimentEngine.getSummary();
      expect(summary.total).toBe(2);
      expect(summary.active).toBe(1);
      expect(summary.completed).toBe(1);
      expect(summary.successful).toBe(1);
    });
  });

  describe("getLearningReport", () => {
    it("generates learning report with patterns", () => {
      const exp1 = ExperimentEngine.create({
        title: "Morning Gym",
        hypothesis: "Morning exercise works",
        commitmentTitle: "Gym",
        durationDays: 7,
        metrics: [],
      });
      const exp2 = ExperimentEngine.create({
        title: "Late Night Study",
        hypothesis: "Late study fails",
        commitmentTitle: "DSA",
        durationDays: 7,
        metrics: [],
      });

      ExperimentEngine.activate(exp1.id);
      ExperimentEngine.activate(exp2.id);
      ExperimentEngine.close(exp1.id, "successful");
      ExperimentEngine.close(exp2.id, "failed");

      const report = ExperimentEngine.getLearningReport();
      expect(report.successfulPatterns).toHaveLength(1);
      expect(report.failedPatterns).toHaveLength(1);
      expect(report.summary.successful).toBe(1);
      expect(report.summary.failed).toBe(1);
    });
  });

  describe("query", () => {
    it("getActive returns only active experiments", () => {
      const exp1 = ExperimentEngine.create({
        title: "Active",
        hypothesis: "Test",
        commitmentTitle: "Gym",
        durationDays: 7,
        metrics: [],
      });
      const exp2 = ExperimentEngine.create({
        title: "Done",
        hypothesis: "Test",
        commitmentTitle: "Gym",
        durationDays: 7,
        metrics: [],
      });

      ExperimentEngine.activate(exp1.id);
      ExperimentEngine.activate(exp2.id);
      ExperimentEngine.close(exp2.id, "successful");

      const active = ExperimentEngine.getActive();
      expect(active).toHaveLength(1);
      expect(active[0].title).toBe("Active");
    });

    it("getCompleted returns only completed experiments", () => {
      const exp = ExperimentEngine.create({
        title: "Done",
        hypothesis: "Test",
        commitmentTitle: "Gym",
        durationDays: 7,
        metrics: [],
      });

      ExperimentEngine.activate(exp.id);
      ExperimentEngine.close(exp.id, "successful");

      const completed = ExperimentEngine.getCompleted();
      expect(completed).toHaveLength(1);
      expect(completed[0].outcome).toBe("successful");
    });

    it("getById returns correct experiment", () => {
      const exp = ExperimentEngine.create({
        title: "Find Me",
        hypothesis: "Test",
        commitmentTitle: "Gym",
        durationDays: 7,
        metrics: [],
      });

      const found = ExperimentEngine.getById(exp.id);
      expect(found?.title).toBe("Find Me");
    });
  });
});
