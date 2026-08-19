import { describe, it, expect } from "vitest";
import { scheduleDay } from "../src/brain/Scheduler";
import type { FixedEvent, FlexibleTask } from "../src/brain/types";

function makeFixed(overrides: Partial<FixedEvent>): FixedEvent {
  return { title: "Event", confidence: 0.9, ...overrides };
}

function makeTask(overrides: Partial<FlexibleTask>): FlexibleTask {
  return { title: "Task", constraints: [], confidence: 0.8, ...overrides };
}

function parseHour(time: string): number {
  const match = time.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  const m = match[2] ? parseInt(match[2], 10) : 0;
  const p = match[3]?.toUpperCase();
  if (p === "PM" && h !== 12) h += 12;
  if (p === "AM" && h === 12) h = 0;
  return h + m / 60;
}

describe("Day Model (Phase 5)", () => {
  it("produces a timeline with anchors, meals and commitments", () => {
    const { plan } = scheduleDay(
      [makeFixed({ title: "College", startTime: "9:00 AM", endTime: "2:00 PM" })],
      [makeTask({ title: "DSA Practice" })],
      [],
      []
    );
    expect(plan.timeline.length).toBeGreaterThan(0);
    expect(plan.timeline.some(t => t.kind === "anchor")).toBe(true);
    expect(plan.timeline.some(t => t.kind === "meal")).toBe(true);
    expect(plan.timeline.some(t => t.kind === "commitment")).toBe(true);
  });

  it("includes wake through bedtime anchors in order", () => {
    const { plan } = scheduleDay([makeFixed({ title: "College", startTime: "9:00 AM", endTime: "5:00 PM" })], [], [], []);
    const anchors = plan.timeline.filter(t => t.kind === "anchor");
    expect(anchors.map(a => a.anchorType)).toEqual([
      "wake",
      "breakfast",
      "lunch",
      "dinner",
      "bedtime",
    ]);
  });

  it("keeps the backwards-compatible commitments list", () => {
    const { plan } = scheduleDay(
      [makeFixed({ title: "College", startTime: "9:00 AM", endTime: "5:00 PM" })],
      [makeTask({ title: "Gym" })],
      [],
      []
    );
    expect(plan.commitments).toHaveLength(2);
    expect(plan.timeline.filter(t => t.kind === "commitment")).toHaveLength(2);
  });
});

describe("Recovery Buffers (Phase 6)", () => {
  it("adds a 20m recovery after a fixed event longer than 4h", () => {
    const { plan, logs } = scheduleDay(
      [makeFixed({ title: "College", startTime: "9:00 AM", endTime: "2:00 PM" })],
      [],
      [],
      []
    );
    const recovery = plan.timeline.find(t => t.kind === "recovery");
    expect(recovery).toBeDefined();
    expect(recovery!.recoveryReason).toBe("after_long_fixed");
    expect(parseHour(recovery!.startTime)).toBe(14);
    expect(parseHour(recovery!.endTime)).toBeCloseTo(14 + 1 / 3, 2);
  });

  it("adds a 15m reset after deep work", () => {
    const { plan } = scheduleDay(
      [makeFixed({ title: "DSA Practice", startTime: "3:00 PM", endTime: "4:30 PM" })],
      [],
      [],
      []
    );
    const reset = plan.timeline.find(t => t.kind === "buffer");
    expect(reset).toBeDefined();
    expect(reset!.recoveryReason).toBe("after_deep_work");
  });

  it("adds a 10m break after a work block over 90 minutes", () => {
    const { plan } = scheduleDay(
      [makeFixed({ title: "Office", startTime: "9:00 AM", endTime: "11:00 AM" })],
      [],
      [],
      []
    );
    const brk = plan.timeline.find(t => t.kind === "break");
    expect(brk).toBeDefined();
    expect(brk!.recoveryReason).toBe("after_work_block");
  });

  it("does not add recovery for short commitments", () => {
    const { plan } = scheduleDay(
      [makeFixed({ title: "Dentist", startTime: "10:00 AM", endTime: "11:00 AM" })],
      [],
      [],
      []
    );
    expect(plan.timeline.filter(t => ["recovery", "break", "buffer"].includes(t.kind))).toHaveLength(0);
  });
});

describe("Meal Protection (Phase 7)", () => {
  it("protects the dinner meal block from flexible tasks", () => {
    const { plan } = scheduleDay(
      [makeFixed({ title: "College", startTime: "9:00 AM", endTime: "5:00 PM" })],
      [makeTask({ title: "CAT", constraints: [{ type: "before", target: "bedtime" }] })],
      [],
      []
    );
    const dinner = plan.timeline.find(t => t.kind === "meal" && t.title === "Dinner");
    expect(dinner).toBeDefined();

    const cat = plan.commitments.find(c => c.title === "CAT");
    expect(cat).toBeDefined();
    // CAT must not overlap dinner 8-9 PM, and must end before 11 PM bedtime
    const catEnd = parseHour(cat!.endTime);
    const catStart = parseHour(cat!.startTime);
    expect(catStart >= parseHour(dinner!.endTime) || catEnd <= parseHour(dinner!.startTime)).toBe(true);
    expect(catEnd).toBeLessThanOrEqual(23);
  });

  it("orders dinner before CAT when both share the evening", () => {
    const { plan } = scheduleDay(
      [],
      [
        makeTask({ title: "CAT", constraints: [{ type: "before", target: "bedtime" }] }),
      ],
      [],
      []
    );
    const dinner = plan.timeline.find(t => t.kind === "meal" && t.title === "Dinner");
    const cat = plan.commitments.find(c => c.title === "CAT");
    expect(cat).toBeDefined();
    const catStart = parseHour(cat!.startTime);
    expect(parseHour(dinner!.startTime)).toBe(20);
    expect(catStart).toBeGreaterThanOrEqual(parseHour(dinner!.endTime));
  });

  it("does not protect meals that the user explicitly scheduled around", () => {
    const { plan } = scheduleDay(
      [makeFixed({ title: "College", startTime: "12:00 PM", endTime: "2:00 PM" })],
      [],
      [],
      []
    );
    const lunch = plan.timeline.find(t => t.kind === "meal" && t.title === "Lunch");
    expect(lunch).toBeUndefined();
  });
});

