import type { SessionOutcome, TrustEvent, TrustScore } from "../types/todayPlan";
import type { RelationshipStage } from "../types/companion";

const TRUST_RULES: Record<SessionOutcome, { protected: number; unprotected: number }> = {
  completed: { protected: 6, unprotected: 3 },
  mostlyCompleted: { protected: 2, unprotected: 1 },
  notCompleted: { protected: -2, unprotected: -1 },
  skipped: { protected: -4, unprotected: -2 },
};

export function calculateTrustChange(
  outcome: SessionOutcome,
  isProtected: boolean
): number {
  const rules = TRUST_RULES[outcome];
  return isProtected ? rules.protected : rules.unprotected;
}

export function updateTrustScore(
  currentScore: TrustScore,
  sessionId: string,
  outcome: SessionOutcome,
  isProtected: boolean
): TrustScore {
  const trustChange = calculateTrustChange(outcome, isProtected);

  const event: TrustEvent = {
    sessionId,
    outcome,
    isProtected,
    trustChange,
    timestamp: new Date(),
  };

  const newCurrent = Math.max(0, Math.min(100, currentScore.current + trustChange));

  return {
    current: newCurrent,
    history: [...currentScore.history, event],
    stage: currentScore.stage,
  };
}

export function getTrustLevel(score: number): string {
  if (score >= 80) return "strong";
  if (score >= 60) return "building";
  if (score >= 40) return "developing";
  if (score >= 20) return "recovering";
  return "rebuilding";
}

function getTrajectory(history: TrustEvent[]): "improving" | "stable" | "declining" {
  const recent = history.slice(-5);
  if (recent.length < 2) return "stable";
  const avgChange = recent.reduce((sum, e) => sum + e.trustChange, 0) / recent.length;
  if (avgChange > 2) return "improving";
  if (avgChange < -2) return "declining";
  return "stable";
}

function getRecentStreak(history: TrustEvent[]): {
  completions: number;
  streakType: "completed" | "skipped" | "mixed";
} {
  let completions = 0;
  let streakType: "completed" | "skipped" | "mixed" = "mixed";

  for (let i = history.length - 1; i >= 0; i--) {
    const event = history[i];
    if (event.outcome === "completed") {
      completions++;
      if (i === history.length - 1) streakType = "completed";
    } else if (event.outcome === "skipped") {
      if (streakType === "completed") break;
      completions = 0;
      streakType = "skipped";
    } else {
      break;
    }
  }

  return { completions, streakType };
}

function getDaysSinceLastSession(history: TrustEvent[]): number {
  if (history.length === 0) return 0;
  const last = history[history.length - 1];
  const now = new Date();
  const diff = now.getTime() - new Date(last.timestamp).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function buildContextualMessage(score: number, history: TrustEvent[]): string {
  const trajectory = getTrajectory(history);
  const streak = getRecentStreak(history);
  const daysSince = getDaysSinceLastSession(history);

  // Trajectory-based foundation
  if (trajectory === "improving") {
    if (score >= 80) {
      return `Trust: ${score}. You've been building consistently. That's real momentum.`;
    }
    if (score >= 60) {
      return `Trust: ${score}. Going up. You're showing up, and it's adding up.`;
    }
    return `Trust: ${score}. You're moving upward. That trajectory matters more than the number.`;
  }

  if (trajectory === "declining") {
    if (score >= 60) {
      return `Trust: ${score}. Dipped a bit from where you were. One good session changes direction.`;
    }
    if (score >= 30) {
      return `Trust: ${score}. Slipping. You know what helps — pick one commitment and protect it.`;
    }
    return `Trust: ${score}. It's been rough. But trust can rebuild. Small wins count.`;
  }

  // Stable trajectory
  if (score >= 80) {
    return `Trust: ${score}. Holding steady. You've built something reliable here.`;
  }
  if (score >= 60) {
    return `Trust: ${score}. Stable. You're consistent — room to push further when you're ready.`;
  }
  if (score >= 40) {
    if (daysSince > 3) {
      return `Trust: ${score}. It's been a few days. One session gets things moving again.`;
    }
    return `Trust: ${score}. Building. You're developing habits, even if they don't feel solid yet.`;
  }
  if (score >= 20) {
    if (streak.completions > 0) {
      return `Trust: ${score}. You've got ${streak.completions} completion${streak.completions > 1 ? "s" : ""} going. Keep that streak alive.`;
    }
    return `Trust: ${score}. Every promise you keep counts right now. Small ones first.`;
  }

  // Very low trust
  if (streak.completions > 0) {
    return `Trust: ${score}. That last completion matters. Let's build on it.`;
  }
  if (daysSince > 5) {
    return `Trust: ${score}. It's been a while. One small commitment, kept today, starts the rebuild.`;
  }
  return `Trust: ${score}. Rebuilding. One kept promise at a time.`;
}

export function getTrustMessage(score: number, history: TrustEvent[] = []): string {
  return buildContextualMessage(score, history);
}

export function calculateConsistency(history: TrustEvent[]): number {
  if (history.length === 0) return 0;
  let completions = 0;
  for (const event of history) {
    if (event.outcome === "completed") completions++;
  }
  return completions / history.length;
}

export function getRelationshipStage(
  trustScore: number,
  daysSinceFirstUse: number,
  consistency: number
): RelationshipStage {
  if (trustScore > 85 && daysSinceFirstUse >= 90 && consistency >= 0.7) {
    return "partner";
  }
  if (trustScore >= 70 && daysSinceFirstUse >= 30 && consistency >= 0.5) {
    return "trusted";
  }
  if (trustScore >= 40 && daysSinceFirstUse >= 7) {
    return "familiar";
  }
  return "new";
}

export function getStageMessage(stage: RelationshipStage): string {
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
