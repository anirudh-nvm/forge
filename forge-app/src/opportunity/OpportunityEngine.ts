import type {
  Opportunity,
  OpportunityContext,
  OpportunityType,
} from "./OpportunityTypes";
import type { Observation } from "../observation/ObservationTypes";

function daysBetween(a: Date, b: Date): number {
  const diff = Math.abs(a.getTime() - b.getTime());
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function daysUntil(target: Date, now: Date): number {
  const diff = target.getTime() - now.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function findDeadlines(ctx: OpportunityContext): Opportunity[] {
  const opps: Opportunity[] = [];
  const now = ctx.now;

  for (const commitment of ctx.todayPlan.commitments) {
    if (commitment.completed) continue;
    const end = new Date(commitment.endTime);
    const days = daysUntil(end, now);
    if (days <= 14 && days > 0) {
      const identityLink = buildIdentityLink(ctx, commitment.title);
      opps.push({
        id: `opp-deadline-${commitment.id}`,
        type: "prepare",
        headline: `${commitment.title} is in ${days} day${days !== 1 ? "s" : ""}.`,
        question: `Would you like me to protect time for ${commitment.title} preparation?`,
        identityLink,
        priority: days <= 3 ? 3 : days <= 7 ? 2 : 1,
        source: "deadline",
        createdAt: now.toISOString(),
      });
    }
  }

  return opps;
}

function findConsistencyPatterns(ctx: OpportunityContext): Opportunity[] {
  const opps: Opportunity[] = [];
  const now = ctx.now;

  const timingObs = ctx.observations.filter(
    (o) => o.category === "timing" && o.confidence >= 0.6
  );

  for (const obs of timingObs) {
    if (obs.metadata?.commitmentTitle && obs.metadata?.trendDirection === "up") {
      const commitmentTitle = obs.metadata.commitmentTitle;
      const daysSince = daysBetween(now, new Date(obs.lastSeen));
      if (daysSince <= 2) {
        const identityLink = buildIdentityLink(ctx, commitmentTitle);
        opps.push({
          id: `opp-consistency-${obs.id}`,
          type: "protect_time",
          headline: `You've been consistent with ${commitmentTitle}.`,
          question: `Would you like me to keep protecting that time?`,
          identityLink,
          priority: 2,
          source: "consistency_pattern",
          createdAt: now.toISOString(),
        });
      }
    }
  }

  return opps;
}

function findActiveExperiments(ctx: OpportunityContext): Opportunity[] {
  const opps: Opportunity[] = [];
  const now = ctx.now;

  const activeObs = ctx.observations.filter(
    (o) => o.category === "consistency" && o.confidence >= 0.7 && o.status === "confirmed"
  );

  for (const obs of activeObs) {
    if (obs.text.includes("experiment") || obs.text.includes("trying")) {
      const identityLink = buildIdentityLink(ctx, obs.text);
      opps.push({
        id: `opp-experiment-${obs.id}`,
        type: "continue_experiment",
        headline: obs.text,
        question: `Should we continue this experiment?`,
        identityLink,
        priority: 1,
        source: "active_experiment",
        createdAt: now.toISOString(),
      });
    }
  }

  return opps;
}

function findRecoveryOpportunities(ctx: OpportunityContext): Opportunity[] {
  const opps: Opportunity[] = [];
  const now = ctx.now;

  const recentObs = ctx.observations.filter(
    (o) => o.status === "new" && o.confidence >= 0.5
  );

  for (const obs of recentObs) {
    if (obs.metadata?.trendDirection === "down") {
      const commitmentTitle = obs.metadata?.commitmentTitle || "your commitment";
      const identityLink = buildIdentityLink(ctx, commitmentTitle);
      opps.push({
        id: `opp-recover-${obs.id}`,
        type: "recover",
        headline: `${commitmentTitle} has been slipping.`,
        question: `Would a small experiment help recover momentum?`,
        identityLink,
        priority: 2,
        source: "declining_trend",
        createdAt: now.toISOString(),
      });
    }
  }

  return opps;
}

function findMemoryChanges(ctx: OpportunityContext): Opportunity[] {
  const opps: Opportunity[] = [];
  const now = ctx.now;

  const rhythmObs = ctx.observations.filter(
    (o) => o.category === "rhythm" && o.confidence >= 0.7
  );

  for (const obs of rhythmObs) {
    if (obs.metadata?.patternType === "new_pattern") {
      const identityLink = buildIdentityLink(ctx, obs.text);
      opps.push({
        id: `opp-memory-${obs.id}`,
        type: "remember_change",
        headline: obs.text,
        question: `Should I remember this pattern?`,
        identityLink,
        priority: 1,
        source: "rhythm_observation",
        createdAt: now.toISOString(),
      });
    }
  }

  return opps;
}

function findReflectionMoments(ctx: OpportunityContext): Opportunity[] {
  const opps: Opportunity[] = [];
  const now = ctx.now;

  const highConfidenceObs = ctx.observations.filter(
    (o) => o.confidence >= 0.8 && o.status === "new"
  );

  if (highConfidenceObs.length >= 3) {
    const count = highConfidenceObs.length;
    const identityLink = ctx.identity.lifeDirectionTitle || "your growth";
    opps.push({
      id: `opp-reflect-${now.getTime()}`,
      type: "reflect",
      headline: `I've noticed ${count} patterns this week.`,
      question: `Would you like to reflect on what's emerging?`,
      identityLink,
      priority: 1,
      source: "observation_cluster",
      createdAt: now.toISOString(),
    });
  }

  return opps;
}

function findCelebrations(ctx: OpportunityContext): Opportunity[] {
  const opps: Opportunity[] = [];
  const now = ctx.now;

  const completed = ctx.todayPlan.commitments.filter((c) => c.completed);
  if (completed.length >= 3) {
    const identityLink = buildIdentityLink(ctx, "your consistency");
    opps.push({
      id: `opp-celebrate-${now.getTime()}`,
      type: "celebrate",
      headline: `You completed ${completed.length} commitments today.`,
      question: `That's real progress. Want to note what worked?`,
      identityLink,
      priority: 0,
      source: "daily_completion",
      createdAt: now.toISOString(),
    });
  }

  return opps;
}

function buildIdentityLink(ctx: OpportunityContext, taskTitle: string): string {
  const direction = ctx.identity.lifeDirectionTitle;
  if (!direction) return "moves you forward";

  const goals = ctx.identity.goalProgress;
  for (const goal of goals) {
    if (
      taskTitle.toLowerCase().includes(goal.goalTitle.toLowerCase()) ||
      goal.goalTitle.toLowerCase().includes(taskTitle.toLowerCase())
    ) {
      return `moves you closer to ${goal.goalTitle}`;
    }
  }

  return `supports your journey toward ${direction}`;
}

export function findOpportunities(ctx: OpportunityContext): Opportunity[] {
  const all = [
    ...findDeadlines(ctx),
    ...findConsistencyPatterns(ctx),
    ...findActiveExperiments(ctx),
    ...findRecoveryOpportunities(ctx),
    ...findMemoryChanges(ctx),
    ...findReflectionMoments(ctx),
    ...findCelebrations(ctx),
  ];

  return all.sort((a, b) => b.priority - a.priority);
}
