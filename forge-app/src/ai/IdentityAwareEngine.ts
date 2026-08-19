import type { TodayPlan } from "../types/todayPlan";
import type { Commitment } from "../types/commitment";
import type { Intent } from "./IntentTypes";

export type IdentityContext = {
  priorities: string[];
  values: string[];
};

export type IdentityInterpretation = {
  intent: Intent;
  explanation: string;
  respectsIdentity: boolean;
};

const LEARNING_KEYWORDS = [
  "learn", "study", "dsa", "coding", "exam", "cat", "jee", "reading",
  "practice", "revision", "prep", "college", "competitive", "leetcode",
];

const HEALTH_KEYWORDS = [
  "health", "gym", "workout", "run", "walk", "yoga", "meditation",
  "sleep", "stretch", "swim", "physio",
];

function priorityScore(priorities: string[], keywords: string[]): number {
  return priorities.reduce((score, priority) => {
    const lower = priority.toLowerCase();
    return keywords.some((k) => lower.includes(k) || k.includes(lower))
      ? score + 1
      : score;
  }, 0);
}

export function isLearningPriority(priorities: string[]): boolean {
  return priorityScore(priorities, LEARNING_KEYWORDS) > 0;
}

export function isHealthPriority(priorities: string[]): boolean {
  return priorityScore(priorities, HEALTH_KEYWORDS) > 0;
}

function findFlexibleLearningCommitment(
  plan: TodayPlan
): Commitment | undefined {
  return plan.commitments.find((c) => {
    if (c.locked || c.completed) return false;
    const lower = c.title.toLowerCase();
    return LEARNING_KEYWORDS.some((k) => lower.includes(k));
  });
}

function shortenCommitment(commitment: Commitment, minutes: number): Intent {
  return {
    type: "modify_commitment",
    target: commitment.title,
    changes: { durationMinutes: minutes },
    confidence: 0.55,
  };
}

export function interpretEnergyThroughIdentity(
  intent: Intent,
  plan: TodayPlan,
  identity: IdentityContext
): IdentityInterpretation {
  if (intent.type !== "energy") {
    return { intent, explanation: "", respectsIdentity: false };
  }

  const learning = isLearningPriority(identity.priorities);
  const health = isHealthPriority(identity.priorities);

  if (learning) {
    const commitment = findFlexibleLearningCommitment(plan);
    if (commitment) {
      const shortened = shortenCommitment(commitment, 30);
      return {
        intent: shortened,
        explanation:
          `learning still matters. would shortening today's ${commitment.title.toLowerCase()} session to 30 minutes help you stay consistent instead of skipping it?`,
        respectsIdentity: true,
      };
    }
  }

  if (health) {
    return {
      intent,
      explanation:
        "your health matters — but let's keep something small so today still counts.",
      respectsIdentity: true,
    };
  }

  return {
    intent,
    explanation: "i hear you. let's lighten today.",
    respectsIdentity: false,
  };
}

export function identityExplanationFor(
  intent: Intent,
  identity: IdentityContext
): string {
  if (intent.type === "energy" && isLearningPriority(identity.priorities)) {
    return "i'm interpreting this through your learning priority.";
  }
  return "";
}