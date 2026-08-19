import { readFileSync } from "node:fs";
import { join } from "node:path";
import { understandIntent } from "../src/ai/IntentEngine";
import { validateIntent } from "../src/ai/IntentValidator";
import type { IntentResolution } from "../src/ai/IntentTypes";
import type { TodayPlan } from "../src/types/todayPlan";
import type { Commitment } from "../src/types/commitment";

type Expectation = {
  type?: string;
  target?: string;
  status?: string;
};

type Case = {
  id: string;
  input: string;
  expect: Expectation;
};

type RunResult = {
  id: string;
  input: string;
  expected: Expectation;
  actual: { status: string; type?: string; target?: string };
  pass: boolean;
};

const PLAN: TodayPlan = (() => {
  const c = (title: string, startTime: string, endTime: string, locked = false): Commitment => ({
    id: title.toLowerCase().replace(/\s+/g, "-"),
    title,
    startTime,
    endTime,
    completed: false,
    locked,
    priority: "medium",
  });

  return {
    greeting: "eval",
    summary: [],
    commitments: [
      c("College", "9:00 AM", "5:00 PM", true),
      c("Gym", "5:30 PM", "6:30 PM"),
      c("DSA Practice", "7:00 PM", "8:00 PM"),
      c("Reading", "8:30 PM", "9:00 PM"),
      c("Lunch", "12:00 PM", "1:00 PM"),
      c("Work", "1:30 PM", "4:30 PM"),
      c("Study", "6:45 PM", "7:45 PM"),
      c("Run", "6:00 AM", "6:30 AM"),
      c("Meeting", "3:00 PM", "3:30 PM"),
      c("Chemistry", "2:00 PM", "4:00 PM"),
    ],
    timeline: [],
    unscheduled: [],
    warnings: [],
    recommendation: "",
    status: "active",
  };
})();

export function runCase(prompt: string, input: string, expected: Expectation): RunResult {
  const raw = understandIntent(input, PLAN);
  let resolution: IntentResolution = raw;
  let intent = raw.intent;

  if (raw.status === "resolved" && raw.intent) {
    const validated = validateIntent(raw.intent, PLAN);
    resolution = validated;
    intent = validated.intent;
  }

  const actual = {
    status: resolution.status,
    type: intent?.type,
    target: intent && "target" in intent && typeof intent.target === "string" ? intent.target : undefined,
  };

  let pass = false;
  if (expected.status) {
    pass = actual.status === expected.status;
  } else if (expected.type) {
    pass = actual.type === expected.type;
    if (pass && expected.target) {
      const norm = (t: string | undefined) => (t ?? "").toLowerCase();
      const source = norm(actual.target);
      const wanted = norm(expected.target);
      pass = source.includes(wanted) || wanted.includes(source);
    }
  }

  return { id: prompt, input, expected, actual, pass };
}

export function loadEvaluationCases(): Case[] {
  const raw = readFileSync(join(process.cwd(), "evaluation", "planning.json"), "utf8");
  return (JSON.parse(raw) as { plan: Case[] }).plan;
}

export function runEvaluation(cases: Case[]): { results: RunResult[]; passRate: number } {
  const results = cases.map((c) => runCase(c.id, c.input, c.expect));
  const passed = results.filter((r) => r.pass).length;
  return { results, passRate: passed / results.length };
}

export function summarizeEvaluation(cases?: Case[]): string {
  const { results, passRate } = runEvaluation(cases ?? loadEvaluationCases());
  const failed = results.filter((r) => !r.pass);
  const lines = [
    `Planning evaluation: ${results.length - failed.length}/${results.length} passed (${(passRate * 100).toFixed(1)}%)`,
  ];
  for (const f of failed) {
    lines.push(
      `  FAIL ${f.id} "${f.input}" -> ${f.actual.status} ${f.actual.type ?? ""} ${f.actual.target ?? ""} (expected ${f.expected.status ?? f.expected.type ?? ""} ${f.expected.target ?? ""})`
    );
  }
  return lines.join("\n");
}