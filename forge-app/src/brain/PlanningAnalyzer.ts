import type { Commitment } from "../types/commitment";

export type PlanningIssue = {
  type: "cognitive_load" | "recovery_gap" | "meal_gap" | "sleep_conflict" | "travel_conflict" | "pacing" | "overload";
  severity: "high" | "medium" | "low";
  description: string;
  affectedCommitments: string[];
  metric: number;
};

export type PlanningAnalysis = {
  issues: PlanningIssue[];
  overloadScore: number;
  totalStudyMinutes: number;
  totalDeepWorkMinutes: number;
  recoveryGaps: number[];
  mealGaps: number[];
  sleepWindow: { start: string; end: string } | null;
};

const MEAL_TIMES = {
  breakfast: { ideal: 8.5, latest: 10 },
  lunch: { ideal: 13, latest: 14.5 },
  dinner: { ideal: 20, latest: 21.5 },
};

const SLEEP_WINDOW = { earliest: 22, latest: 24 };
const RECOVERY_MINIMUM_MIN = 10;
const DEEP_WORK_TITLES = ["cat prep", "dsa practice", "cat", "dsa", "study", "reading"];

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function toHours(minutes: number): number {
  return minutes / 60;
}

function isDeepWork(title: string): boolean {
  const lower = title.toLowerCase();
  return DEEP_WORK_TITLES.some((d) => lower.includes(d));
}

function isMeal(title: string): boolean {
  const lower = title.toLowerCase();
  return ["breakfast", "lunch", "dinner", "snack", "meal"].some((m) => lower.includes(m));
}

function findMealGaps(commitments: Commitment[]): number[] {
  const gaps: number[] = [];
  const meals = commitments
    .filter((c) => isMeal(c.title))
    .map((c) => ({
      start: toMinutes(c.startTime),
      title: c.title.toLowerCase(),
    }))
    .sort((a, b) => a.start - b.start);

  const breakfast = meals.find((m) => m.title.includes("breakfast"));
  const lunch = meals.find((m) => m.title.includes("lunch"));
  const dinner = meals.find((m) => m.title.includes("dinner"));

  const dayStart = commitments.length > 0 ? toMinutes(commitments[0].startTime) : 480;

  if (!breakfast && dayStart < MEAL_TIMES.breakfast.latest * 60) {
    gaps.push(MEAL_TIMES.breakfast.ideal * 60 - dayStart);
  }
  if (breakfast && !lunch) {
    const gap = MEAL_TIMES.lunch.ideal * 60 - breakfast.start;
    if (gap > 5 * 60) gaps.push(gap);
  }
  if (lunch && !dinner) {
    const gap = MEAL_TIMES.dinner.ideal * 60 - lunch.start;
    if (gap > 6 * 60) gaps.push(gap);
  }
  if (breakfast && lunch) {
    const gap = lunch.start - breakfast.start;
    if (gap > 6 * 60) gaps.push(gap - 5 * 60);
  }
  if (lunch && dinner) {
    const gap = dinner.start - lunch.start;
    if (gap > 7 * 60) gaps.push(gap - 6 * 60);
  }

  return gaps;
}

function findRecoveryGaps(commitments: Commitment[]): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < commitments.length; i++) {
    const prevEnd = toMinutes(commitments[i - 1].endTime);
    const currStart = toMinutes(commitments[i].startTime);
    const gap = currStart - prevEnd;
    if (gap < RECOVERY_MINIMUM_MIN && gap >= 0) {
      gaps.push(gap);
    }
  }
  return gaps;
}

function computeSleepConflicts(commitments: Commitment[]): PlanningIssue[] {
  const issues: PlanningIssue[] = [];
  const lastEnd = commitments.length > 0 ? toMinutes(commitments[commitments.length - 1].endTime) : 0;

  if (lastEnd > SLEEP_WINDOW.earliest * 60) {
    const overflow = lastEnd - SLEEP_WINDOW.earliest * 60;
    issues.push({
      type: "sleep_conflict",
      severity: overflow > 60 ? "high" : "medium",
      description: `Day ends at ${Math.floor(lastEnd / 60)}:${String(lastEnd % 60).padStart(2, "0")} — past recommended wind-down`,
      affectedCommitments: [commitments[commitments.length - 1].title],
      metric: overflow,
    });
  }

  return issues;
}

function computeCognitiveLoad(commitments: Commitment[]): PlanningIssue[] {
  const issues: PlanningIssue[] = [];
  let consecutiveDeep = 0;
  let deepStart = -1;

  for (let i = 0; i < commitments.length; i++) {
    if (isDeepWork(commitments[i].title)) {
      if (consecutiveDeep === 0) deepStart = i;
      consecutiveDeep++;
    } else {
      if (consecutiveDeep >= 3) {
        const affected = commitments.slice(deepStart, deepStart + consecutiveDeep).map((c) => c.title);
        issues.push({
          type: "cognitive_load",
          severity: consecutiveDeep >= 4 ? "high" : "medium",
          description: `${consecutiveDeep} deep work blocks back-to-back`,
          affectedCommitments: affected,
          metric: consecutiveDeep,
        });
      }
      consecutiveDeep = 0;
    }
  }

  if (consecutiveDeep >= 3) {
    const affected = commitments.slice(deepStart, deepStart + consecutiveDeep).map((c) => c.title);
    issues.push({
      type: "cognitive_load",
      severity: consecutiveDeep >= 4 ? "high" : "medium",
      description: `${consecutiveDeep} deep work blocks back-to-back`,
      affectedCommitments: affected,
      metric: consecutiveDeep,
    });
  }

  return issues;
}

