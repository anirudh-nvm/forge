import type { MemoryWindow, TrustSnapshot } from "./MemoryTypes";
import type { TrustScore } from "../types/todayPlan";
import { getTimeline } from "../engine/TimelineEngine";
import { StorageEngine } from "../storage/StorageEngine";

function toDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function categorizeEvents(timeline: import("../types/events").TimelineEvent[]) {
  const completedSessions: import("../types/events").TimelineEvent[] = [];
  const missedSessions: import("../types/events").TimelineEvent[] = [];
  const adjustments: import("../types/events").TimelineEvent[] = [];

  for (const event of timeline) {
    switch (event.type) {
      case "completed":
        completedSessions.push(event);
        break;
      case "skipped":
        missedSessions.push(event);
        break;
      case "movedEarlier":
      case "movedLater":
      case "deleted":
      case "added":
      case "durationUpdated":
      case "locked":
      case "unlocked":
        adjustments.push(event);
        break;
    }
  }

  return { completedSessions, missedSessions, adjustments };
}

function buildTrustSnapshots(trustScore: TrustScore, startDate: Date, endDate: Date): TrustSnapshot[] {
  const snapshots: TrustSnapshot[] = [];
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  for (const event of trustScore.history) {
    const eventMs = event.timestamp instanceof Date
      ? event.timestamp.getTime()
      : new Date(event.timestamp).getTime();

    if (eventMs >= startMs && eventMs <= endMs) {
      snapshots.push({
        date: toDateStr(new Date(eventMs)),
        score: trustScore.current,
      });
    }
  }

  return snapshots;
}

export async function getLastNDays(days: number): Promise<MemoryWindow> {
  const now = new Date();
  const endDate = endOfDay(now);
  const startDate = startOfDay(new Date(now));
  startDate.setDate(startDate.getDate() - (days - 1));

  const timeline = getTimeline();
  const filtered = timeline.filter((event) => {
    const eventDate = new Date(event.timestamp);
    return eventDate >= startDate && eventDate <= endDate;
  });

  const { completedSessions, missedSessions, adjustments } = categorizeEvents(filtered);

  const trustScore = await StorageEngine.loadTrustScore();
  const trustHistory = trustScore
    ? buildTrustSnapshots(trustScore, startDate, endDate)
    : [];

  return {
    startDate: toDateStr(startDate),
    endDate: toDateStr(endDate),
    daysCovered: days,
    timeline: filtered,
    trustHistory,
    completedSessions,
    missedSessions,
    adjustments,
    stats: {
      totalSessions: completedSessions.length + missedSessions.length,
      completedCount: completedSessions.length,
      missedCount: missedSessions.length,
      adjustmentCount: adjustments.length,
    },
  };
}
