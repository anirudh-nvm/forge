import { getAllLifeDirections, getGoals } from "../identity/IdentityEngine";
import { getProfile } from "../adaptive/PlanningProfile";
import * as ExperimentEngine from "../memory/ExperimentEngine";
import * as MemoryEngine from "../memory/MemoryEngine";
import * as BeliefsEngine from "../memory/BeliefsEngine";
import { StorageEngine } from "../storage/StorageEngine";
import type { ConversationEngineContext } from "./ConversationEngine";

export interface MemoryContext {
  lifeSeason: string;
  priorities: string[];
  weeklyTimetable: string;
  planningPreferences: string;
  activeExperiments: string;
  identity: string;
  goals: string[];
  timePreferences: string;
  behavioralPatterns: string;
  memoryPatterns: string;
  outcomeHistory: string;
  beliefs: string;
}

export async function buildMemoryContext(): Promise<MemoryContext> {
  const [profile, experiments, lifeDirections, patterns, summaries, beliefs] = await Promise.all([
    StorageEngine.loadUserProfile(),
    ExperimentEngine.getActive(),
    getAllLifeDirections(),
    MemoryEngine.detectPatterns().catch(() => []),
    MemoryEngine.getSummaries().catch(() => []),
    BeliefsEngine.getHighConfidenceBeliefs(0.7).catch(() => []),
  ]);

  const primaryDirection = lifeDirections[0];
  const goals = primaryDirection ? getGoals(primaryDirection.id) : [];
  const planningProfile = getProfile();

  return {
    lifeSeason: profile?.lifeSeason ?? "student",
    priorities: profile?.priorities ?? [],
    weeklyTimetable: formatTimetable(planningProfile?.timePreferences ?? []),
    planningPreferences: formatPreferences(profile),
    activeExperiments: formatExperiments(experiments),
    identity: primaryDirection ? primaryDirection.title : "undefined",
    goals: goals.map((g) => g.title),
    timePreferences: formatTimePreferences(planningProfile?.timePreferences ?? []),
    behavioralPatterns: formatBehavioralPatterns(planningProfile),
    memoryPatterns: formatPatterns(patterns),
    outcomeHistory: formatOutcomes(summaries),
    beliefs: formatBeliefs(beliefs),
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

export function buildIdentityPrompt(memory: MemoryContext): string {
  const parts: string[] = [];
  if (memory.identity && memory.identity !== "undefined") {
    parts.push(`Identity: ${memory.identity}`);
  }
  if (memory.goals.length > 0) {
    parts.push(`Goals: ${memory.goals.join(", ")}`);
  }
  if (memory.priorities.length > 0) {
    parts.push(`Priorities: ${memory.priorities.join(", ")}`);
  }
  if (memory.lifeSeason) {
    parts.push(`Life season: ${memory.lifeSeason}`);
  }
  if (memory.timePreferences) {
    parts.push(`Time preferences: ${memory.timePreferences}`);
  }
  if (memory.behavioralPatterns) {
    parts.push(`Patterns: ${memory.behavioralPatterns}`);
  }
  return parts.length > 0 ? parts.join("\n") : "";
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

function formatTimePreferences(prefs: { commitmentTitle: string; preferredWindow: string }[]): string {
  if (prefs.length === 0) return "";
  return prefs.map((p) => `${p.commitmentTitle} prefers ${p.preferredWindow}`).join("; ");
}

function formatBehavioralPatterns(profile: any): string {
  if (!profile?.timePreferences) return "";
  const patterns: string[] = [];
  for (const pref of profile.timePreferences) {
    if (pref.preferredWindow) {
      patterns.push(`${pref.commitmentTitle}: ${pref.preferredWindow}`);
    }
  }
  return patterns.join("; ");
}

function formatPatterns(patterns: MemoryEngine.PatternInsight[]): string {
  if (patterns.length === 0) return "";
  return patterns.map((p) => `${p.title}: ${p.pattern} (confidence: ${Math.round(p.confidence * 100)}%)`).join("; ");
}

function formatOutcomes(summaries: MemoryEngine.OutcomeSummary[]): string {
  if (summaries.length === 0) return "";
  return summaries.map((s) => {
    const rate = Math.round(s.completionRate * 100);
    return `${s.title}: ${rate}% completion (${s.completed}/${s.totalPlanned}), avg ${Math.round(s.avgActualDuration || s.avgPlannedDuration)} min`;
  }).join("; ");
}

function formatBeliefs(beliefs: BeliefsEngine.Belief[]): string {
  if (beliefs.length === 0) return "";
  return beliefs.map((b) => `${b.statement} (confidence: ${Math.round(b.confidence * 100)}%)`).join("; ");
}
