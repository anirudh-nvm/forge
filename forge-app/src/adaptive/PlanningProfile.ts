import type {
  PlanningProfile,
  PlanningPreferences,
  TimePreference,
  DurationPreference,
  AvoidancePreference,
} from "./AdaptiveTypes";
import { StorageEngine } from "../storage/StorageEngine";

let profile: PlanningProfile | null = null;
let loaded = false;

function generateId(): string {
  return `profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowStr(): string {
  return new Date().toISOString();
}

export async function loadProfile(): Promise<void> {
  if (loaded) return;
  profile = await StorageEngine.loadPlanningProfile();
  loaded = true;
}

export function getProfile(): PlanningProfile | null {
  return profile;
}

export function getPreferences(): PlanningPreferences | null {
  if (!profile) return null;
  return {
    timePreferences: profile.timePreferences,
    durationPreferences: profile.durationPreferences,
    avoidancePreferences: profile.avoidancePreferences,
    generatedAt: profile.updatedAt,
    windowDays: 0,
  };
}

export function createProfile(): PlanningProfile {
  profile = {
    id: generateId(),
    timePreferences: [],
    durationPreferences: [],
    avoidancePreferences: [],
    createdAt: nowStr(),
    updatedAt: nowStr(),
  };
  StorageEngine.savePlanningProfile(profile).catch(() => {});
  return profile;
}

export function mergePreferences(
  newPreferences: PlanningPreferences
): PlanningProfile {
  if (!profile) {
    profile = {
      id: generateId(),
      timePreferences: [],
      durationPreferences: [],
      avoidancePreferences: [],
      createdAt: nowStr(),
      updatedAt: nowStr(),
    };
  }

  for (const tp of newPreferences.timePreferences) {
    const existing = profile.timePreferences.find(
      (p) => p.commitmentTitle === tp.commitmentTitle
    );
    if (existing) {
      if (tp.confidence >= existing.confidence) {
        Object.assign(existing, tp);
      }
    } else {
      profile.timePreferences.push({ ...tp });
    }
  }

  for (const dp of newPreferences.durationPreferences) {
    const existing = profile.durationPreferences.find(
      (p) => p.commitmentTitle === dp.commitmentTitle
    );
    if (existing) {
      if (dp.confidence >= existing.confidence) {
        Object.assign(existing, dp);
      }
    } else {
      profile.durationPreferences.push({ ...dp });
    }
  }

  for (const ap of newPreferences.avoidancePreferences) {
    const exists = profile.avoidancePreferences.some(
      (p) =>
        p.commitmentTitle === ap.commitmentTitle &&
        p.avoidAfter === ap.avoidAfter
    );
    if (!exists) {
      profile.avoidancePreferences.push({ ...ap });
    }
  }

  profile.updatedAt = nowStr();
  StorageEngine.savePlanningProfile(profile).catch(() => {});
  return profile;
}

export function removePreference(
  type: "time" | "duration" | "avoidance",
  commitmentTitle: string
): void {
  if (!profile) return;

  switch (type) {
    case "time":
      profile.timePreferences = profile.timePreferences.filter(
        (p) => p.commitmentTitle !== commitmentTitle
      );
      break;
    case "duration":
      profile.durationPreferences = profile.durationPreferences.filter(
        (p) => p.commitmentTitle !== commitmentTitle
      );
      break;
    case "avoidance":
      profile.avoidancePreferences = profile.avoidancePreferences.filter(
        (p) => p.commitmentTitle !== commitmentTitle
      );
      break;
  }

  profile.updatedAt = nowStr();
  StorageEngine.savePlanningProfile(profile).catch(() => {});
}

export function reset(): void {
  profile = null;
  loaded = false;
}
