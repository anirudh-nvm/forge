import AsyncStorage from "@react-native-async-storage/async-storage";
import type { OutcomeRecord } from "./MemoryEngine";
import * as MemoryEngine from "./MemoryEngine";
import { Logger } from "../ai/debug/Logger";

const STORAGE_KEY = "forge_beliefs";

export type Belief = {
  id: string;
  type: "time_preference" | "duration_pattern" | "day_pattern" | "energy_pattern" | "sequence_pattern";
  commitment: string;
  statement: string;
  confidence: number;
  dataPoints: number;
  lastUpdated: string;
  evidence: string[];
};

let beliefs: Belief[] = [];
let loaded = false;

function generateId(): string {
  return `belief_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function loadBeliefs(): Promise<void> {
  if (loaded) return;
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    beliefs = data ? JSON.parse(data) : [];
    loaded = true;
  } catch {
    beliefs = [];
    loaded = true;
  }
}

export async function saveBeliefs(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(beliefs));
}

export async function updateBelief(params: {
  type: Belief["type"];
  commitment: string;
  statement: string;
  confidence: number;
  evidence: string;
}): Promise<Belief> {
  await loadBeliefs();

  const existing = beliefs.find(
    (b) => b.type === params.type && b.commitment.toLowerCase() === params.commitment.toLowerCase()
  );

  if (existing) {
    existing.confidence = (existing.confidence * existing.dataPoints + params.confidence) / (existing.dataPoints + 1);
    existing.dataPoints++;
    existing.statement = params.statement;
    existing.evidence.push(params.evidence);
    existing.lastUpdated = new Date().toISOString();
    await saveBeliefs();
    Logger.log(`[belief] updated: ${existing.statement} (${Math.round(existing.confidence * 100)}%)`);
    return existing;
  }

  const belief: Belief = {
    id: generateId(),
    type: params.type,
    commitment: params.commitment,
    statement: params.statement,
    confidence: params.confidence,
    dataPoints: 1,
    lastUpdated: new Date().toISOString(),
    evidence: [params.evidence],
  };

  beliefs.push(belief);
  await saveBeliefs();
  Logger.log(`[belief] created: ${belief.statement} (${Math.round(belief.confidence * 100)}%)`);
  return belief;
}

export async function buildBeliefsFromMemory(): Promise<Belief[]> {
  const records = await getRecords();
  if (records.length === 0) return [];

  const byTitle = new Map<string, OutcomeRecord[]>();
  for (const r of records) {
    const key = r.title.toLowerCase();
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key)!.push(r);
  }

  const newBeliefs: Belief[] = [];

  for (const [title, recs] of byTitle) {
    if (recs.length < 3) continue;

    const byDay = new Map<string, { total: number; completed: number; skipped: number }>();
    for (const r of recs) {
      if (!byDay.has(r.dayOfWeek)) byDay.set(r.dayOfWeek, { total: 0, completed: 0, skipped: 0 });
      const d = byDay.get(r.dayOfWeek)!;
      d.total++;
      if (r.outcome === "completed" || r.outcome === "mostlyCompleted") d.completed++;
      if (r.outcome === "skipped") d.skipped++;
    }

    for (const [day, stats] of byDay) {
      if (stats.total >= 3) {
        const completionRate = stats.completed / stats.total;
        if (completionRate >= 0.7) {
          const belief = await updateBelief({
            type: "day_pattern",
            commitment: recs[0].title,
            statement: `${day} works well for ${recs[0].title}`,
            confidence: completionRate,
            evidence: `${stats.completed}/${stats.total} completed on ${day}`,
          });
          newBeliefs.push(belief);
        } else if (completionRate <= 0.3) {
          const belief = await updateBelief({
            type: "day_pattern",
            commitment: recs[0].title,
            statement: `${day} doesn't work for ${recs[0].title}`,
            confidence: 1 - completionRate,
            evidence: `${stats.skipped}/${stats.total} skipped on ${day}`,
          });
          newBeliefs.push(belief);
        }
      }
    }

    const withTimes = recs.filter((r) => r.actualStart);
    if (withTimes.length >= 3) {
      const startHours = withTimes.map((r) => {
        const [h, m] = r.actualStart!.split(":").map(Number);
        return h + m / 60;
      });
      const avgStart = startHours.reduce((a, b) => a + b, 0) / startHours.length;
      const morningCount = startHours.filter((h) => h < 12).length;
      const morningRate = morningCount / startHours.length;

      if (morningRate >= 0.7) {
        const belief = await updateBelief({
          type: "time_preference",
          commitment: recs[0].title,
          statement: `Morning works best for ${recs[0].title}`,
          confidence: morningRate,
          evidence: `${morningCount}/${startHours.length} sessions in morning`,
        });
        newBeliefs.push(belief);
      } else if (morningRate <= 0.3) {
        const belief = await updateBelief({
          type: "time_preference",
          commitment: recs[0].title,
          statement: `Evening works best for ${recs[0].title}`,
          confidence: 1 - morningRate,
          evidence: `${startHours.length - morningCount}/${startHours.length} sessions in evening`,
        });
        newBeliefs.push(belief);
      }
    }

    const actuals = recs.filter((r) => r.actualDurationMin != null);
    if (actuals.length >= 3) {
      const avgActual = actuals.reduce((a, r) => a + r.actualDurationMin!, 0) / actuals.length;
      const avgPlanned = actuals.reduce((a, r) => a + r.plannedDurationMin, 0) / actuals.length;

      if (avgActual > avgPlanned * 1.2) {
        const belief = await updateBelief({
          type: "duration_pattern",
          commitment: recs[0].title,
          statement: `${recs[0].title} takes ~${Math.round(avgActual)} min, not ${Math.round(avgPlanned)} min`,
          confidence: 0.8,
          evidence: `avg actual: ${Math.round(avgActual)} min vs planned: ${Math.round(avgPlanned)} min`,
        });
        newBeliefs.push(belief);
      }
    }
  }

  Logger.log(`[belief] built ${newBeliefs.length} beliefs from memory`);
  return newBeliefs;
}

export async function getBeliefsForCommitment(title: string): Promise<Belief[]> {
  await loadBeliefs();
  return beliefs.filter((b) => b.commitment.toLowerCase() === title.toLowerCase());
}

export async function getHighConfidenceBeliefs(minConfidence = 0.7): Promise<Belief[]> {
  await loadBeliefs();
  return beliefs.filter((b) => b.confidence >= minConfidence);
}

export async function getAllBeliefs(): Promise<Belief[]> {
  await loadBeliefs();
  return [...beliefs];
}

export async function reset(): Promise<void> {
  beliefs = [];
  loaded = false;
  await AsyncStorage.removeItem(STORAGE_KEY);
}

async function getRecords(): Promise<OutcomeRecord[]> {
  const STORAGE_KEY = "forge_outcome_memory";
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}
