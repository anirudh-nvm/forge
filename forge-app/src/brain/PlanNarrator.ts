import type { TodayPlan } from "../types/todayPlan";
import type { Commitment } from "../types/commitment";
import type { EnergyState, RelationshipStage } from "../types/companion";

export type NarrationResult = {
  headline: string;
};

export type NarrationContext = {
  energy?: EnergyState;
  stage?: RelationshipStage;
  yesterdayContext?: string;
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function narratePlan(
  plan: TodayPlan,
  context: NarrationContext = {}
): NarrationResult {
  const commitments = plan.commitments.filter(
    (c) => !c.locked || !isFixed(c)
  );

  if (commitments.length === 0) {
    return { headline: "today looks open." };
  }

  const mostInteresting = pickMostInteresting(plan);

  if (!mostInteresting) {
    return { headline: "here's what i'm thinking." };
  }

  const headline = buildHeadline(mostInteresting, plan, context);

  return { headline };
}

function isFixed(commitment: Commitment): boolean {
  return !!(commitment.placementReasons?.includes("after_fixed_event"));
}

function pickMostInteresting(plan: TodayPlan): Commitment | null {
  const unlocked = plan.commitments.filter((c) => !c.locked);
  if (unlocked.length === 0) return null;

  const withReasons = unlocked.filter(
    (c) => c.placementReasons && c.placementReasons.length > 0
  );

  if (withReasons.length > 0) {
    return withReasons.reduce((best, c) => {
      const bestScore = scorePlacementReasons(best.placementReasons || []);
      const cScore = scorePlacementReasons(c.placementReasons || []);
      return cScore > bestScore ? c : best;
    });
  }

  return unlocked[0];
}

function scorePlacementReasons(reasons: string[]): number {
  let score = 0;
  for (const r of reasons) {
    if (r === "after_recovery") score += 3;
    if (r === "preferred_time_window") score += 2;
    if (r === "after_fixed_event") score += 2;
    if (r === "near_related") score += 1;
    if (r === "before_dinner") score += 1;
    if (r === "late_afternoon") score += 1;
  }
  return score;
}

function buildHeadline(
  commitment: Commitment,
  plan: TodayPlan,
  context: NarrationContext
): string {
  const { placementReasons = [] } = commitment;
  const title = commitment.title.toLowerCase();

  if (placementReasons.includes("after_fixed_event")) {
    const afterFixed = pickRandom([
      `${commitment.title} stays right after your fixed event.`,
      `i kept ${commitment.title} where it is — it flows naturally from what comes before.`,
      `${commitment.title} fits right after. no reason to move it.`,
    ]);
    return afterFixed;
  }

  if (placementReasons.includes("after_recovery")) {
    const afterRecovery = pickRandom([
      `i gave you a break before ${commitment.title} — you don't need to run on empty.`,
      `${commitment.title} comes after a recovery. pacing matters.`,
      `i moved ${commitment.title} after a break so you can show up fresh.`,
    ]);
    return afterRecovery;
  }

  if (placementReasons.includes("preferred_time_window")) {
    const preferred = pickRandom([
      `${commitment.title} is in your preferred window.`,
      `i put ${commitment.title} where you usually focus best.`,
      `${commitment.title} lands in the afternoon — your sweet spot.`,
    ]);
    return preferred;
  }

  if (placementReasons.includes("before_dinner")) {
    const beforeDinner = pickRandom([
      `${commitment.title} fits nicely before dinner.`,
      `i kept ${commitment.title} before dinner so the evening stays open.`,
      `${commitment.title} is before dinner — you asked for that.`,
    ]);
    return beforeDinner;
  }

  if (placementReasons.includes("near_related")) {
    const nearRelated = pickRandom([
      `i put ${commitment.title} close to similar work.`,
      `${commitment.title} is near related tasks — context stays fresh.`,
      `keeping ${commitment.title} next to similar work helps you stay in flow.`,
    ]);
    return nearRelated;
  }

  if (placementReasons.includes("late_afternoon")) {
    const lateAfternoon = pickRandom([
      `${commitment.title} moved to late afternoon.`,
      `i shifted ${commitment.title} to the later afternoon.`,
      `${commitment.title} sits in the late afternoon as you asked.`,
    ]);
    return lateAfternoon;
  }

  if (placementReasons.includes("morning_preference")) {
    const morning = pickRandom([
      `${commitment.title} is in the morning where you do best.`,
      `i put ${commitment.title} in the morning — that's when you're sharpest.`,
      `${commitment.title} starts your day. morning energy is your edge.`,
    ]);
    return morning;
  }

  if (placementReasons.includes("evening_preference")) {
    const evening = pickRandom([
      `${commitment.title} is in the evening.`,
      `i put ${commitment.title} in the evening.`,
      `${commitment.title} wraps up your day.`,
    ]);
    return evening;
  }

  if (placementReasons.includes("first_thing")) {
    const firstThing = pickRandom([
      `${commitment.title} is first thing — before anything else fills the morning.`,
      `i put ${commitment.title} at the start of your day.`,
      `${commitment.title} opens your morning.`,
    ]);
    return firstThing;
  }

  if (placementReasons.includes("before_bedtime")) {
    const beforeBed = pickRandom([
      `${commitment.title} is before bedtime.`,
      `i kept ${commitment.title} before you wind down.`,
      `${commitment.title} wraps up before sleep.`,
    ]);
    return beforeBed;
  }

  // Fallback — more conversational than before
  return pickRandom([
    `${commitment.title} fits where it should.`,
    `i placed ${commitment.title} where it makes sense.`,
    `${commitment.title} is set.`,
  ]);
}

export function narrateWithAI(
  plan: TodayPlan,
  context: NarrationContext = {},
  aiPolish?: (headline: string, context: NarrationContext) => Promise<string>
): Promise<NarrationResult> {
  const base = narratePlan(plan, context);

  if (!aiPolish) {
    return Promise.resolve(base);
  }

  return aiPolish(base.headline, context).then((polished) => ({
    headline: polished || base.headline,
  }));
}
