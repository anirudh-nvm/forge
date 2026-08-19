import { describe, it, expect } from "vitest";
import { summarizeEvaluation, runEvaluation, loadEvaluationCases } from "../evaluation/runner";

describe("planning evaluation", () => {
  it("loads 100 real prompts", () => {
    const cases = loadEvaluationCases();
    expect(cases.length).toBe(100);
  });

  it("every case has an expectation", () => {
    const cases = loadEvaluationCases();
    for (const c of cases) {
      expect(c.expect.status ?? c.expect.type, `${c.id} has expectation`).toBeTruthy();
      expect(c.input.length).toBeGreaterThan(0);
    }
  });

  it("maintains the deterministic baseline above 70%", () => {
    const { passRate } = runEvaluation(loadEvaluationCases());
    expect(passRate).toBeGreaterThan(0.7);
  });

  it("summarizeEvaluation reports failures", () => {
    const summary = summarizeEvaluation(loadEvaluationCases());
    expect(summary).toContain("Planning evaluation:");
    expect(summary).toContain("passed");
  });
});