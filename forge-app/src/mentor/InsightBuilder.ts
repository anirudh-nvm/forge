import type { PatternReport, AnyPattern } from "../memory/PatternTypes";
import type { Insight, InsightReport } from "./MentorTypes";

function completionInsights(pattern: AnyPattern): Insight[] {
  if (pattern.type !== "completion_rate") return [];
  const p = pattern;
  const pct = Math.round(p.rate * 100);

  if (p.rate >= 0.8) {
    return [{ category: "completion", text: `${p.commitment} completion rate is strong at ${pct}%.`, severity: "low" }];
  }
  if (p.rate >= 0.5) {
    return [{ category: "completion", text: `${p.commitment} completion rate is moderate at ${pct}%.`, severity: "medium" }];
  }
  return [{ category: "completion", text: `${p.commitment} completion rate is low at ${pct}%.`, severity: "high" }];
}

function timeInsights(pattern: AnyPattern): Insight[] {
  if (pattern.type !== "time_preference") return [];
  const p = pattern;
  const { morning, afternoon, evening } = p.counts;
  const total = morning + afternoon + evening;
  if (total === 0) return [];

  const morningPct = Math.round((morning / total) * 100);
  const eveningPct = Math.round((evening / total) * 100);

  const insights: Insight[] = [];
  if (morningPct >= 60) {
    insights.push({ category: "time", text: `Most completed commitments happen in the morning (${morningPct}%).`, severity: "low" });
  }
  if (eveningPct >= 60) {
    insights.push({ category: "time", text: `Most completed commitments happen in the evening (${eveningPct}%).`, severity: "low" });
  }
  if (morningPct > eveningPct + 20) {
    insights.push({ category: "time", text: `Morning commitments are completed more consistently than evening commitments.`, severity: "low" });
  }
  if (eveningPct > morningPct + 20) {
    insights.push({ category: "time", text: `Evening commitments are completed more consistently than morning commitments.`, severity: "low" });
  }

  return insights;
}

function trustInsights(pattern: AnyPattern): Insight[] {
  if (pattern.type !== "trust_trend") return [];
  const p = pattern;
  const change = p.endScore - p.startScore;
  const absChange = Math.abs(change);

  if (p.direction === "up" && absChange >= 5) {
    return [{ category: "trust", text: `Trust has increased steadily this week (+${absChange}).`, severity: "low" }];
  }
  if (p.direction === "down" && absChange >= 5) {
    return [{ category: "trust", text: `Trust has declined this week (${change}).`, severity: "high" }];
  }
  if (p.direction === "stable") {
    return [{ category: "trust", text: `Trust score has been stable this week.`, severity: "low" }];
  }
  return [];
}

function adjustmentInsights(pattern: AnyPattern): Insight[] {
  if (pattern.type !== "adjustment_frequency") return [];
  const p = pattern;

  if (p.ratio <= 0.05) {
    return [{ category: "adjustment", text: `Schedule is very stable with minimal adjustments.`, severity: "low" }];
  }
  if (p.ratio >= 0.3) {
    return [{ category: "adjustment", text: `Frequent schedule adjustments (${Math.round(p.ratio * 100)}% of sessions).`, severity: "medium" }];
  }
  return [];
}

function consistencyInsights(pattern: AnyPattern): Insight[] {
  if (pattern.type !== "commitment_consistency") return [];
  const p = pattern;
  const insights: Insight[] = [];

  for (const c of p.commitments) {
    const pct = Math.round(c.rate * 100);
    if (c.rate >= 0.8) {
      insights.push({ category: "consistency", text: `${c.title} is highly consistent (${pct}%).`, severity: "low" });
    } else if (c.rate < 0.5) {
      insights.push({ category: "consistency", text: `${c.title} consistency is low (${pct}%).`, severity: "medium" });
    }
  }

  return insights;
}

const INSIGHT_EXTRACTORS = [
  completionInsights,
  timeInsights,
  trustInsights,
  adjustmentInsights,
  consistencyInsights,
];

export function buildInsights(report: PatternReport): InsightReport {
  const insights: Insight[] = [];

  for (const pattern of report.patterns) {
    for (const extractor of INSIGHT_EXTRACTORS) {
      insights.push(...extractor(pattern));
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    windowDays: report.windowDays,
    insights,
  };
}
