import { describe, it, expect, beforeEach, vi } from "vitest";
import { getLastNDays } from "../src/memory/MemoryWindow";
import type { TimelineEvent } from "../src/types/events";
import type { TrustScore } from "../src/types/todayPlan";

let mockTimeline: TimelineEvent[] = [];
let mockTrustScore: TrustScore | null = null;

vi.mock("../src/engine/TimelineEngine", () => ({
  getTimeline: () => mockTimeline,
}));

vi.mock("../src/storage/StorageEngine", () => ({
  StorageEngine: {
    loadTrustScore: async () => mockTrustScore,
  },
}));

function makeEvent(overrides: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: `tl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
    type: "planCreated",
    title: "Event",
    ...overrides,
  };
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}

describe("MemoryWindow", () => {
  beforeEach(() => {
    mockTimeline = [];
    mockTrustScore = null;
  });

  it("returns empty arrays for empty timeline", async () => {
    const result = await getLastNDays(7);
    expect(result.timeline).toHaveLength(0);
    expect(result.completedSessions).toHaveLength(0);
    expect(result.missedSessions).toHaveLength(0);
    expect(result.adjustments).toHaveLength(0);
  });

  it("returns correct daysCovered", async () => {
    const result = await getLastNDays(7);
    expect(result.daysCovered).toBe(7);
  });

  it("excludes events older than N days", async () => {
    mockTimeline = [
      makeEvent({ timestamp: daysAgo(3), title: "Recent" }),
      makeEvent({ timestamp: daysAgo(10), title: "Old" }),
    ];
    const result = await getLastNDays(7);
    expect(result.timeline).toHaveLength(1);
    expect(result.timeline[0].title).toBe("Recent");
  });

  it("includes completed sessions in completedSessions", async () => {
    mockTimeline = [
      makeEvent({ type: "completed", title: "Gym", timestamp: daysAgo(2) }),
      makeEvent({ type: "skipped", title: "DSA", timestamp: daysAgo(1) }),
    ];
    const result = await getLastNDays(7);
    expect(result.completedSessions).toHaveLength(1);
    expect(result.completedSessions[0].title).toBe("Gym");
    expect(result.missedSessions).toHaveLength(1);
  });

  it("includes missed sessions in missedSessions", async () => {
    mockTimeline = [
      makeEvent({ type: "skipped", title: "Gym", timestamp: daysAgo(1) }),
    ];
    const result = await getLastNDays(7);
    expect(result.missedSessions).toHaveLength(1);
    expect(result.missedSessions[0].title).toBe("Gym");
  });

  it("includes adjustment events in adjustments", async () => {
    mockTimeline = [
      makeEvent({ type: "movedEarlier", title: "Gym", timestamp: daysAgo(2) }),
      makeEvent({ type: "deleted", title: "DSA", timestamp: daysAgo(1) }),
      makeEvent({ type: "locked", title: "College", timestamp: daysAgo(3) }),
    ];
    const result = await getLastNDays(7);
    expect(result.adjustments).toHaveLength(3);
  });

  it("returns trust history sorted chronologically", async () => {
    mockTrustScore = {
      current: 61,
      history: [
        { timestamp: daysAgo(2), change: 3, reason: "completed gym" },
        { timestamp: daysAgo(1), change: 2, reason: "completed dsa" },
      ],
    };
    const result = await getLastNDays(7);
    expect(result.trustHistory).toHaveLength(2);
    expect(result.trustHistory[0].date <= result.trustHistory[1].date).toBe(true);
  });

  it("returns correct stats", async () => {
    mockTimeline = [
      makeEvent({ type: "completed", title: "Gym", timestamp: daysAgo(2) }),
      makeEvent({ type: "completed", title: "DSA", timestamp: daysAgo(1) }),
      makeEvent({ type: "skipped", title: "Yoga", timestamp: daysAgo(3) }),
      makeEvent({ type: "movedLater", title: "Gym", timestamp: daysAgo(2) }),
    ];
    const result = await getLastNDays(7);
    expect(result.stats.totalSessions).toBe(3);
    expect(result.stats.completedCount).toBe(2);
    expect(result.stats.missedCount).toBe(1);
    expect(result.stats.adjustmentCount).toBe(1);
  });

  it("does not mutate the original timeline", async () => {
    const original = [
      makeEvent({ type: "completed", title: "Gym", timestamp: daysAgo(2) }),
    ];
    mockTimeline = original;
    await getLastNDays(7);
    expect(mockTimeline).toHaveLength(1);
    expect(mockTimeline[0].title).toBe("Gym");
  });

  it("sets correct startDate and endDate", async () => {
    const result = await getLastNDays(7);
    const now = new Date();
    const toLocalDateStr = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    expect(result.endDate).toBe(toLocalDateStr(now));
    const start = new Date(result.startDate);
    const end = new Date(result.endDate);
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(6);
  });
});
