import type { Commitment } from "../types/commitment";
import type { TrustScore } from "../types/todayPlan";
import type { Observation } from "../observation/ObservationTypes";
import type { Experiment } from "./ExperimentTypes";
import type { MemoryProfile } from "./MemoryProfile";

export interface SecondBrainNotice {
  id: string;
  type: "deadline" | "neglect" | "trust" | "experiment" | "pattern" | "strength";
  text: string;
  question?: string;
  priority: "low" | "medium" | "high";
  createdAt: string;
}

export interface SecondBrainContext {
  today: Date;
  commitments: Commitment[];
  observations: Observation[];
  experiments: Experiment[];
  memory: MemoryProfile;
  trust: TrustScore;
  upcomingDeadlines?: { title: string; date: Date }[];
}

function daysBetween(a: Date, b: Date): number {
  const diff = Math.abs(b.getTime() - a.getTime());
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function findUpcomingDeadlines(
  deadlines: { title: string; date: Date }[],
  today: Date
): { title: string; daysUntil: number }[] {
  return deadlines
    .map((d) => ({
      title: d.title,
      daysUntil: daysBetween(today, d.date),
    }))
    .filter((d) => d.daysUntil > 0 && d.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

function findNeglectedCommitments(
  commitments: Commitment[],
  observations: Observation[],
  today: Date
): { title: string; daysSinceLast: string }[] {
  const neglected: { title: string; daysSinceLast: string }[] = [];

  for (const commitment of commitments) {
    const relevantObs = observations.filter(
      (obs) =>
        obs.metadata?.commitmentTitle === commitment.title ||
        obs.text.toLowerCase().includes(commitment.title.toLowerCase())
    );

    if (relevantObs.length === 0) continue;

    const newest = relevantObs.reduce((latest, obs) =>
      new Date(obs.lastSeen) > new Date(latest.lastSeen) ? obs : latest
    );

    const daysSince = daysBetween(today, new Date(newest.lastSeen));
    if (daysSince >= 4) {
      neglected.push({
        title: commitment.title,
        daysSinceLast: `${daysSince} days`,
      });
    }
  }

  return neglected;
}

function assessTrustTrajectory(
  trust: TrustScore
): { direction: string; message: string } {
  const history = trust.history;
  if (history.length < 2) {
    return { direction: "stable", message: "Trust is being tracked." };
  }

  const recent = history.slice(-5);
  const avgChange = recent.reduce((sum, e) => sum + e.trustChange, 0) / recent.length;

  if (avgChange > 2) {
    return {
      direction: "improving",
      message: `Trust is trending up (+${Math.round(avgChange)} per session). Your consistency is building something.`,
    };
  }
  if (avgChange < -2) {
    return {
      direction: "declining",
      message: `Trust has been dipping. One good session can turn it around.`,
    };
  }
  return {
    direction: "stable",
    message: `Trust is holding at ${trust.current}. Steady, with room to grow.`,
  };
}

function checkExperiments(
  experiments: Experiment[],
  today: Date
): { title: string; status: string; insight: string }[] {
  return experiments
    .filter((e) => e.status === "active" || e.status === "completed")
    .map((e) => {
      const endDate = new Date(e.endDate);
      const daysLeft = daysBetween(today, endDate);
      return {
        title: e.title,
        status: e.status,
        insight:
          e.status === "active" && daysLeft <= 3
            ? `"${e.title}" is wrapping up in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}. Almost time to review.`
            : e.status === "completed"
              ? `"${e.title}" is done — ${e.outcome || "outcome pending"}.`
              : `"${e.title}" is running.`,
      };
    });
}

function findStrengths(
  observations: Observation[],
  memory: MemoryProfile
): string[] {
  const strengths: string[] = [];

  const highConfidence = observations.filter((o) => o.confidence >= 0.7 && o.status === "confirmed");
  const consistencyObs = highConfidence.filter((o) => o.category === "consistency");
  if (consistencyObs.length >= 2) {
    strengths.push("You've confirmed consistency patterns — you know what works.");
  }

  if (memory.stable.values.length > 0) {
    strengths.push(`Your values: ${memory.stable.values.join(", ")}.`);
  }

  if (memory.working.activeFocus.length >= 3) {
    strengths.push(
      `You're managing ${memory.working.activeFocus.length} active focus areas.`
    );
  }

  return strengths;
}

function generateNotices(ctx: SecondBrainContext): SecondBrainNotice[] {
  const notices: SecondBrainNotice[] = [];
  const now = ctx.today.toISOString();

  // 1. Upcoming deadlines
  if (ctx.upcomingDeadlines) {
    const upcoming = findUpcomingDeadlines(ctx.upcomingDeadlines, ctx.today);
    for (const deadline of upcoming.slice(0, 3)) {
      const priority = deadline.daysUntil <= 7 ? "high" : deadline.daysUntil <= 14 ? "medium" : "low";
      const question =
        deadline.daysUntil <= 7
          ? `Would you like me to protect time for ${deadline.title} preparation this week?`
          : `Want me to start weaving ${deadline.title} prep into your schedule?`;

      notices.push({
        id: `deadline-${deadline.title.replace(/\s/g, "-").toLowerCase()}`,
        type: "deadline",
        text: `${deadline.title} is in ${deadline.daysUntil} day${deadline.daysUntil !== 1 ? "s" : ""}.`,
        question,
        priority,
        createdAt: now,
      });
    }
  }

  // 2. Neglected commitments
  const neglected = findNeglectedCommitments(ctx.commitments, ctx.observations, ctx.today);
  for (const neg of neglected.slice(0, 2)) {
    notices.push({
      id: `neglect-${neg.title.replace(/\s/g, "-").toLowerCase()}`,
      type: "neglect",
      text: `You haven't touched ${neg.title} in ${neg.daysSinceLast}.`,
      question: `Would you like me to schedule a short session for ${neg.title} this week?`,
      priority: "medium",
      createdAt: now,
    });
  }

  // 3. Trust trajectory
  const trustInfo = assessTrustTrajectory(ctx.trust);
  if (trustInfo.direction === "declining" || trustInfo.direction === "improving") {
    notices.push({
      id: "trust-trajectory",
      type: "trust",
      text: trustInfo.message,
      question:
        trustInfo.direction === "declining"
          ? "Want me to suggest one small commitment to rebuild momentum?"
          : undefined,
      priority: trustInfo.direction === "declining" ? "medium" : "low",
      createdAt: now,
    });
  }

  // 4. Active experiments
  const experimentStatuses = checkExperiments(ctx.experiments, ctx.today);
  for (const exp of experimentStatuses) {
    if (exp.status === "active") {
      notices.push({
        id: `experiment-${exp.title.replace(/\s/g, "-").toLowerCase()}`,
        type: "experiment",
        text: exp.insight,
        priority: "low",
        createdAt: now,
      });
    }
  }

  // 5. Strengths
  const strengths = findStrengths(ctx.observations, ctx.memory);
  for (const strength of strengths.slice(0, 1)) {
    notices.push({
      id: "strength",
      type: "strength",
      text: strength,
      priority: "low",
      createdAt: now,
    });
  }

  return notices.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

export function secondBrainScan(ctx: SecondBrainContext): SecondBrainNotice[] {
  return generateNotices(ctx);
}