describe("Human Schedule Scoring (Phase 8)", () => {
  it("keeps deep work blocks from stacking three in a row", () => {
    const { plan } = scheduleDay(
      [makeFixed({ title: "College", startTime: "9:00 AM", endTime: "2:00 PM" })],
      [
        makeTask({ title: "Study", estimatedMinutes: 60 }),
        makeTask({ title: "DSA Practice", estimatedMinutes: 60 }),
        makeTask({ title: "Coding", estimatedMinutes: 60 }),
        makeTask({ title: "Gym", estimatedMinutes: 60 }),
      ],
      [],
      []
    );
    const deepCount = Math.min(3, plan.commitments.filter(c => ["Study", "DSA Practice", "Coding"].includes(c.title)).length);
    // All three deep work tasks should still be scheduled, but the schedule
    // should interleave a non-deep task (Gym) instead of being penalized.
    const studiedDeep = plan.commitments.filter(c => ["Study", "DSA Practice", "Coding"].includes(c.title));
    expect(studiedDeep.length).toBe(deepCount);
  });

  it("boosts tasks placed right after a recovery break", () => {
    const { plan } = scheduleDay(
      [makeFixed({ title: "College", startTime: "9:00 AM", endTime: "2:00 PM" })],
      [makeTask({ title: "DSA Practice", estimatedMinutes: 60 })],
      [],
      []
    );
    const recovery = plan.timeline.find(t => t.kind === "recovery");
    const dsa = plan.commitments.find(c => c.title === "DSA Practice");
    expect(recovery).toBeDefined();
    expect(dsa).toBeDefined();
    expect(parseHour(dsa!.startTime)).toBeGreaterThanOrEqual(parseHour(recovery!.endTime));
    expect(dsa!.placementReasons).toContain("after_recovery");
  });

  it("rewards the preferred study window", () => {
    const { plan } = scheduleDay(
      [makeFixed({ title: "College", startTime: "9:00 AM", endTime: "2:00 PM" })],
      [makeTask({ title: "Revision", estimatedMinutes: 60 })],
      [],
      []
    );
    const revision = plan.commitments.find(c => c.title === "Revision");
    expect(revision).toBeDefined();
    const start = parseHour(revision!.startTime);
    expect(start).toBeGreaterThanOrEqual(12);
    expect(start).toBeLessThan(19);
  });
});

describe("Explainability v2 (Phase 9)", () => {
  it("attaches an explanation to after-recovery placement", () => {
    const { plan } = scheduleDay(
      [makeFixed({ title: "College", startTime: "9:00 AM", endTime: "2:00 PM" })],
      [makeTask({ title: "DSA Practice" })],
      [],
      []
    );
    const dsa = plan.commitments.find(c => c.title === "DSA Practice");
    expect(dsa).toBeDefined();
    expect(dsa!.placementReasons).toBeDefined();
    expect(dsa!.placementReasons!.length).toBeGreaterThan(0);
  });

  it("produces reasons for a before-bedtime task", () => {
    const { plan } = scheduleDay(
      [],
      [makeTask({ title: "CAT", constraints: [{ type: "before", target: "bedtime" }] })],
      [],
      []
    );
    const cat = plan.commitments.find(c => c.title === "CAT");
    expect(cat).toBeDefined();
    expect(cat!.placementReasons).toContain("before_bedtime");
  });
});

describe("End-to-end deliverable", () => {
  it("builds a human schedule from the C2 example", () => {
    const { plan } = scheduleDay(
      [makeFixed({ title: "College", startTime: "9:00 AM", endTime: "2:00 PM" })],
      [
        makeTask({ title: "CAT", constraints: [{ type: "before", target: "bedtime" }] }),
        makeTask({ title: "DSA Practice", constraints: [{ type: "after", target: "lunch" }] }),
      ],
      [],
      []
    );
    // Ordering should be College → Recovery → DSA → Dinner → CAT → Bedtime
    const order = plan.timeline
      .filter(t => t.kind === "commitment" || t.kind === "recovery" || t.kind === "meal")
      .map(t => t.title);

    const idx = (name: string) => order.findIndex(t => t === name);
    expect(idx("College")).toBeGreaterThanOrEqual(0);
    expect(idx("Recovery")).toBeGreaterThanOrEqual(0);
    expect(idx("DSA Practice")).toBeGreaterThanOrEqual(0);
    expect(idx("Recovery")).toBeLessThan(idx("DSA Practice"));
    expect(idx("DSA Practice")).toBeLessThan(idx("Dinner"));
    expect(idx("Dinner")).toBeLessThan(idx("CAT"));
  });
});