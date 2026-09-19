import type { RelationshipStage, RelationshipContext } from "../types/companion";
import type { TrustScore } from "../types/todayPlan";
import {
  calculateConsistency,
  getRelationshipStage,
} from "./TrustEngine";

const FIRST_USE_KEY = "forge:first_use_date";

export async function initializeFirstUseDate(): Promise<void> {
  const existing = await getFirstUseDate();
  if (!existing) {
    const now = new Date().toISOString();
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    await AsyncStorage.setItem(FIRST_USE_KEY, now);
  }
}

export async function getFirstUseDate(): Promise<string | null> {
  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
  return AsyncStorage.getItem(FIRST_USE_KEY);
}

export async function computeRelationshipContext(
  trustScore: TrustScore
): Promise<RelationshipContext> {
  const firstUseDate = await getFirstUseDate();
  const daysSinceFirstUse = firstUseDate
    ? Math.floor(
        (Date.now() - new Date(firstUseDate).getTime()) / (1000 * 60 * 60 * 24)
      )
    : 0;

  const consistency = calculateConsistency(trustScore.history);
  const stage = getRelationshipStage(
    trustScore.current,
    daysSinceFirstUse,
    consistency
  );

  return {
    stage,
    trustScore: trustScore.current,
    daysSinceFirstUse,
    consistency,
  };
}

export function getStageLabel(stage: RelationshipStage): string {
  switch (stage) {
    case "new":
      return "new";
    case "familiar":
      return "familiar";
    case "trusted":
      return "trusted";
    case "partner":
      return "partner";
  }
}

export function getStageTone(stage: RelationshipStage): string {
  switch (stage) {
    case "new":
      return "i might be wrong...";
    case "familiar":
      return "here's what i think.";
    case "trusted":
      return "i know you well enough to say this.";
    case "partner":
      return "i'm going to push back a little here.";
  }
}
