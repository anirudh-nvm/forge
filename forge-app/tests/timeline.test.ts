import { describe, it, expect, beforeEach } from "vitest";
import {
  recordStarted,
  recordCompleted,
  recordSkipped,
  getTimeline,
  resetTimeline,
  recordPlanCreated,
  recordAdjustment,
} from "../src/engine/TimelineEngine";
import type { Adjustment } from "../src/engine/AdjustmentEngine";

beforeEach(() => {
  resetTimeline();
});

describe("TimelineEngine session recording", () => {
  it("records a started event with the commitment title", () => {
    recordStarted("college", "College");
    const events = getTimeline();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("started");
    expect(events[0].commitmentId).toBe("college");
    expect(events[0].title).toContain("College");
  });

  it("records a completed event", () => {
    recordCompleted("dsa", "DSA Practice");
    const events = getTimeline();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("completed");
    expect(events[0].commitmentId).toBe("dsa");
  });

  it("records a skipped event", () => {
    recordSkipped("gym", "Gym");
    const events = getTimeline();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("skipped");
    expect(events[0].commitmentId).toBe("gym");
    expect(events[0].title).toContain("Gym");
  });

  it("accumulates multiple session events", () => {
    recordStarted("a", "A");
    recordCompleted("a", "A");
    recordSkipped("b", "B");
    const events = getTimeline();
    expect(events).toHaveLength(3);
    expect(events.map(e => e.type)).toEqual(["started", "completed", "skipped"]);
  });

  it("coexists with plan and adjustment events", () => {
    recordPlanCreated({
      greeting: "",
      summary: [],
      commitments: [],
      timeline: [],
      unscheduled: [],
      warnings: [],
      recommendation: "",
      status: "draft",
    });
    recordCompleted("college", "College");
    recordAdjustment({ type: "lock", taskId: "college" } as Adjustment, "College");
    const events = getTimeline();
    expect(events.map(e => e.type)).toContain("planCreated");
    expect(events.map(e => e.type)).toContain("completed");
    expect(events.map(e => e.type)).toContain("locked");
  });
});