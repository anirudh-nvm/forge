import AsyncStorage from "@react-native-async-storage/async-storage";
import { Logger } from "../ai/debug/Logger";

const STORAGE_KEY = "forge_outcome_memory";

export type OutcomeRecord = {
  id: string;
  title: string;
  plannedDate: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart?: string;
  actualEnd?: string;
  outcome: "completed" | "mostlyCompleted" | "notCompleted" | "skipped";
  plannedDurationMin: number;
  actualDurationMin?: number;
  dayOfWeek: string;
  recordedAt: string;
};

export type OutcomeSummary = {
  title: string;
  totalPlanned: number;
  completed: number;
  skipped: number;
  completionRate: number;
  avgActualDuration: number;
  avgPlannedDuration: number;
  commonDay: string;
};

export type PatternInsight = {
  title: string;
  pattern: string;
  confidence: number;
  dataPoints: number;
};

let records: OutcomeRecord[] = [];
let loaded = false;

function generateId(): string {
  return `outcome_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getDayOfWeek(dateStr: string): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[new Date(dateStr).getDay()];
}

export async function loadRecords(): Promise<void> {
  if (loaded) return;
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    records = data ? JSON.parse(data) : [];
    loaded = true;
  } catch {
    records = [];
    loaded = true;
  }
}

export async function saveRecord(record: OutcomeRecord): Promise<void> {
  await loadRecords();
  records.push(record);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export async function recordOutcome(params: {
  title: string;
  plannedDate: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart?: string;
  actualEnd?: string;
  outcome: "completed" | "mostlyCompleted" | "notCompleted" | "skipped";
}): Promise<OutcomeRecord> {
  await loadRecords();

  const parseDuration = (start: string, end: string): number => {
    const toMin = (t: string): number => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    return toMin(end) - toMin(start);
  };

  const record: OutcomeRecord = {
    id: generateId(),
    title: params.title,
    plannedDate: params.plannedDate,
    plannedStart: params.plannedStart,
    plannedEnd: params.plannedEnd,
    actualStart: params.actualStart,
    actualEnd: params.actualEnd,
    outcome: params.outcome,
    plannedDurationMin: parseDuration(params.plannedStart, params.plannedEnd),
    actualDurationMin: params.actualStart && params.actualEnd
      ? parseDuration(params.actualStart, params.actualEnd)
      : undefined,
    dayOfWeek: getDayOfWeek(params.plannedDate),
    recordedAt: new Date().toISOString(),
  };

  await saveRecord(record);
  Logger.log(`[memory] recorded: ${record.title} (${record.outcome})`);
  return record;
}

export async function getSummaries(): Promise<OutcomeSummary[]> {
  await loadRecords();
  const byTitle = new Map<string, OutcomeRecord[]>();

  for (const r of records) {
    const key = r.title.toLowerCase();
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key)!.push(r);
  }

  const summaries: OutcomeSummary[] = [];
  for (const [title, recs] of byTitle) {
    const completed = recs.filter((r) => r.outcome === "completed" || r.outcome === "mostlyCompleted").length;
    const skipped = recs.filter((r) => r.outcome === "skipped").length;
    const actualDurations = recs.filter((r) => r.actualDurationMin != null).map((r) => r.actualDurationMin!);

    const dayCounts = new Map<string, number>();
    for (const r of recs) {
      dayCounts.set(r.dayOfWeek, (dayCounts.get(r.dayOfWeek) ?? 0) + 1);
    }
    let commonDay = "";
    let maxCount = 0;
    for (const [day, count] of dayCounts) {
      if (count > maxCount) {
        maxCount = count;
        commonDay = day;
      }
    }

    summaries.push({
      title: recs[0].title,
      totalPlanned: recs.length,
      completed,
      skipped,
      completionRate: completed / recs.length,
      avgActualDuration: actualDurations.length > 0
        ? actualDurations.reduce((a, b) => a + b, 0) / actualDurations.length
        : 0,
      avgPlannedDuration: recs.reduce((a, r) => a + r.plannedDurationMin, 0) / recs.length,
      commonDay,
    });
  }

  return summaries;
}

export async function detectPatterns(): Promise<PatternInsight[]> {
  await loadRecords();
  const insights: PatternInsight[] = [];
  const byTitle = new Map<string, OutcomeRecord[]>();

  for (const r of records) {
    const key = r.title.toLowerCase();
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key)!.push(r);
  }

  for (const [title, recs] of byTitle) {
    if (recs.length < 3) continue;

    const byDay = new Map<string, { total: number; skipped: number }>();
    for (const r of recs) {
      if (!byDay.has(r.dayOfWeek)) byDay.set(r.dayOfWeek, { total: 0, skipped: 0 });
      const d = byDay.get(r.dayOfWeek)!;
      d.total++;
      if (r.outcome === "skipped") d.skipped++;
    }

    for (const [day, stats] of byDay) {
      if (stats.total >= 3 && stats.skipped / stats.total >= 0.6) {
        insights.push({
          title: recs[0].title,
          pattern: `Usually skipped on ${day}`,
          confidence: stats.skipped / stats.total,
          dataPoints: stats.total,
        });
      }
    }

    const avgPlanned = recs.reduce((a, r) => a + r.plannedDurationMin, 0) / recs.length;
    const actuals = recs.filter((r) => r.actualDurationMin != null);
    if (actuals.length >= 3) {
      const avgActual = actuals.reduce((a, r) => a + r.actualDurationMin!, 0) / actuals.length;
      if (avgActual > avgPlanned * 1.3) {
        insights.push({
          title: recs[0].title,
          pattern: `Takes ~${Math.round(avgActual)} min (planned ~${Math.round(avgPlanned)} min)`,
          confidence: 0.8,
          dataPoints: actuals.length,
        });
      } else if (avgActual < avgPlanned * 0.7) {
        insights.push({
          title: recs[0].title,
          pattern: `Takes ~${Math.round(avgActual)} min (planned ~${Math.round(avgPlanned)} min)`,
          confidence: 0.8,
          dataPoints: actuals.length,
        });
      }
    }
  }

  return insights;
}

export async function reset(): Promise<void> {
  records = [];
  loaded = false;
  await AsyncStorage.removeItem(STORAGE_KEY);
}
