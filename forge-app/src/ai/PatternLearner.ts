import type { TodayPlan } from "../types/todayPlan";
import type { Commitment } from "../types/commitment";

export type PatternField = "endTime" | "startTime" | "duration" | "removed";

export type LearnedPattern = {
  id: string;
  title: string;
  field: PatternField;
  plannedValue: string;
  actualValue: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  status: "candidate" | "confirmed" | "dismissed";
  confirmedAt?: string;
};

export type PatternObservation = {
  title: string;
  field: PatternField;
  plannedValue: string;
  actualValue: string;
  date: string;
};

export type PatternMemory = {
  patterns: LearnedPattern[];
  observations: PatternObservation[];
};

export function createEmptyPatternMemory(): PatternMemory {
  return { patterns: [], observations: [] };
}

function dayKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

function patternId(title: string, field: PatternField, actual: string): string {
  return `${title.toLowerCase().replace(/\s+/g, "-")}:${field}:${actual.toLowerCase()}`;
}

function commitmentDiff(before: Commitment, after: Commitment): PatternObservation[] {
  const observations: PatternObservation[] = [];
  const date = dayKey(new Date());

  if (before.endTime !== after.endTime) {
    observations.push({
      title: after.title,
      field: "endTime",
      plannedValue: before.endTime,
      actualValue: after.endTime,
      date,
    });
  }

  if (before.startTime !== after.startTime) {
    observations.push({
      title: after.title,
      field: "startTime",
      plannedValue: before.startTime,
      actualValue: after.startTime,
      date,
    });
  }

  return observations;
}

export function diffPlans(
  before: TodayPlan,
  after: TodayPlan
): PatternObservation[] {
  const observations: PatternObservation[] = [];
  const afterById = new Map(after.commitments.map((c) => [c.id, c]));
  const date = dayKey(new Date());

  for (const beforeCommitment of before.commitments) {
    const afterCommitment = afterById.get(beforeCommitment.id);
    if (afterCommitment) {
      observations.push(...commitmentDiff(beforeCommitment, afterCommitment));
    } else {
      observations.push({
        title: beforeCommitment.title,
        field: "removed",
        plannedValue: `${beforeCommitment.startTime}–${beforeCommitment.endTime}`,
        actualValue: "removed",
        date,
      });
    }
  }

  return observations;
}

export function recordObservations(
  memory: PatternMemory,
  observations: PatternObservation[]
): PatternMemory {
  const next: PatternMemory = {
    patterns: [...memory.patterns],
    observations: [...memory.observations],
  };

  for (const obs of observations) {
    next.observations.push(obs);

    const id = patternId(obs.title, obs.field, obs.actualValue);
    const existing = next.patterns.find((p) => p.id === id);

    if (existing) {
      existing.occurrences += 1;
      existing.lastSeen = obs.date;
    } else {
      next.patterns.push({
        id,
        title: obs.title,
        field: obs.field,
        plannedValue: obs.plannedValue,
        actualValue: obs.actualValue,
        occurrences: 1,
        firstSeen: obs.date,
        lastSeen: obs.date,
        status: "candidate",
      });
    }
  }

  return next;
}

export function getNotablePatterns(
  memory: PatternMemory,
  minOccurrences = 3
): LearnedPattern[] {
  return memory.patterns
    .filter(
      (p) => p.status === "candidate" && p.occurrences >= minOccurrences
    )
    .sort((a, b) => b.occurrences - a.occurrences);
}

export function confirmPattern(
  memory: PatternMemory,
  id: string,
  date?: Date
): PatternMemory {
  return {
    ...memory,
    patterns: memory.patterns.map((p) =>
      p.id === id
        ? {
            ...p,
            status: "confirmed" as const,
            confirmedAt: (date ?? new Date()).toISOString(),
          }
        : p
    ),
  };
}

export function dismissPattern(
  memory: PatternMemory,
  id: string
): PatternMemory {
  return {
    ...memory,
    patterns: memory.patterns.map((p) =>
      p.id === id ? { ...p, status: "dismissed" as const } : p
    ),
  };
}

export function buildLearningPrompt(pattern: LearnedPattern): string {
  switch (pattern.field) {
    case "endTime":
      return `i've noticed ${pattern.title.toLowerCase()} usually ends around ${pattern.actualValue} instead of ${pattern.plannedValue}.`;
    case "startTime":
      return `i've noticed ${pattern.title.toLowerCase()} usually starts around ${pattern.actualValue} instead of ${pattern.plannedValue}.`;
    case "duration":
      return `i've noticed ${pattern.title.toLowerCase()} usually takes ${pattern.actualValue} instead of ${pattern.plannedValue}.`;
    case "removed":
      return `i've noticed ${pattern.title.toLowerCase()} tends to get cancelled. want me to skip it next time?`;
  }
}

export function summarizePattern(pattern: LearnedPattern): string {
  return `${pattern.title}: ${pattern.plannedValue} → ${pattern.actualValue} (${pattern.occurrences}×)`;
}