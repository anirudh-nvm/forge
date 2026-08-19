import type { ForgeMomentData } from "../components/intelligence/ForgeMomentCard";
import type { TrustObservationData } from "../components/intelligence/TrustObservation";
import type { IdentityCardData } from "../components/intelligence/IdentityCard";
import type { SessionStreakData } from "../components/intelligence/SessionStreak";
import type { ReflectionPromptData } from "../components/intelligence/ReflectionPrompt";
import type { TrustScore, Session } from "../types/todayPlan";
import type { Observation } from "../observation/ObservationTypes";
import type { MemoryProfile } from "../memory/MemoryProfile";
import type { IdentityProgress } from "../identity/IdentityTypes";

export interface IntelligenceContext {
  trustScore: TrustScore;
  observations: Observation[];
  memory: MemoryProfile;
  identity: IdentityProgress;
  completedSessions: Session[];
  commitmentTitle?: string;
  now?: Date;
}

function getTrajectory(history: TrustScore["history"]): "improving" | "stable" | "declining" {
  const recent = history.slice(-5);
  if (recent.length < 2) return "stable";
  const avg = recent.reduce((s, e) => s + e.trustChange, 0) / recent.length;
  if (avg > 2) return "improving";
  if (avg < -2) return "declining";
  return "stable";
}

function getTrustLevel(score: number): string {
  if (score >= 80) return "strong";
  if (score >= 60) return "building";
  if (score >= 40) return "developing";
  if (score >= 20) return "recovering";
  return "rebuilding";
}

function buildTrustStreakMessage(history: TrustScore["history"]): string | undefined {
  const recent = history.slice(-6);
  const completions = recent.filter((e) => e.outcome === "completed").length;
  if (completions >= 4) {
    return `You've kept ${completions} of your last ${recent.length} promises.`;
  }
  return undefined;
}

export function buildTrustObservation(ctx: IntelligenceContext): TrustObservationData {
  return {
    score: ctx.trustScore.current,
    level: getTrustLevel(ctx.trustScore.current),
    trajectory: getTrajectory(ctx.trustScore.history),
    streakMessage: buildTrustStreakMessage(ctx.trustScore.history),
  };
}

export function buildIdentityCard(
  ctx: IntelligenceContext,
  commitmentTitle?: string
): IdentityCardData | null {
  const direction = ctx.identity.lifeDirectionTitle;
  if (!direction) return null;

  const goal = ctx.identity.goalProgress.find((g) => {
    const title = commitmentTitle || "";
    return (
      g.goalTitle.toLowerCase().includes(title.toLowerCase()) ||
      title.toLowerCase().includes(g.goalTitle.toLowerCase())
    );
  });

  if (goal) {
    return {
      lifeDirectionTitle: direction,
      goalTitle: goal.goalTitle,
      connectionText: `This session moves your ${goal.goalTitle} goal forward.`,
    };
  }

  return {
    lifeDirectionTitle: direction,
    connectionText: `Every commitment you keep moves you closer to ${direction}.`,
  };
}

export function buildSessionStreak(ctx: IntelligenceContext): SessionStreakData | null {
  const recent = ctx.completedSessions.slice(-10);
  if (recent.length === 0) return null;

  const completed = recent.filter((s) => s.outcome === "completed").length;

  let streak = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i].outcome === "completed") streak++;
    else break;
  }

  let message: string;
  if (streak >= 3) {
    message = `You've completed ${completed} of your last ${recent.length} sessions. ${streak} in a row.`;
  } else {
    message = `You've completed ${completed} of your last ${recent.length} sessions.`;
  }

  return {
    completedCount: completed,
    totalCount: recent.length,
    currentStreak: streak,
    message,
  };
}

function findNotableObservation(
  observations: Observation[],
  commitmentTitle?: string
): Observation | null {
  const relevant = observations.filter((o) => {
    if (o.status === "dismissed") return false;
    if (commitmentTitle && o.metadata?.commitmentTitle) {
      return o.metadata.commitmentTitle === commitmentTitle;
    }
    return o.confidence >= 0.7;
  });

  return relevant.sort((a, b) => b.confidence - a.confidence)[0] || null;
}

export function buildReflectionPrompt(ctx: IntelligenceContext): ReflectionPromptData | null {
  const obs = findNotableObservation(ctx.observations, ctx.commitmentTitle);
  if (!obs) return null;

  const categoryPrompts: Record<string, string> = {
    consistency: `${obs.text} Does that feel accurate?`,
    timing: `${obs.text} Is that how you'd describe your schedule?`,
    energy: `${obs.text} What do you think contributed to that?`,
    capacity: `${obs.text} How are you feeling about your workload?`,
    identity: `${obs.text} Does that alignment feel right to you?`,
    rhythm: `${obs.text} How are you feeling about that pattern?`,
  };

  const question = categoryPrompts[obs.category] || `${obs.text} What do you think?`;

  const parts: string[] = [];
  if (obs.metadata?.sampleSize && obs.metadata.sampleSize > 0) {
    parts.push(`Based on ${obs.metadata.sampleSize} data points`);
  }
  if (obs.metadata?.trendDirection) {
    parts.push(`trend: ${obs.metadata.trendDirection}`);
  }
  if (obs.confidence > 0.8) {
    parts.push("high confidence");
  }

  return {
    observationText: obs.text,
    question,
    context: parts.join(". ") || undefined,
  };
}

export function buildForgeMoment(
  ctx: IntelligenceContext,
  completedToday: number
): ForgeMomentData {
  const now = ctx.now || new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning." : hour < 17 ? "Good afternoon." : "Good evening.";

  const consistencyObs = ctx.observations.find(
    (o) =>
      o.category === "timing" &&
      o.confidence >= 0.7 &&
      o.metadata?.trendDirection === "up" &&
      o.metadata?.commitmentTitle
  );

  if (consistencyObs) {
    const title = consistencyObs.metadata!.commitmentTitle!;
    const sample = consistencyObs.metadata?.sampleSize || 4;
    return {
      greeting,
      observation: `I noticed something. The last ${sample} times you've planned ${title}, you've completed it.`,
      question: "Would you like me to keep protecting that time?",
    };
  }

  const stableMemory = ctx.memory.stable;
  if (stableMemory && stableMemory.rhythm) {
    const pref = stableMemory.rhythm.studyPreference;
    const obs = ctx.observations.find(
      (o) => o.category === "rhythm" && o.confidence >= 0.6
    );
    if (obs) {
      return {
        greeting,
        observation: `Here's what I see: ${pref} plans work better for you.`,
        question: "Should we try that again tomorrow?",
      };
    }
  }

  if (completedToday > 0) {
    return {
      greeting,
      observation: `You completed ${completedToday} commitment${completedToday > 1 ? "s" : ""} today.`,
      question: "That's real progress. Want to note what worked?",
    };
  }

  return {
    greeting,
    observation: "I'm here. What's on your mind?",
    question: "",
  };
}
