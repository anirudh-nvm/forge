import type { TimelineEvent } from "../types/events";
import type { MemoryWindow } from "./MemoryTypes";
import type {
  AnyPattern,
  CompletionRatePattern,
  TimePreferencePattern,
  AdjustmentFrequencyPattern,
  TrustTrendPattern,
  CommitmentConsistencyPattern,
  PatternReport,
} from "./PatternTypes";

function confidence(sampleSize: number): number {
  return Math.min(sampleSize / 10, 1);
}

function generateId(type: string, commitment?: string): string {
  const suffix = commitment ? `_${commitment.replace(/\s+/g, "_").toLowerCase()}` : "";
  return `${type}${suffix}`;
}

function getTimeOfDay(timestamp: Date): "morning" | "afternoon" | "evening" {
  const hour = timestamp.getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function extractCompletionRates(memory: MemoryWindow): CompletionRatePattern[] {
  const commitmentMap = new Map<string, { completed: number; total: number }>();

  for (const session of memory.completedSessions) {
    const existing = commitmentMap.get(session.title) || { completed: 0, total: 0 };
    existing.completed++;
    existing.total++;
    commitmentMap.set(session.title, existing);
  }

  for (const session of memory.missedSessions) {
    const existing = commitmentMap.get(session.title) || { completed: 0, total: 0 };
    existing.total++;
    commitmentMap.set(session.title, existing);
  }

  const patterns: CompletionRatePattern[] = [];
  for (const [title, stats] of commitmentMap) {
    patterns.push({
      id: generateId("completion_rate", title),
      type: "completion_rate",
      confidence: confidence(stats.total),
      commitment: title,
      completed: stats.completed,
      total: stats.total,
      rate: stats.total > 0 ? stats.completed / stats.total : 0,
    });
  }

  return patterns;
}

function extractTimePreference(memory: MemoryWindow): TimePreferencePattern[] {
  const counts = { morning: 0, afternoon: 0, evening: 0 };

  for (const session of memory.completedSessions) {
    const timeOfDay = getTimeOfDay(new Date(session.timestamp));
    counts[timeOfDay]++;
  }

  const total = counts.morning + counts.afternoon + counts.evening;
  if (total === 0) return [];

  let preferred: "morning" | "afternoon" | "evening" = "morning";
  if (counts.afternoon >= counts.morning && counts.afternoon >= counts.evening) {
    preferred = "afternoon";
  } else if (counts.evening >= counts.morning && counts.evening >= counts.afternoon) {
    preferred = "evening";
  }

  return [{
    id: generateId("time_preference"),
    type: "time_preference",
    confidence: confidence(total),
    preferred,
    counts,
  }];
}

function extractAdjustmentFrequency(memory: MemoryWindow): AdjustmentFrequencyPattern[] {
  const totalSessions = memory.stats.totalSessions;
  if (totalSessions === 0) return [];

  return [{
    id: generateId("adjustment_frequency"),
    type: "adjustment_frequency",
    confidence: confidence(totalSessions),
    adjustments: memory.adjustments.length,
    totalSessions,
    ratio: memory.adjustments.length / totalSessions,
  }];
}

function extractTrustTrend(memory: MemoryWindow): TrustTrendPattern[] {
  const history = memory.trustHistory;
  if (history.length < 2) return [];

  const scores = history.map((h) => h.score);
  const n = scores.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = scores.reduce((a, b) => a + b, 0);
  const sumXY = scores.reduce((acc, y, x) => acc + x * y, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  let direction: "up" | "down" | "stable" = "stable";
  if (slope > 0.5) direction = "up";
  else if (slope < -0.5) direction = "down";

  return [{
    id: generateId("trust_trend"),
    type: "trust_trend",
    confidence: confidence(n),
    direction,
    startScore: scores[0],
    endScore: scores[n - 1],
  }];
}

function extractCommitmentConsistency(memory: MemoryWindow): CommitmentConsistencyPattern[] {
  const commitmentMap = new Map<string, { completed: number; total: number }>();

  for (const session of memory.completedSessions) {
    const existing = commitmentMap.get(session.title) || { completed: 0, total: 0 };
    existing.completed++;
    existing.total++;
    commitmentMap.set(session.title, existing);
  }

  for (const session of memory.missedSessions) {
    const existing = commitmentMap.get(session.title) || { completed: 0, total: 0 };
    existing.total++;
    commitmentMap.set(session.title, existing);
  }

  const commitments = Array.from(commitmentMap.entries()).map(([title, stats]) => ({
    title,
    rate: stats.total > 0 ? stats.completed / stats.total : 0,
  }));

  if (commitments.length === 0) return [];

  const maxSampleSize = Math.max(
    ...Array.from(commitmentMap.values()).map((s) => s.total)
  );

  return [{
    id: generateId("commitment_consistency"),
    type: "commitment_consistency",
    confidence: confidence(maxSampleSize),
    commitments,
  }];
}

export function extractPatterns(memory: MemoryWindow): PatternReport {
  const patterns: AnyPattern[] = [
    ...extractCompletionRates(memory),
    ...extractTimePreference(memory),
    ...extractAdjustmentFrequency(memory),
    ...extractTrustTrend(memory),
    ...extractCommitmentConsistency(memory),
  ];

  return {
    generatedAt: new Date().toISOString(),
    windowDays: memory.daysCovered,
    patterns,
  };
}