function computeOverload(commitments: Commitment[]): { score: number; issue?: PlanningIssue } {
  let totalMinutes = 0;
  let deepMinutes = 0;

  for (const c of commitments) {
    const duration = toMinutes(c.endTime) - toMinutes(c.startTime);
    totalMinutes += duration;
    if (isDeepWork(c.title)) deepMinutes += duration;
  }

  const score = Math.min(100, Math.round(
    (totalMinutes / (10 * 60)) * 40 +
    (deepMinutes / (6 * 60)) * 40 +
    (commitments.length / 8) * 20
  ));

  if (score > 75) {
    return {
      score,
      issue: {
        type: "overload",
        severity: score > 85 ? "high" : "medium",
        description: `Day is ${score}% loaded — ${Math.round(totalMinutes / 60)}h total, ${Math.round(deepMinutes / 60)}h deep work`,
        affectedCommitments: commitments.filter((c) => isDeepWork(c.title)).map((c) => c.title),
        metric: score,
      },
    };
  }

  return { score };
}

function computePacing(commitments: Commitment[]): PlanningIssue[] {
  const issues: PlanningIssue[] = [];
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;

  for (const c of commitments) {
    const start = toMinutes(c.startTime) / 60;
    const duration = (toMinutes(c.endTime) - toMinutes(c.startTime)) / 60;

    if (isDeepWork(c.title) && start > 21 && duration > 1) {
      issues.push({
        type: "pacing",
        severity: "medium",
        description: `${c.title} scheduled late (${c.startTime}) with ${Math.round(duration * 60)} min — cognitive performance drops after 9 PM`,
        affectedCommitments: [c.title],
        metric: start,
      });
    }

    if (isMeal(c.title) && duration < 0.5) {
      issues.push({
        type: "pacing",
        severity: "low",
        description: `${c.title} is only ${Math.round(duration * 60)} min — rushed`,
        affectedCommitments: [c.title],
        metric: duration * 60,
      });
    }
  }

  return issues;
}

export function analyzePlan(commitments: Commitment[]): PlanningAnalysis {
  if (commitments.length === 0) {
    return {
      issues: [],
      overloadScore: 0,
      totalStudyMinutes: 0,
      totalDeepWorkMinutes: 0,
      recoveryGaps: [],
      mealGaps: [],
      sleepWindow: null,
    };
  }

  const sorted = [...commitments].sort(
    (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)
  );

  const recoveryGaps = findRecoveryGaps(sorted);
  const mealGaps = findMealGaps(sorted);
  const sleepConflicts = computeSleepConflicts(sorted);
  const cognitiveLoad = computeCognitiveLoad(sorted);
  const pacing = computePacing(sorted);
  const { score: overloadScore, issue: overloadIssue } = computeOverload(sorted);

  const issues = [...cognitiveLoad, ...sleepConflicts, ...pacing];
  if (overloadIssue) issues.push(overloadIssue);

  if (recoveryGaps.length > 0) {
    issues.push({
      type: "recovery_gap",
      severity: recoveryGaps.length >= 3 ? "high" : "medium",
      description: `${recoveryGaps.length} transition(s) with insufficient recovery time`,
      affectedCommitments: sorted.slice(0, sorted.length).map((c) => c.title),
      metric: recoveryGaps.reduce((a, b) => a + b, 0),
    });
  }

  if (mealGaps.length > 0) {
    issues.push({
      type: "meal_gap",
      severity: mealGaps.length >= 2 ? "high" : "medium",
      description: `${mealGaps.length} meal gap(s) detected`,
      affectedCommitments: sorted.map((c) => c.title),
      metric: mealGaps.reduce((a, b) => a + b, 0),
    });
  }

  issues.sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });

  let totalStudyMinutes = 0;
  let totalDeepWorkMinutes = 0;
  for (const c of sorted) {
    const duration = toMinutes(c.endTime) - toMinutes(c.startTime);
    totalStudyMinutes += duration;
    if (isDeepWork(c.title)) totalDeepWorkMinutes += duration;
  }

  return {
    issues,
    overloadScore,
    totalStudyMinutes,
    totalDeepWorkMinutes,
    recoveryGaps,
    mealGaps,
    sleepWindow: sorted.length > 0
      ? { start: sorted[0].startTime, end: sorted[sorted.length - 1].endTime }
      : null,
  };
}
