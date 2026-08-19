import { getAllLifeDirections, getGoals } from "../identity/IdentityEngine";
import { getProfile } from "../adaptive/PlanningProfile";
import * as ExperimentEngine from "../memory/ExperimentEngine";
import { StorageEngine } from "../storage/StorageEngine";
import type { ConversationEngineContext } from "./ConversationEngine";

export interface MemoryContext {
  lifeSeason: string;
  priorities: string[];
  weeklyTimetable: string;
  planningPreferences: string;
  activeExperiments: string;
  identity: string;
}

export async function buildMemoryContext(): Promise<MemoryContext> {
  const [profile, experiments, lifeDirections] = await Promise.all([
    StorageEngine.loadUserProfile(),
    ExperimentEngine.getActive(),
    getAllLifeDirections(),
  ]);

  const primaryDirection = lifeDirections[0];
  const goals = primaryDirection ? getGoals(primaryDirection.id) : [];

  return {
    lifeSeason: profile?.lifeSeason ?? "student",
    priorities: profile?.priorities ?? [],
    weeklyTimetable: formatTimetable(getProfile()?.timePreferences ?? []),
    planningPreferences: formatPreferences(profile),
    activeExperiments: formatExperiments(experiments),
    identity: primaryDirection ? primaryDirection.title : "undefined",
  };
}

export function buildConversationEngineContext(memory: MemoryContext): ConversationEngineContext {
  return {
    lifeSeason: memory.lifeSeason,
    priorities: memory.priorities,
    currentDate: new Date().toISOString().split("T")[0],
    existingTimetable: memory.weeklyTimetable ? [memory.weeklyTimetable] : [],
  };
}

function formatTimetable(timePreferences: { commitmentTitle: string; preferredWindow: string }[]): string {
  return timePreferences
    .map((t) => `${t.commitmentTitle}: ${t.preferredWindow}`)
    .join("; ");
}

function formatPreferences(profile: { lifeSeason?: string; priorities?: string[] } | null): string {
  if (!profile) return "default";
  const parts: string[] = [];
  if (profile.lifeSeason) parts.push(`life season: ${profile.lifeSeason}`);
  if (profile.priorities && profile.priorities.length > 0) {
    parts.push(`priorities: ${profile.priorities.join(", ")}`);
  }
  return parts.join(", ") || "default";
}

function formatExperiments(experiments: any[]): string {
  if (experiments.length === 0) return "none";
  return experiments.map((e) => `${e.name} (${e.hypothesis})`).join("; ");
}
