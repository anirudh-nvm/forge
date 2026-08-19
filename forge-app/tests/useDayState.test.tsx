import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCurrentDayState } from "../src/day/DayStateEngine";
import type { TodayPlan } from "../src/types/todayPlan";
import type { TimelineItem } from "../src/types/timeline";

function makePlan(timeline: TimelineItem[]): TodayPlan {
  return {
    greeting: "hi",
    summary: ["good morning, anirudh."],
    commitments: [],
    timeline,
    unscheduled: [],
    warnings: [],
    recommendation: "",
  };
}

function makeCommitment(overrides: Partial<TimelineItem>): TimelineItem {
  return {
    id: "c1",
    kind: "commitment",
    title: "Event",
    startTime: "9:00 AM",
    endTime: "10:00 AM",
    locked: true,
    ...overrides,
  };
}

function makeRecovery(overrides: Partial<TimelineItem>): TimelineItem {
  return {
    id: "r1",
    kind: "recovery",
    title: "Recovery",
    startTime: "2:00 PM",
    endTime: "2:20 PM",
    locked: false,
    recoveryReason: "after_long_fixed",
    ...overrides,
  };
}

function makeMeal(overrides: Partial<TimelineItem>): TimelineItem {
  return {
    id: "m1",
    kind: "meal",
    title: "Lunch",
    startTime: "1:00 PM",
    endTime: "2:00 PM",
    locked: true,
    ...overrides,
  };
}

function makeAnchor(overrides: Partial<TimelineItem>): TimelineItem {
  return {
    id: "a1",
    kind: "anchor",
    title: "Wake",
    startTime: "7:30 AM",
    endTime: "7:30 AM",
    locked: true,
    anchorType: "wake",
    ...overrides,
  };
}

function dateAt(hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

describe("useDayState (integration with DayStateEngine)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns day_complete for null plan", () => {
    const state = getCurrentDayState(null as any, new Date());
    expect(state.phase).toBe("day_complete");
  });

  it("returns day_complete for empty timeline", () => {
    const plan = makePlan([]);
    const state = getCurrentDayState(plan, new Date());
    expect(state.phase).toBe("day_complete");
  });

  it("returns before_day before first commitment", () => {
    const plan = makePlan([
      makeCommitment({ startTime: "9:00 AM", endTime: "10:00 AM" }),
    ]);
    const state = getCurrentDayState(plan, dateAt(8, 0));
    expect(state.phase).toBe("before_day");
  });

  it("returns active_commitment during commitment", () => {
    const plan = makePlan([
      makeCommitment({ startTime: "9:00 AM", endTime: "10:00 AM" }),
    ]);
    const state = getCurrentDayState(plan, dateAt(9, 30));
    expect(state.phase).toBe("active_commitment");
  });

  it("returns recovery during recovery window", () => {
    const plan = makePlan([
      makeCommitment({ startTime: "9:00 AM", endTime: "2:00 PM" }),
      makeRecovery({ startTime: "2:00 PM", endTime: "2:20 PM" }),
    ]);
    const state = getCurrentDayState(plan, dateAt(14, 10));
    expect(state.phase).toBe("recovery");
  });

  it("returns day_complete after all commitments", () => {
    const plan = makePlan([
      makeCommitment({ startTime: "9:00 AM", endTime: "10:00 AM" }),
    ]);
    const state = getCurrentDayState(plan, dateAt(11, 0));
    expect(state.phase).toBe("day_complete");
  });

  it("returns recovery with minutesRemaining", () => {
    const plan = makePlan([
      makeCommitment({ startTime: "9:00 AM", endTime: "2:00 PM" }),
      makeRecovery({ startTime: "2:00 PM", endTime: "2:20 PM" }),
    ]);
    const state = getCurrentDayState(plan, dateAt(14, 5));
    expect(state.phase).toBe("recovery");
    expect(state.recovery?.minutesRemaining).toBe(15);
  });

  it("handles meal gaps correctly (before_commitment)", () => {
    const plan = makePlan([
      makeCommitment({ startTime: "9:00 AM", endTime: "12:00 PM" }),
      makeMeal({ startTime: "1:00 PM", endTime: "2:00 PM" }),
      makeCommitment({ id: "c2", startTime: "2:00 PM", endTime: "3:00 PM" }),
    ]);
    const state = getCurrentDayState(plan, dateAt(12, 30));
    expect(state.phase).toBe("before_commitment");
    expect(state.nextCommitment?.id).toBe("c2");
  });

  it("handles time progression with fake timers", () => {
    const plan = makePlan([
      makeCommitment({ startTime: "9:00 AM", endTime: "10:00 AM" }),
    ]);
    
    // Before day
    vi.setSystemTime(dateAt(8, 0));
    let state = getCurrentDayState(plan, new Date());
    expect(state.phase).toBe("before_day");
    
    // Active commitment
    vi.setSystemTime(dateAt(9, 30));
    state = getCurrentDayState(plan, new Date());
    expect(state.phase).toBe("active_commitment");
    
    // Day complete
    vi.setSystemTime(dateAt(11, 0));
    state = getCurrentDayState(plan, new Date());
    expect(state.phase).toBe("day_complete");
  });

  it("handles multiple commitments correctly", () => {
    const plan = makePlan([
      makeCommitment({ id: "c1", startTime: "9:00 AM", endTime: "10:00 AM" }),
      makeCommitment({ id: "c2", startTime: "11:00 AM", endTime: "12:00 PM" }),
    ]);
    
    let state = getCurrentDayState(plan, dateAt(8, 0));
    expect(state.phase).toBe("before_day");
    expect(state.nextCommitment?.id).toBe("c1");
    
    state = getCurrentDayState(plan, dateAt(9, 30));
    expect(state.phase).toBe("active_commitment");
    expect(state.currentCommitment?.id).toBe("c1");
    
    state = getCurrentDayState(plan, dateAt(10, 30));
    expect(state.phase).toBe("before_commitment");
    expect(state.nextCommitment?.id).toBe("c2");
    
    state = getCurrentDayState(plan, dateAt(11, 30));
    expect(state.phase).toBe("active_commitment");
    expect(state.currentCommitment?.id).toBe("c2");
    
    state = getCurrentDayState(plan, dateAt(13, 0));
    expect(state.phase).toBe("day_complete");
  });
});