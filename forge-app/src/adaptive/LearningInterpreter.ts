import type { Experiment, ExperimentMetric } from "../memory/ExperimentTypes";
import type { LearningReport } from "../memory/ExperimentTypes";
import type {
  PlanningPreferences,
  TimePreference,
  DurationPreference,
  AvoidancePreference,
  TimeWindow,
} from "./AdaptiveTypes";

const MIN_EXPERIMENTS_FOR_CONFIDENCE = 2;
const HIGH_CONFIDENCE_THRESHOLD = 0.7;

function extractTimeWindow(title: string, hypothesis: string): TimeWindow | null {
  const combined = `${title} ${hypothesis}`.toLowerCase();
  if (combined.includes("morning") || combined.includes("before noon") || combined.includes("before lunch")) {
    return "morning";
  }
  if (combined.includes("afternoon")) {
    return "afternoon";
  }
  if (combined.includes("evening") || combined.includes("night") || combined.includes("after dinner")) {
    return "evening";
  }
  return null;
}

function extractDuration(metrics: ExperimentMetric[]): number | null {
  const durationMetric = metrics.find(
    (m) => m.name === "duration" || m.name === "session_length"
  );
  if (durationMetric?.actual != null) {
    return durationMetric.actual;
  }
  return null;
}

function extractAvoidance(experiment: Experiment): AvoidancePreference | null {
  const combined = `${experiment.title} ${experiment.hypothesis}`.toLowerCase();
  let avoidAfter: string | null = null;

  if (combined.includes("after 8") || combined.includes("after 20")) {
    avoidAfter = "20:00";
  } else if (combined.includes("after 9") || combined.includes("after 21")) {
    avoidAfter = "21:00";
  } else if (combined.includes("after 10") || combined.includes("after 22")) {
    avoidAfter = "22:00";
  }

  if (avoidAfter && experiment.outcome === "failed") {
    return {
      commitmentTitle: experiment.commitmentTitle,
      avoidAfter,
      confidence: 0.5,
      reason: `Experiment "${experiment.title}" failed with this constraint`,
    };
  }

  return null;
}

function calculateConfidence(
  experiments: Experiment[],
  commitmentTitle: string
): number {
  const relevant = experiments.filter(
    (e) =>
      e.commitmentTitle === commitmentTitle &&
      e.status === "completed" &&
      e.outcome
  );
  return Math.min(relevant.length / MIN_EXPERIMENTS_FOR_CONFIDENCE, 1);
}

function groupExperimentsByTitle(
  experiments: Experiment[]
): Map<string, Experiment[]> {
  const groups = new Map<string, Experiment[]>();
  for (const exp of experiments) {
    if (exp.status !== "completed" || !exp.outcome) continue;
    const existing = groups.get(exp.commitmentTitle) || [];
    existing.push(exp);
    groups.set(exp.commitmentTitle, existing);
  }
  return groups;
}

function buildTimePreferences(
  experiments: Experiment[]
): TimePreference[] {
  const groups = groupExperimentsByTitle(experiments);
  const preferences: TimePreference[] = [];

  for (const [title, exps] of groups) {
    const windowCounts = new Map<TimeWindow, { success: number; total: number }>();

    for (const exp of exps) {
      const window = extractTimeWindow(exp.title, exp.hypothesis);
      if (!window) continue;

      const existing = windowCounts.get(window) || { success: 0, total: 0 };
      existing.total++;
      if (exp.outcome === "successful") existing.success++;
      windowCounts.set(window, existing);
    }

    let bestWindow: TimeWindow | null = null;
    let bestRate = 0;

    for (const [window, counts] of windowCounts) {
      const rate = counts.total > 0 ? counts.success / counts.total : 0;
      if (rate > bestRate && counts.total >= 1) {
        bestRate = rate;
        bestWindow = window;
      }
    }

    if (bestWindow) {
      preferences.push({
        commitmentTitle: title,
        preferredWindow: bestWindow,
        confidence: calculateConfidence(exps, title),
        basedOnExperiments: exps.map((e) => e.id),
      });
    }
  }

  return preferences;
}

function buildDurationPreferences(
  experiments: Experiment[]
): DurationPreference[] {
  const groups = groupExperimentsByTitle(experiments);
  const preferences: DurationPreference[] = [];

  for (const [title, exps] of groups) {
    const successful = exps.filter((e) => e.outcome === "successful");
    const durations: number[] = [];

    for (const exp of successful) {
      const duration = extractDuration(exp.metrics);
      if (duration != null) durations.push(duration);
    }

    if (durations.length > 0) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      preferences.push({
        commitmentTitle: title,
        preferredMinutes: Math.round(avg),
        confidence: calculateConfidence(exps, title),
      });
    }
  }

  return preferences;
}

function buildAvoidancePreferences(
  experiments: Experiment[]
): AvoidancePreference[] {
  const preferences: AvoidancePreference[] = [];

  for (const exp of experiments) {
    if (exp.status !== "completed" || !exp.outcome) continue;
    const avoidance = extractAvoidance(exp);
    if (avoidance) {
      const existing = preferences.find(
        (p) =>
          p.commitmentTitle === avoidance.commitmentTitle &&
          p.avoidAfter === avoidance.avoidAfter
      );
      if (!existing) {
        preferences.push(avoidance);
      }
    }
  }

  return preferences;
}

export function interpretLearning(
  report: LearningReport
): PlanningPreferences {
  const experiments = report.experiments.filter(
    (e) => e.status === "completed" && e.outcome
  );

  return {
    timePreferences: buildTimePreferences(experiments),
    durationPreferences: buildDurationPreferences(experiments),
    avoidancePreferences: buildAvoidancePreferences(experiments),
    generatedAt: new Date().toISOString(),
    windowDays: report.experiments.length,
  };
}
