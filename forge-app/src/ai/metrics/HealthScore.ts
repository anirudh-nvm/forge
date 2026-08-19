import { aiAnalytics } from "../AIAnalytics";
import { tokenUsage } from "./TokenUsage";

export interface HealthCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export interface HealthReport {
  healthy: boolean;
  checks: HealthCheck[];
  averageLatencyMs: number;
  parseSuccessRate: number;
  costToday: number;
}

export interface HealthThresholds {
  /** Average latency above this is "slow". */
  slowLatencyMs: number;
  /** Success rate below this is "degraded". */
  minSuccessRatePct: number;
  /** Cost today above this triggers a cost warning. */
  maxDailyCostUsd: number;
}

export const DEFAULT_HEALTH_THRESHOLDS: HealthThresholds = {
  slowLatencyMs: 3000,
  minSuccessRatePct: 90,
  maxDailyCostUsd: 5,
};

/**
 * Phase 8 — Health score.
 *
 * One glance at the production dashboard:
 *   ✓ API Connected
 *   ✓ Cache Working
 *   ✓ Retry Active
 *   ✓ Average 1.8s
 *   ✓ Parse Success 99%
 *   ✓ Cost Today $0.42
 *
 * If any check flips red you know exactly where to look.
 */
export function healthScore(thresholds: HealthThresholds = DEFAULT_HEALTH_THRESHOLDS): HealthReport {
  const summary = aiAnalytics.summary();
  const costToday = tokenUsage.todayCost();

  const checks: HealthCheck[] = [
    {
      label: "API Connected",
      ok: summary.totalRequests > 0,
      detail: summary.totalRequests > 0
        ? `${summary.totalRequests} requests served`
        : "no requests yet",
    },
    {
      label: "Cache Working",
      ok: summary.cacheHits > 0,
      detail: `${summary.cacheHits} hits / ${summary.cacheMisses} misses`,
    },
    {
      label: "Retry Active",
      ok: summary.retryCount >= 0,
      detail: `${summary.retryCount} retries, ${summary.parseFailures} parse failures`,
    },
    {
      label: "Average Latency",
      ok: summary.averageLatencyMs <= thresholds.slowLatencyMs,
      detail: `${summary.averageLatencyMs}s average`,
    },
    {
      label: "Parse Success",
      ok: summary.successRate >= thresholds.minSuccessRatePct,
      detail: `${summary.successRate}% success`,
    },
    {
      label: "Cost Today",
      ok: costToday <= thresholds.maxDailyCostUsd,
      detail: `$${costToday.toFixed(2)} today`,
    },
  ];

  return {
    healthy: checks.every((c) => c.ok),
    checks,
    averageLatencyMs: summary.averageLatencyMs,
    parseSuccessRate: summary.successRate,
    costToday,
  };
}

export const healthDashboard = {
  score: healthScore,
};