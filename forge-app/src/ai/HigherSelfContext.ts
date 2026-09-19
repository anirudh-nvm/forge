import { generateHigherSelfMessage, type HigherSelfContext, type HigherSelfMessage } from "../memory/HigherSelf";
import { getAllLifeDirections, getGoals } from "../identity/IdentityEngine";
import { StorageEngine } from "../storage/StorageEngine";
import { getProfile } from "../adaptive/PlanningProfile";
import type { TrustScore } from "../types/todayPlan";

export interface HigherSelfChatContext {
  message: HigherSelfMessage | null;
  identity: string;
  goals: string[];
  lifeSeason: string;
  daysSinceFirstUse: number;
}

const DEFAULT_TRUST_SCORE: TrustScore = {
  current: 50,
  history: [],
  stage: "new",
};

export async function buildHigherSelfChatContext(): Promise<HigherSelfChatContext> {
  const [profile, trustScore] = await Promise.all([
    StorageEngine.loadUserProfile().catch(() => null),
    StorageEngine.loadTrustScore().catch(() => DEFAULT_TRUST_SCORE),
  ]);

  let lifeDirections: ReturnType<typeof getAllLifeDirections> = [];
  try {
    lifeDirections = getAllLifeDirections();
  } catch {
    lifeDirections = [];
  }

  const primaryDirection = lifeDirections[0];
  const goals = primaryDirection ? getGoals(primaryDirection.id) : [];
  const score = trustScore ?? DEFAULT_TRUST_SCORE;

  // Calculate days since first use from trust score history
  const firstEvent = score.history[0];
  const daysSinceFirstUse = firstEvent
    ? Math.floor((Date.now() - new Date(firstEvent.timestamp).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Build Higher Self context
  const hsContext: HigherSelfContext = {
    trustScore: score,
    observations: [],
    milestones: [],
    daysSinceFirstUse,
    now: new Date(),
  };

  const message = generateHigherSelfMessage(hsContext);

  return {
    message,
    identity: primaryDirection?.title ?? "undefined",
    goals: goals.map((g) => g.title),
    lifeSeason: profile?.lifeSeason ?? "student",
    daysSinceFirstUse,
  };
}

export function formatHigherSelfForLLM(message: HigherSelfMessage | null): string {
  if (!message) return "";
  return `\n\nHIGHER SELF INSIGHT:\n${message.text}`;
}

export function formatIdentityForLLM(identity: string, goals: string[]): string {
  const parts: string[] = [];
  if (identity && identity !== "undefined") {
    parts.push(`Identity: ${identity}`);
  }
  if (goals.length > 0) {
    parts.push(`Goals: ${goals.join(", ")}`);
  }
  return parts.length > 0 ? `\n\nIDENTITY CONTEXT:\n${parts.join("\n")}` : "";
}
