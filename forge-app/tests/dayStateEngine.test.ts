import { describe, it, expect } from "vitest";
import { getCurrentDayState } from "../src/day/DayStateEngine";
import type { TodayPlan } from "../src/types/todayPlan";
import type { TimelineItem } from "../src/types/timeline";

function makePlan(timeline: TimelineItem[]): TodayPlan {
  return {
    greeting: "hi",
    summary: [],
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

describe("DayStateEngine", () => {
  describe("before_day", () => {
    it("returns before_day when now is before first commitment", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "10:00 AM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(8, 0));
      expect(state.phase).toBe("before_day");
      expect(state.nextCommitment?.title).toBe("Event");
      expect(state.timeUntilNext).toBe(60);
    });

    it("returns before_day with multiple commitments", () => {
      const plan = makePlan([
        makeCommitment({ id: "c1", startTime: "9:00 AM", endTime: "10:00 AM" }),
        makeCommitment({ id: "c2", startTime: "11:00 AM", endTime: "12:00 PM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(8, 30));
      expect(state.phase).toBe("before_day");
      expect(state.nextCommitment?.title).toBe("Event");
      expect(state.timeUntilNext).toBe(30);
    });

    it("returns before_day at midnight before first commitment", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "6:00 AM", endTime: "7:00 AM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(0, 0));
      expect(state.phase).toBe("before_day");
    });

    it("returns before_day when first commitment is at 7am", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "7:00 AM", endTime: "8:00 AM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(6, 59));
      expect(state.phase).toBe("before_day");
    });

    it("does not include currentCommitment in before_day", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "10:00 AM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(8, 0));
      expect(state.currentCommitment).toBeUndefined();
    });
  });

  describe("active_commitment", () => {
    it("returns active_commitment when now is during commitment", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "10:00 AM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(9, 30));
      expect(state.phase).toBe("active_commitment");
      expect(state.currentCommitment?.title).toBe("Event");
      expect(state.currentCommitment?.startTime).toBe("9:00 AM");
      expect(state.currentCommitment?.endTime).toBe("10:00 AM");
      expect(state.currentCommitment?.locked).toBe(true);
    });

    it("returns active_commitment at exact start boundary", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "10:00 AM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(9, 0));
      expect(state.phase).toBe("active_commitment");
    });

    it("returns active_commitment at exact end boundary (exclusive)", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "10:00 AM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(10, 0));
      expect(state.phase).not.toBe("active_commitment");
    });

    it("includes nextCommitment when there is one", () => {
      const plan = makePlan([
        makeCommitment({ id: "c1", startTime: "9:00 AM", endTime: "10:00 AM" }),
        makeCommitment({ id: "c2", startTime: "11:00 AM", endTime: "12:00 PM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(9, 30));
      expect(state.nextCommitment?.id).toBe("c2");
      expect(state.timeUntilNext).toBe(90);
    });

    it("does not include nextCommitment when it's the last", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "10:00 AM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(9, 30));
      expect(state.nextCommitment).toBeUndefined();
      expect(state.timeUntilNext).toBeUndefined();
    });

    it("handles locked and unlocked commitments", () => {
      const plan = makePlan([
        makeCommitment({ locked: false, startTime: "9:00 AM", endTime: "10:00 AM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(9, 30));
      expect(state.currentCommitment?.locked).toBe(false);
    });

    it("works with concurrent commitments (same time)", () => {
      const plan = makePlan([
        makeCommitment({ id: "c1", title: "Event A", startTime: "9:00 AM", endTime: "10:00 AM" }),
        makeCommitment({ id: "c2", title: "Event B", startTime: "9:00 AM", endTime: "10:00 AM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(9, 30));
      expect(state.phase).toBe("active_commitment");
      expect(state.currentCommitment?.title).toBe("Event A");
    });
  });

  describe("recovery", () => {
    it("returns recovery when now is in recovery window", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "2:00 PM" }),
        makeRecovery({ startTime: "2:00 PM", endTime: "2:20 PM" }),
        makeCommitment({ id: "c2", startTime: "2:30 PM", endTime: "3:30 PM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(14, 10));
      expect(state.phase).toBe("recovery");
      expect(state.recovery?.reason).toBe("after_long_fixed");
      expect(state.recovery?.endsAt).toBe("2:20 PM");
      expect(state.recovery?.minutesRemaining).toBe(10);
    });

    it("returns recovery at exact start boundary", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "2:00 PM" }),
        makeRecovery({ startTime: "2:00 PM", endTime: "2:20 PM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(14, 0));
      expect(state.phase).toBe("recovery");
    });

    it("returns recovery with correct minutesRemaining", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "2:00 PM" }),
        makeRecovery({ startTime: "2:00 PM", endTime: "2:20 PM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(14, 5));
      expect(state.recovery?.minutesRemaining).toBe(15);
    });

    it("returns recovery for after_work_block", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "11:00 AM" }),
        makeRecovery({ recoveryReason: "after_work_block", startTime: "11:00 AM", endTime: "11:10 AM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(11, 5));
      expect(state.recovery?.reason).toBe("after_work_block");
    });

    it("returns recovery for after_deep_work", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "11:00 AM" }),
        makeRecovery({ recoveryReason: "after_deep_work", startTime: "11:00 AM", endTime: "11:15 AM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(11, 5));
      expect(state.recovery?.reason).toBe("after_deep_work");
    });

    it("includes nextCommitment after recovery", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "2:00 PM" }),
        makeRecovery({ startTime: "2:00 PM", endTime: "2:20 PM" }),
        makeCommitment({ id: "c2", startTime: "2:30 PM", endTime: "3:30 PM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(14, 10));
      expect(state.nextCommitment?.id).toBe("c2");
      expect(state.timeUntilNext).toBe(20);
    });

    it("recovery overlaps next commitment start (edge case)", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "2:00 PM" }),
        makeRecovery({ startTime: "2:00 PM", endTime: "2:20 PM" }),
        makeCommitment({ id: "c2", startTime: "2:15 PM", endTime: "3:15 PM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(14, 10));
      expect(state.phase).toBe("recovery");
    });

    it("multiple recoveries in timeline", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "2:00 PM" }),
        makeRecovery({ id: "r1", recoveryReason: "after_long_fixed", startTime: "2:00 PM", endTime: "2:20 PM" }),
        makeCommitment({ id: "c2", startTime: "2:30 PM", endTime: "4:30 PM" }),
        makeRecovery({ id: "r2", recoveryReason: "after_long_fixed", startTime: "4:30 PM", endTime: "4:50 PM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(16, 40));
      expect(state.phase).toBe("recovery");
      expect(state.recovery?.id).toBe("r2");
    });
  });

  describe("before_commitment", () => {
    it("returns before_commitment when between commitments without recovery", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "10:00 AM" }),
        makeCommitment({ id: "c2", startTime: "11:00 AM", endTime: "12:00 PM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(10, 30));
      expect(state.phase).toBe("before_commitment");
      expect(state.nextCommitment?.id).toBe("c2");
      expect(state.timeUntilNext).toBe(30);
    });

    it("returns before_commitment with meal gap", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "12:00 PM" }),
        makeMeal({ startTime: "1:00 PM", endTime: "2:00 PM" }),
        makeCommitment({ id: "c2", startTime: "2:00 PM", endTime: "3:00 PM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(12, 30));
      expect(state.phase).toBe("before_commitment");
      expect(state.nextCommitment?.id).toBe("c2");
    });

    it("does not include recovery when no recovery exists", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "10:00 AM" }),
        makeCommitment({ id: "c2", startTime: "11:00 AM", endTime: "12:00 PM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(10, 30));
      expect(state.recovery).toBeUndefined();
    });
  });

  describe("between_commitments", () => {
    it("returns before_commitment when between commitments with gap", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "10:00 AM" }),
        makeCommitment({ id: "c2", startTime: "11:00 AM", endTime: "12:00 PM" }),
        makeCommitment({ id: "c3", startTime: "2:00 PM", endTime: "3:00 PM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(12, 30));
      expect(state.phase).toBe("before_commitment");
      expect(state.nextCommitment?.id).toBe("c3");
    });

    it("returns between_commitments when no next commitment", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "10:00 AM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(10, 30));
      expect(state.phase).toBe("day_complete");
    });
  });

  describe("day_complete", () => {
    it("returns day_complete after last commitment ends", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "10:00 AM" }),
        makeCommitment({ id: "c2", startTime: "11:00 AM", endTime: "12:00 PM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(13, 0));
      expect(state.phase).toBe("day_complete");
    });

    it("returns day_complete with single commitment", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "10:00 AM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(11, 0));
      expect(state.phase).toBe("day_complete");
    });

    it("does not include current or next commitment", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "10:00 AM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(11, 0));
      expect(state.currentCommitment).toBeUndefined();
      expect(state.nextCommitment).toBeUndefined();
    });
  });

  describe("empty plan", () => {
    it("returns day_complete for empty timeline", () => {
      const plan = makePlan([]);
      const state = getCurrentDayState(plan, dateAt(10, 0));
      expect(state.phase).toBe("day_complete");
    });

    it("returns day_complete for plan with only anchors and meals", () => {
      const plan = makePlan([
        makeAnchor(),
        makeMeal(),
      ]);
      const state = getCurrentDayState(plan, dateAt(10, 0));
      expect(state.phase).toBe("day_complete");
    });
  });

  describe("edge cases", () => {
    it("handles all-day commitment (college 6am-11pm)", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "6:00 AM", endTime: "11:00 PM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(12, 0));
      expect(state.phase).toBe("active_commitment");
    });

    it("handles single 30-minute task", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "2:00 PM", endTime: "2:30 PM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(1, 0));
      expect(state.phase).toBe("before_day");
      const state2 = getCurrentDayState(plan, dateAt(14, 15));
      expect(state2.phase).toBe("active_commitment");
    });

    it("ignores unscheduled items", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "10:00 AM" }),
      ]);
      plan.unscheduled = [{ title: "Unscheduled", reason: "no time" }];
      const state = getCurrentDayState(plan, dateAt(9, 30));
      expect(state.phase).toBe("active_commitment");
    });

    it("ignores warnings", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "10:00 AM" }),
      ]);
      plan.warnings = ["some warning"];
      const state = getCurrentDayState(plan, dateAt(9, 30));
      expect(state.phase).toBe("active_commitment");
    });

    it("ignores recovery items that are not kind recovery", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "2:00 PM" }),
        { ...makeRecovery(), kind: "buffer" as any },
      ]);
      const state = getCurrentDayState(plan, dateAt(14, 10));
      expect(state.phase).toBe("day_complete");
    });

    it("handles timezone correctly (uses local time)", () => {
      const plan = makePlan([
        makeCommitment({ startTime: "9:00 AM", endTime: "10:00 AM" }),
      ]);
      const d = new Date();
      d.setHours(9, 30, 0, 0);
      const state = getCurrentDayState(plan, d);
      expect(state.phase).toBe("active_commitment");
    });

    it("handles multiple anchors (wake, breakfast, lunch, dinner, bedtime)", () => {
      const plan = makePlan([
        makeAnchor({ anchorType: "wake" }),
        makeAnchor({ anchorType: "breakfast" }),
        makeCommitment({ startTime: "9:00 AM", endTime: "10:00 AM" }),
        makeAnchor({ anchorType: "lunch" }),
        makeAnchor({ anchorType: "dinner" }),
        makeAnchor({ anchorType: "bedtime" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(9, 30));
      expect(state.phase).toBe("active_commitment");
    });

    it("handles commitments sorted by startTime", () => {
      const plan = makePlan([
        makeCommitment({ id: "c2", startTime: "11:00 AM", endTime: "12:00 PM" }),
        makeCommitment({ id: "c1", startTime: "9:00 AM", endTime: "10:00 AM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(9, 30));
      expect(state.currentCommitment?.id).toBe("c1");
    });

    it("handles locked vs unlocked commitment display", () => {
      const plan = makePlan([
        makeCommitment({ locked: true, startTime: "9:00 AM", endTime: "10:00 AM" }),
        makeCommitment({ id: "c2", locked: false, startTime: "11:00 AM", endTime: "12:00 PM" }),
      ]);
      const state = getCurrentDayState(plan, dateAt(9, 30));
      expect(state.currentCommitment?.locked).toBe(true);
    });
  });
});