import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TodayPlan, TrustScore, Session } from "../types/todayPlan";
import type { Commitment } from "../types/commitment";
import type { DayArchive } from "../engine/LifecycleEngine";
import type { TimelineEvent } from "../types/events";
import type { Experiment } from "../memory/ExperimentTypes";
import type { PlanningProfile } from "../adaptive/AdaptiveTypes";
import type { IdentityData } from "../identity/IdentityTypes";
import type { UserProfile, MentorPersonality } from "../onboarding/OnboardingTypes";
import type { Observation } from "../observation/ObservationTypes";
import type { ReflectionMemory } from "../reflection/ReflectionTypes";
import type { StableMemory, WorkingMemory } from "../memory/MemoryProfile";
import type { PatternMemory } from "../ai/PatternLearner";
import type { ConversationMemory } from "../ai/ConversationMemory";
import type { CalendarEvent, CalendarPattern } from "../types/calendar";
import type { DailyHealth } from "../engine/HealthEngine";
import type { GitHubData } from "../engine/GitHubEngine";

const STORAGE_VERSION = "1";

function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function dedupeCommitments(commitments: Commitment[]): Commitment[] {
  const earliestByTitle = new Map<string, Commitment>();
  for (const c of commitments) {
    const key = normalizeTitle(c.title);
    const existing = earliestByTitle.get(key);
    if (!existing) {
      earliestByTitle.set(key, c);
    }
  }
  return [...earliestByTitle.values()].sort((a, b) => {
    const toMin = (t: string) => {
      const m = t.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (!m) return 0;
      let h = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      const p = m[3]?.toUpperCase();
      if (p === "PM" && h !== 12) h += 12;
      if (p === "AM" && h === 12) h = 0;
      return h * 60 + min;
    };
    return toMin(a.startTime) - toMin(b.startTime);
  });
}

const KEYS = {
  VERSION: "forge:version",
  TODAY_PLAN: "forge:today_plan",
  TRUST_SCORE: "forge:trust_score",
  CURRENT_SESSION: "forge:current_session",
  USER_NAME: "forge:user_name",
  PRIORITIES: "forge:priorities",
  LAST_ACTIVE_DATE: "forge:last_active_date",
  DAY_ARCHIVES: "forge:day_archives",
  TIMELINE: "forge:timeline",
  EXPERIMENTS: "forge:experiments",
  PLANNING_PROFILE: "forge:planning_profile",
  IDENTITY: "forge:identity",
  USER_PROFILE: "forge:user_profile",
  PERSONALITY: "forge:personality",
  ONBOARDING_COMPLETE: "forge:onboarding_complete",
  OBSERVATIONS: "forge:observations",
  REFLECTION_MEMORY: "forge:reflection_memory",
  STABLE_MEMORY: "forge:stable_memory",
  WORKING_MEMORY: "forge:working_memory",
  PATTERN_MEMORY: "forge:pattern_memory",
  CONVERSATION_MEMORY: "forge:conversation_memory",
  CALENDAR_EVENTS: "forge:calendar_events",
  CALENDAR_PATTERNS: "forge:calendar_patterns",
  CALENDAR_SYNCED_AT: "forge:calendar_synced_at",
  HEALTH_DATA: "forge:health_data",
  HEALTH_SYNCED_AT: "forge:health_synced_at",
  GITHUB_DATA: "forge:github_data",
  GITHUB_USERNAME: "forge:github_username",
  GITHUB_TOKEN: "forge:github_token",
} as const;

export class StorageEngine {
  static async saveTodayPlan(plan: TodayPlan): Promise<void> {
    await AsyncStorage.setItem(KEYS.TODAY_PLAN, JSON.stringify(plan));
  }

  static async loadTodayPlan(): Promise<TodayPlan | null> {
    const data = await AsyncStorage.getItem(KEYS.TODAY_PLAN);
    if (!data) return null;
    const plan: TodayPlan = JSON.parse(data);
    plan.commitments = dedupeCommitments(plan.commitments);
    return plan;
  }

