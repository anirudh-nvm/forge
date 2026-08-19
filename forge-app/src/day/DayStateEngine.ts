import type { TodayPlan } from "../types/todayPlan";
import type { TimelineItem } from "../types/timeline";
import type { DayState, DayPhase, CommitmentRef, RecoveryRef } from "./DayStateTypes";
import { parseTimeToDecimal } from "../utils/timeUtils";

function parseTime(time: string): number {
  return parseTimeToDecimal(time);
}

function formatTime(decimal: number): string {
  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);
  const period = hours >= 12 ? "PM" : "AM";
  const h = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return minutes === 0 ? `${h}:00 ${period}` : `${h}:${String(minutes).padStart(2, "0")} ${period}`;
}

function timeToMinutes(time: string): number {
  const match = time.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2] || "0", 10);
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export { timeToMinutes };

function nowMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function isInRange(now: number, start: number, end: number): boolean {
  return now >= start && now < end;
}

function getCommitmentsFromTimeline(timeline: TimelineItem[]): CommitmentRef[] {
  return timeline
    .filter((item): item is TimelineItem & { kind: "commitment" } => item.kind === "commitment")
    .map((item) => ({
      id: item.id,
      title: item.title,
      startTime: item.startTime,
      endTime: item.endTime,
      locked: item.locked,
    }))
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

function getRecoveryFromTimeline(timeline: TimelineItem[]): RecoveryRef[] {
  return timeline
    .filter((item): item is TimelineItem & { kind: "recovery" } => item.kind === "recovery")
    .map((item) => ({
      id: item.id,
      reason: item.recoveryReason as RecoveryRef["reason"],
      endsAt: item.endTime,
      minutesRemaining: timeToMinutes(item.endTime) - timeToMinutes(item.startTime),
    }));
}

export function getCurrentDayState(plan: TodayPlan | null, now: Date): DayState {
  if (!plan) {
    return { phase: "day_complete" };
  }

  const nowMins = nowMinutes(now);
  const commitments = getCommitmentsFromTimeline(plan.timeline);
  const recoveries = getRecoveryFromTimeline(plan.timeline);

  if (commitments.length === 0) {
    return { phase: "day_complete" };
  }

  const firstCommitment = commitments[0];
  const firstStart = timeToMinutes(firstCommitment.startTime);

  if (nowMins < firstStart) {
    const timeUntilNext = firstStart - nowMins;
    return {
      phase: "before_day",
      nextCommitment: firstCommitment,
      timeUntilNext,
    };
  }

  for (let i = 0; i < commitments.length; i++) {
    const current = commitments[i];
    const currentStart = timeToMinutes(current.startTime);
    const currentEnd = timeToMinutes(current.endTime);

    if (isInRange(nowMins, currentStart, currentEnd)) {
      const nextCommitment = commitments[i + 1];
      const timeUntilNext = nextCommitment ? timeToMinutes(nextCommitment.startTime) - nowMins : undefined;
      return {
        phase: "active_commitment",
        currentCommitment: current,
        nextCommitment,
        timeUntilNext,
      };
    }

    if (nowMins < currentStart) {
      const recovery = recoveries.find((r) => {
        const rEnd = timeToMinutes(r.endsAt);
        const rStart = rEnd - r.minutesRemaining;
        return isInRange(nowMins, rStart, rEnd);
      });

      if (recovery) {
        const recoveryEnd = timeToMinutes(recovery.endsAt);
        const minutesRemaining = recoveryEnd - nowMins;
        return {
          phase: "recovery",
          nextCommitment: current,
          timeUntilNext: currentStart - nowMins,
          recovery: { ...recovery, minutesRemaining },
        };
      }

      const timeUntilNext = currentStart - nowMins;
      return {
        phase: "before_commitment",
        nextCommitment: current,
        timeUntilNext,
      };
    }
  }

  const lastCommitment = commitments[commitments.length - 1];
  const lastEnd = timeToMinutes(lastCommitment.endTime);

  if (nowMins >= lastEnd) {
    const recovery = recoveries.find((r) => {
      const rEnd = timeToMinutes(r.endsAt);
      const rStart = rEnd - r.minutesRemaining;
      return isInRange(nowMins, rStart, rEnd);
    });

    if (recovery) {
      const recoveryEnd = timeToMinutes(recovery.endsAt);
      const minutesRemaining = recoveryEnd - nowMins;
      return {
        phase: "recovery",
        timeUntilNext: undefined,
        recovery: { ...recovery, minutesRemaining },
      };
    }

    return { phase: "day_complete" };
  }

  return { phase: "between_commitments" };
}