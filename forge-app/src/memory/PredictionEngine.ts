import type { OutcomeRecord, PatternInsight } from "./MemoryEngine";
import * as MemoryEngine from "./MemoryEngine";
import { Logger } from "../ai/debug/Logger";

export type Prediction = {
  title: string;
  trigger: string;
  suggestion: string;
  confidence: number;
  dataPoints: number;
  type: "reschedule" | "adjust_duration" | "add_buffer" | "skip_warning";
};

const DAY_ORDER = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getNextDayOfWeek(currentDay: string, targetDay: string): number {
  const current = DAY_ORDER.indexOf(currentDay);
  const target = DAY_ORDER.indexOf(targetDay);
  return (target - current + 7) % 7;
}

export async function generatePredictions(currentDayOfWeek: string): Promise<Prediction[]> {
  const records = await MemoryEngine.loadRecords().then(() => MemoryEngine.getSummaries());
  const patterns = await MemoryEngine.detectPatterns();
  const predictions: Prediction[] = [];

  for (const pattern of patterns) {
    if (pattern.pattern.includes("skipped on")) {
      const day = pattern.pattern.replace("Usually skipped on ", "");
      const daysUntil = getNextDayOfWeek(currentDayOfWeek, day);
      if (daysUntil > 0 && daysUntil <= 2) {
        predictions.push({
          title: pattern.title,
          trigger: `You usually skip ${pattern.title} on ${day}`,
          suggestion: `Consider moving ${pattern.title} to a different day, or plan a lighter version`,
          confidence: pattern.confidence,
          dataPoints: pattern.dataPoints,
          type: "reschedule",
        });
      }
    }

    if (pattern.pattern.includes("Takes ~")) {
      const match = pattern.pattern.match(/Takes ~(\d+) min \(planned ~(\d+) min\)/);
      if (match) {
        const actual = parseInt(match[1]);
        const planned = parseInt(match[2]);
        if (actual > planned * 1.3) {
          predictions.push({
            title: pattern.title,
            trigger: `${pattern.title} usually takes ${actual} min (planned ${planned} min)`,
            suggestion: `Allocate ${actual + 10} min for ${pattern.title} in future plans`,
            confidence: pattern.confidence,
            dataPoints: pattern.dataPoints,
            type: "adjust_duration",
          });
        }
      }
    }
  }

  const summaries = await MemoryEngine.getSummaries();
  for (const summary of summaries) {
    if (summary.completionRate < 0.5 && summary.totalPlanned >= 3) {
      predictions.push({
        title: summary.title,
        trigger: `You complete ${summary.title} only ${Math.round(summary.completionRate * 100)}% of the time`,
        suggestion: `Consider making ${summary.title} optional or shorter`,
        confidence: 0.7,
        dataPoints: summary.totalPlanned,
        type: "skip_warning",
      });
    }

    if (summary.avgActualDuration > summary.avgPlannedDuration * 1.3 && summary.totalPlanned >= 3) {
      predictions.push({
        title: summary.title,
        trigger: `${summary.title} takes longer than planned`,
        suggestion: `Add a ${Math.round(summary.avgActualDuration - summary.avgPlannedDuration + 10)}-minute buffer`,
        confidence: 0.8,
        dataPoints: summary.totalPlanned,
        type: "add_buffer",
      });
    }
  }

  predictions.sort((a, b) => b.confidence - a.confidence);

  Logger.log(`[prediction] generated ${predictions.length} predictions`);
  return predictions;
}

export function formatPredictions(predictions: Prediction[]): string[] {
  return predictions.map((p) => {
    const icon = p.type === "reschedule" ? "📅" : p.type === "adjust_duration" ? "⏱️" : p.type === "add_buffer" ? "➕" : "⚠️";
    return `${icon} ${p.suggestion}`;
  });
}