  static async clearTodayPlan(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.TODAY_PLAN);
  }

  static async saveTrustScore(score: TrustScore): Promise<void> {
    await AsyncStorage.setItem(KEYS.TRUST_SCORE, JSON.stringify(score));
  }

  static async loadTrustScore(): Promise<TrustScore | null> {
    const data = await AsyncStorage.getItem(KEYS.TRUST_SCORE);
    return data ? JSON.parse(data) : null;
  }

  static async saveCurrentSession(session: Session | null): Promise<void> {
    if (session) {
      await AsyncStorage.setItem(KEYS.CURRENT_SESSION, JSON.stringify(session));
    } else {
      await AsyncStorage.removeItem(KEYS.CURRENT_SESSION);
    }
  }

  static async loadCurrentSession(): Promise<Session | null> {
    const data = await AsyncStorage.getItem(KEYS.CURRENT_SESSION);
    return data ? JSON.parse(data) : null;
  }

  static async clearCurrentSession(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.CURRENT_SESSION);
  }

  static async saveUserName(name: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.USER_NAME, JSON.stringify(name));
  }

  static async loadUserName(): Promise<string | null> {
    const data = await AsyncStorage.getItem(KEYS.USER_NAME);
    return data ? JSON.parse(data) : null;
  }

  static async savePriorities(priorities: string[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.PRIORITIES, JSON.stringify(priorities));
  }

  static async loadPriorities(): Promise<string[]> {
    const data = await AsyncStorage.getItem(KEYS.PRIORITIES);
    return data ? JSON.parse(data) : [];
  }

  static async getLastActiveDate(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.LAST_ACTIVE_DATE);
  }

  static async setLastActiveDate(date: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.LAST_ACTIVE_DATE, date);
  }

  static async saveDayArchive(archive: DayArchive): Promise<void> {
    const data = await AsyncStorage.getItem(KEYS.DAY_ARCHIVES);
    const archives: DayArchive[] = data ? JSON.parse(data) : [];
    archives.push(archive);
    await AsyncStorage.setItem(KEYS.DAY_ARCHIVES, JSON.stringify(archives));
  }

  static async loadDayArchives(): Promise<DayArchive[]> {
    const data = await AsyncStorage.getItem(KEYS.DAY_ARCHIVES);
    return data ? JSON.parse(data) : [];
  }

  static async getVersion(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.VERSION);
  }

  static async setVersion(): Promise<void> {
    await AsyncStorage.setItem(KEYS.VERSION, STORAGE_VERSION);
  }

  static async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove(Object.values(KEYS));
  }

  static async saveTimeline(events: TimelineEvent[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.TIMELINE, JSON.stringify(events));
  }

  static async loadTimeline(): Promise<TimelineEvent[]> {
    const data = await AsyncStorage.getItem(KEYS.TIMELINE);
    if (!data) return [];
    const events: TimelineEvent[] = JSON.parse(data);
    return events.map((e) => ({ ...e, timestamp: new Date(e.timestamp) }));
  }

  static async clearTimeline(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.TIMELINE);
  }

  static async saveExperiments(exps: Experiment[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.EXPERIMENTS, JSON.stringify(exps));
  }

  static async loadExperiments(): Promise<Experiment[]> {
    const data = await AsyncStorage.getItem(KEYS.EXPERIMENTS);
    if (!data) return [];
    const exps: Experiment[] = JSON.parse(data);
    return exps.map((e) => ({
      ...e,
      createdAt: e.closedAt ? e.closedAt : e.createdAt,
    }));
  }

  static async clearExperiments(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.EXPERIMENTS);
  }

  static async savePlanningProfile(profile: PlanningProfile): Promise<void> {
    await AsyncStorage.setItem(KEYS.PLANNING_PROFILE, JSON.stringify(profile));
  }

  static async loadPlanningProfile(): Promise<PlanningProfile | null> {
    const data = await AsyncStorage.getItem(KEYS.PLANNING_PROFILE);
    return data ? JSON.parse(data) : null;
  }

  static async clearPlanningProfile(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.PLANNING_PROFILE);
  }

  static async saveIdentityData(data: IdentityData): Promise<void> {
    await AsyncStorage.setItem(KEYS.IDENTITY, JSON.stringify(data));
  }

  static async loadIdentityData(): Promise<IdentityData> {
    const raw = await AsyncStorage.getItem(KEYS.IDENTITY);
    if (!raw) {
      return { lifeDirections: [], goals: [], projects: [], tasks: [] };
    }
    return JSON.parse(raw);
  }

  static async clearIdentityData(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.IDENTITY);
  }

  static async saveUserProfile(profile: UserProfile): Promise<void> {
    await AsyncStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(profile));
  }

  static async loadUserProfile(): Promise<UserProfile | null> {
    const data = await AsyncStorage.getItem(KEYS.USER_PROFILE);
    return data ? JSON.parse(data) : null;
  }

  static async clearUserProfile(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.USER_PROFILE);
  }

  static async savePersonality(personality: MentorPersonality): Promise<void> {
    await AsyncStorage.setItem(KEYS.PERSONALITY, JSON.stringify(personality));
  }

  static async loadPersonality(): Promise<MentorPersonality | null> {
    const data = await AsyncStorage.getItem(KEYS.PERSONALITY);
    return data ? (JSON.parse(data) as MentorPersonality) : null;
  }

  static async isOnboardingComplete(): Promise<boolean> {
    const data = await AsyncStorage.getItem(KEYS.ONBOARDING_COMPLETE);
    return data === "true";
  }

  static async setOnboardingComplete(): Promise<void> {
    await AsyncStorage.setItem(KEYS.ONBOARDING_COMPLETE, "true");
  }

  static async clearOnboardingComplete(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.ONBOARDING_COMPLETE);
  }

  static async saveObservations(observations: Observation[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.OBSERVATIONS, JSON.stringify(observations));
  }

  static async loadObservations(): Promise<Observation[]> {
    const data = await AsyncStorage.getItem(KEYS.OBSERVATIONS);
    return data ? JSON.parse(data) : [];
  }

  static async clearObservations(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.OBSERVATIONS);
  }

  static async saveReflectionMemory(memories: ReflectionMemory[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.REFLECTION_MEMORY, JSON.stringify(memories));
  }

  static async loadReflectionMemory(): Promise<ReflectionMemory[]> {
    const data = await AsyncStorage.getItem(KEYS.REFLECTION_MEMORY);
    return data ? JSON.parse(data) : [];
  }

  static async clearReflectionMemory(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.REFLECTION_MEMORY);
  }

  static async saveStableMemory(memory: StableMemory): Promise<void> {
    await AsyncStorage.setItem(KEYS.STABLE_MEMORY, JSON.stringify(memory));
  }

  static async loadStableMemory(): Promise<StableMemory | null> {
    const data = await AsyncStorage.getItem(KEYS.STABLE_MEMORY);
    return data ? JSON.parse(data) : null;
  }

  static async clearStableMemory(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.STABLE_MEMORY);
  }

  static async saveWorkingMemory(memory: WorkingMemory): Promise<void> {
    await AsyncStorage.setItem(KEYS.WORKING_MEMORY, JSON.stringify(memory));
  }

  static async loadWorkingMemory(): Promise<WorkingMemory | null> {
    const data = await AsyncStorage.getItem(KEYS.WORKING_MEMORY);
    return data ? JSON.parse(data) : null;
  }

  static async clearWorkingMemory(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.WORKING_MEMORY);
  }

  static async savePatternMemory(memory: PatternMemory): Promise<void> {
    await AsyncStorage.setItem(KEYS.PATTERN_MEMORY, JSON.stringify(memory));
  }

  static async loadPatternMemory(): Promise<PatternMemory | null> {
    const data = await AsyncStorage.getItem(KEYS.PATTERN_MEMORY);
    return data ? JSON.parse(data) : null;
  }

  static async clearPatternMemory(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.PATTERN_MEMORY);
  }

  static async saveConversationMemory(memory: ConversationMemory): Promise<void> {
    await AsyncStorage.setItem(KEYS.CONVERSATION_MEMORY, JSON.stringify(memory));
  }

  static async loadConversationMemory(): Promise<ConversationMemory | null> {
    const data = await AsyncStorage.getItem(KEYS.CONVERSATION_MEMORY);
    return data ? JSON.parse(data) : null;
  }

  static async clearConversationMemory(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.CONVERSATION_MEMORY);
  }

  static async saveCalendarEvents(events: CalendarEvent[]): Promise<void> {
    const serializable = events.map((e) => ({
      ...e,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate.toISOString(),
    }));
    await AsyncStorage.setItem(KEYS.CALENDAR_EVENTS, JSON.stringify(serializable));
  }

  static async loadCalendarEvents(): Promise<CalendarEvent[]> {
    const data = await AsyncStorage.getItem(KEYS.CALENDAR_EVENTS);
    if (!data) return [];
    const raw: Array<Omit<CalendarEvent, "startDate" | "endDate"> & { startDate: string; endDate: string }> = JSON.parse(data);
    return raw.map((e) => ({
      ...e,
      startDate: new Date(e.startDate),
      endDate: new Date(e.endDate),
    }));
  }

  static async saveCalendarPatterns(patterns: CalendarPattern[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.CALENDAR_PATTERNS, JSON.stringify(patterns));
  }

  static async loadCalendarPatterns(): Promise<CalendarPattern[]> {
    const data = await AsyncStorage.getItem(KEYS.CALENDAR_PATTERNS);
    return data ? JSON.parse(data) : [];
  }

  static async getCalendarSyncedAt(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.CALENDAR_SYNCED_AT);
  }

  static async setCalendarSyncedAt(iso: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.CALENDAR_SYNCED_AT, iso);
  }

  static async saveHealthData(data: DailyHealth): Promise<void> {
    await AsyncStorage.setItem(KEYS.HEALTH_DATA, JSON.stringify(data));
  }

  static async loadHealthData(): Promise<DailyHealth | null> {
    const raw = await AsyncStorage.getItem(KEYS.HEALTH_DATA);
    return raw ? JSON.parse(raw) : null;
  }

  static async getHealthSyncedAt(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.HEALTH_SYNCED_AT);
  }

  static async setHealthSyncedAt(iso: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.HEALTH_SYNCED_AT, iso);
  }

  static async saveGitHubData(data: GitHubData): Promise<void> {
    await AsyncStorage.setItem(KEYS.GITHUB_DATA, JSON.stringify(data));
  }

  static async loadGitHubData(): Promise<GitHubData | null> {
    const raw = await AsyncStorage.getItem(KEYS.GITHUB_DATA);
    return raw ? JSON.parse(raw) : null;
  }

  static async saveGitHubUsername(username: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.GITHUB_USERNAME, JSON.stringify(username));
  }

  static async loadGitHubUsername(): Promise<string | null> {
    const raw = await AsyncStorage.getItem(KEYS.GITHUB_USERNAME);
    return raw ? JSON.parse(raw) : null;
  }

  static async saveGitHubToken(token: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.GITHUB_TOKEN, token);
  }

  static async loadGitHubToken(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.GITHUB_TOKEN);
  }
}
