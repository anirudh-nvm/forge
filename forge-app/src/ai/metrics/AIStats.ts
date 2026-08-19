import { aiAnalytics } from "../AIAnalytics";
import type { AIOperation, OperationTiming, RequestRecord } from "./types";

export interface TimingEntry {
  start: number;
  end: number;
  durationMs: number;
  operation: AIOperation;
  success: boolean;
}

export interface AIStatsSnapshot {
  byOperation: Record<AIOperation, OperationTiming>;
  totalCalls: number;
  averageMs: number;
  p95Ms: number;
  recent: TimingEntry[];
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

/**
 * Phase 7 — Timing dashboard.
 *
 * Every request is timed start → end → duration, bucketed by
 * operation (planning / adjustment / reflection / mentor) so you
 * can see at a glance how each AI path performs.
 */
export function aiStats(recentLimit = 50): AIStatsSnapshot {
  const summary = aiAnalytics.summary();
  const byOperation = summary.byOperation;

  const rawLatencies = aiAnalytics.requests
    .filter((r) => !r.cached)
    .map((r) => r.durationMs)
    .sort((a, b) => a - b);

  const recent: TimingEntry[] = aiAnalytics.requests.slice(-recentLimit).map((r: RequestRecord) => ({
    start: r.at,
    end: r.at + r.durationMs,
    durationMs: r.durationMs,
    operation: r.operation,
    success: r.success,
  }));

  return {
    byOperation,
    totalCalls: summary.totalRequests,
    averageMs: summary.averageLatencyMs,
    p95Ms: percentile(rawLatencies, 95),
    recent,
  };
}

export const timingDashboard = {
  snapshot: aiStats,
};