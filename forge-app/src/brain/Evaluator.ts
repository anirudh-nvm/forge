import type { TodayPlan } from "../types/todayPlan";
import type { EvaluatorRule, LogEntry } from "./types";
import { parseTimeToDecimal as parseTime } from "../utils/timeUtils";
import { BrainLogger } from "./logger/BrainLogger";

function noOverlapsRule(plan: TodayPlan): EvaluatorRule {
  const commitments = plan.commitments;
  for (let i = 0; i < commitments.length; i++) {
    for (let j = i + 1; j < commitments.length; j++) {
      const startA = parseTime(commitments[i].startTime);
      const endA = parseTime(commitments[i].endTime);
      const startB = parseTime(commitments[j].startTime);
      const endB = parseTime(commitments[j].endTime);

      if (startA < endB && startB < endA) {
        return {
          name: "No overlapping commitments",
          passed: false,
          reason: `${commitments[i].title} and ${commitments[j].title} overlap`,
        };
      }
    }
  }
  return { name: "No overlapping commitments", passed: true, reason: "" };
}

function noNegativeDurationsRule(plan: TodayPlan): EvaluatorRule {
  for (const commitment of plan.commitments) {
    const start = parseTime(commitment.startTime);
    const end = parseTime(commitment.endTime);

    if (end <= start) {
      return {
        name: "No negative durations",
        passed: false,
        reason: `${commitment.title} has invalid time range`,
      };
    }
  }
  return { name: "No negative durations", passed: true, reason: "" };
}

function maxWorkWindowRule(plan: TodayPlan): EvaluatorRule {
  let totalHours = 0;
  for (const commitment of plan.commitments) {
    const start = parseTime(commitment.startTime);
    const end = parseTime(commitment.endTime);
    totalHours += end - start;
  }

  if (totalHours > 12) {
    return {
      name: "Maximum work window",
      passed: false,
      reason: `Total scheduled hours (${totalHours.toFixed(1)}) exceeds 12 hours`,
    };
  }
  return { name: "Maximum work window", passed: true, reason: "" };
}

function sleepBufferRule(plan: TodayPlan): EvaluatorRule {
  const sleepCommitment = plan.commitments.find(
    (c) => c.title.toLowerCase().includes("sleep") || c.title.toLowerCase().includes("rest")
  );

  if (!sleepCommitment) {
    return {
      name: "Sleep buffer",
      passed: false,
      reason: "No sleep commitment found",
    };
  }

  const start = parseTime(sleepCommitment.startTime);
  const end = parseTime(sleepCommitment.endTime);
  const sleepHours = end > start ? end - start : 24 - start + end;

  if (sleepHours < 7) {
    return {
      name: "Sleep buffer",
      passed: false,
      reason: `Sleep duration (${sleepHours.toFixed(1)} hours) is less than 7 hours`,
    };
  }
  return { name: "Sleep buffer", passed: true, reason: "" };
}

function emptyScheduleRule(plan: TodayPlan): EvaluatorRule {
  if (plan.commitments.length === 0) {
    return {
      name: "Empty schedule",
      passed: false,
      reason: "No commitments scheduled",
    };
  }
  return { name: "Empty schedule", passed: true, reason: "" };
}

export function evaluatePlan(
  plan: TodayPlan
): {
  isValid: boolean;
  confidence: number;
  reasoning: string[];
  logs: LogEntry[];
} {
  const logs: LogEntry[] = [];

  const rules = [
    noOverlapsRule,
    noNegativeDurationsRule,
    maxWorkWindowRule,
    sleepBufferRule,
    emptyScheduleRule,
  ];

  const results = rules.map((rule) => rule(plan));
  const failedRules = results.filter((r) => !r.passed);

  results.forEach((result) => {
    if (result.passed) {
      logs.push({ module: "Evaluator", message: `✓ ${result.name}` });
    } else {
      logs.push({ module: "Evaluator", message: `✗ ${result.name}: ${result.reason}` });
    }
  });

  const isValid = failedRules.length === 0;
  const confidence = isValid ? 0.85 : 0.3;
  const reasoning = failedRules.map((r) => r.reason);

  BrainLogger.log("Evaluator", {
    isValid,
    confidence,
    failedRules: failedRules.length,
  });

  return { isValid, confidence, reasoning, logs };
}
