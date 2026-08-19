import { describe, it, expect } from "vitest";
import { extractPatterns } from "../src/memory/PatternExtractor";
import type { MemoryWindow, TrustSnapshot } from "../src/memory/MemoryTypes";
import type { TimelineEvent } from "../src/types/events";

function makeEvent(overrides: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: `tl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
    type: "planCreated",
    title: "Event",
    ...overrides,
  };
}

function makeMemory(overrides: Partial<MemoryWindow>): MemoryWindow {
  return {
    startDate: "2026-08-01",
    endDate: "2026-08-07",
    daysCovered: 7,
    timeline: [],
    trustHistory: [],
    completedSessions: [],
    missedSessions: [],
    adjustments: [],
    stats: { totalSessions: 0, completedCount: 0, missedCount: 0, adjustmentCount: 0 },
    ...overrides,
  };
}

function daysAgo(n: number, hour = 12): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

describe("PatternExtractor", () => {
  it("returns empty patterns for empty memory", () => {
    const memory = makeMemory({});
    const report = extractPatterns(memory);
    expect(report.patterns).toHaveLength(0);
  });

  it("returns PatternReport with generatedAt and windowDays", () => {
    const memory = makeMemory({ daysCovered: 14 });
    const report = extractPatterns(memory);
    expect(report.generatedAt).toBeTruthy();
    expect(report.windowDays).toBe(14);
  });

  it("calculates completion rate correctly", () => {
    const memory = makeMemory({
      completedSessions: [
        makeEvent({ type: "completed", title: "Gym", timestamp: daysAgo(1) }),
        makeEvent({ type: "completed", title: "Gym", timestamp: daysAgo(3) }),
        makeEvent({ type: "completed", title: "Gym", timestamp: daysAgo(5) }),
      ],
      missedSessions: [
        makeEvent({ type: "skipped", title: "Gym", timestamp: daysAgo(2) }),
        makeEvent({ type: "skipped", title: "Gym", timestamp: daysAgo(4) }),
      ],
      stats: { totalSessions: 5, completedCount: 3, missedCount: 2, adjustmentCount: 0 },
    });
    const report = extractPatterns(memory);
    const gymPattern = report.patterns.find(
      (p) => p.type === "completion_rate" && "commitment" in p && p.commitment === "Gym"
    );
    expect(gymPattern).toBeDefined();
    if (gymPattern && "rate" in gymPattern) {
      expect(gymPattern.rate).toBe(0.6);
      expect(gymPattern.completed).toBe(3);
      expect(gymPattern.total).toBe(5);
    }
  });

  it("calculates time preference correctly", () => {
    const memory = makeMemory({
      completedSessions: [
        makeEvent({ type: "completed", title: "Gym", timestamp: daysAgo(1, 8) }),
        makeEvent({ type: "completed", title: "Gym", timestamp: daysAgo(2, 9) }),
        makeEvent({ type: "completed", title: "Gym", timestamp: daysAgo(3, 10) }),
        makeEvent({ type: "completed", title: "DSA", timestamp: daysAgo(4, 14) }),
        makeEvent({ type: "completed", title: "DSA", timestamp: daysAgo(5, 15) }),
      ],
      stats: { totalSessions: 5, completedCount: 5, missedCount: 0, adjustmentCount: 0 },
    });
    const report = extractPatterns(memory);
    const timePattern = report.patterns.find((p) => p.type === "time_preference");
    expect(timePattern).toBeDefined();
    if (timePattern && "preferred" in timePattern) {
      expect(timePattern.preferred).toBe("morning");
    }
  });

  it("calculates adjustment frequency correctly", () => {
    const memory = makeMemory({
      adjustments: [
        makeEvent({ type: "movedEarlier", title: "Gym", timestamp: daysAgo(1) }),
        makeEvent({ type: "movedLater", title: "DSA", timestamp: daysAgo(2) }),
      ],
      stats: { totalSessions: 10, completedCount: 8, missedCount: 2, adjustmentCount: 2 },
    });
    const report = extractPatterns(memory);
    const adjPattern = report.patterns.find((p) => p.type === "adjustment_frequency");
    expect(adjPattern).toBeDefined();
    if (adjPattern && "ratio" in adjPattern) {
      expect(adjPattern.ratio).toBe(0.2);
      expect(adjPattern.adjustments).toBe(2);
    }
  });

  it("detects trust trend up", () => {
    const memory = makeMemory({
      trustHistory: [
        { date: "2026-08-01", score: 55 },
        { date: "2026-08-02", score: 58 },
        { date: "2026-08-03", score: 60 },
        { date: "2026-08-04", score: 63 },
        { date: "2026-08-05", score: 67 },
      ],
    });
    const report = extractPatterns(memory);
    const trendPattern = report.patterns.find((p) => p.type === "trust_trend");
    expect(trendPattern).toBeDefined();
    if (trendPattern && "direction" in trendPattern) {
      expect(trendPattern.direction).toBe("up");
    }
  });

  it("detects trust trend down", () => {
    const memory = makeMemory({
      trustHistory: [
        { date: "2026-08-01", score: 70 },
        { date: "2026-08-02", score: 66 },
        { date: "2026-08-03", score: 62 },
        { date: "2026-08-04", score: 58 },
        { date: "2026-08-05", score: 54 },
      ],
    });
    const report = extractPatterns(memory);
    const trendPattern = report.patterns.find((p) => p.type === "trust_trend");
    expect(trendPattern).toBeDefined();
    if (trendPattern && "direction" in trendPattern) {
      expect(trendPattern.direction).toBe("down");
    }
  });

  it("detects trust trend stable", () => {
    const memory = makeMemory({
      trustHistory: [
        { date: "2026-08-01", score: 60 },
        { date: "2026-08-02", score: 61 },
        { date: "2026-08-03", score: 60 },
        { date: "2026-08-04", score: 61 },
        { date: "2026-08-05", score: 60 },
      ],
    });
    const report = extractPatterns(memory);
    const trendPattern = report.patterns.find((p) => p.type === "trust_trend");
    expect(trendPattern).toBeDefined();
    if (trendPattern && "direction" in trendPattern) {
      expect(trendPattern.direction).toBe("stable");
    }
  });

  it("scales confidence with sample size", () => {
    const smallMemory = makeMemory({
      completedSessions: [
        makeEvent({ type: "completed", title: "Gym", timestamp: daysAgo(1) }),
      ],
      stats: { totalSessions: 1, completedCount: 1, missedCount: 0, adjustmentCount: 0 },
    });
    const largeMemory = makeMemory({
      completedSessions: Array.from({ length: 20 }, (_, i) =>
        makeEvent({ type: "completed", title: "Gym", timestamp: daysAgo(i) })
      ),
      stats: { totalSessions: 20, completedCount: 20, missedCount: 0, adjustmentCount: 0 },
    });

    const smallReport = extractPatterns(smallMemory);
    const largeReport = extractPatterns(largeMemory);

    const smallPattern = smallReport.patterns.find((p) => p.type === "completion_rate");
    const largePattern = largeReport.patterns.find((p) => p.type === "completion_rate");

    expect(smallPattern).toBeDefined();
    expect(largePattern).toBeDefined();
    if (smallPattern && largePattern) {
      expect(largePattern.confidence).toBeGreaterThan(smallPattern.confidence);
    }
  });

  it("handles multiple commitment types", () => {
    const memory = makeMemory({
      completedSessions: [
        makeEvent({ type: "completed", title: "Gym", timestamp: daysAgo(1) }),
        makeEvent({ type: "completed", title: "DSA", timestamp: daysAgo(2) }),
        makeEvent({ type: "completed", title: "College", timestamp: daysAgo(3) }),
      ],
      missedSessions: [
        makeEvent({ type: "skipped", title: "Gym", timestamp: daysAgo(4) }),
      ],
      stats: { totalSessions: 4, completedCount: 3, missedCount: 1, adjustmentCount: 0 },
    });
    const report = extractPatterns(memory);
    const completionPatterns = report.patterns.filter((p) => p.type === "completion_rate");
    expect(completionPatterns).toHaveLength(3);
  });

  it("produces deterministic output order", () => {
    const memory = makeMemory({
      completedSessions: [
        makeEvent({ type: "completed", title: "Gym", timestamp: daysAgo(1) }),
        makeEvent({ type: "completed", title: "DSA", timestamp: daysAgo(2) }),
      ],
      trustHistory: [
        { date: "2026-08-01", score: 55 },
        { date: "2026-08-02", score: 60 },
      ],
      stats: { totalSessions: 2, completedCount: 2, missedCount: 0, adjustmentCount: 0 },
    });

    const report1 = extractPatterns(memory);
    const report2 = extractPatterns(memory);

    expect(report1.patterns.map((p) => p.id)).toEqual(report2.patterns.map((p) => p.id));
  });
});
