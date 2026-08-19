import { describe, it, expect } from "vitest";
import { scheduleDay } from "../src/brain/Scheduler";
import { generatePlan } from "../src/brain/Brain";
import { extractConstraints } from "../src/brain/pipeline/ConstraintExtractor";
import { extractEntities, resolveEntity } from "../src/brain/pipeline/EntityExtractor";
import { preprocessConversation } from "../src/brain/Preprocessor";
import type { FixedEvent, FlexibleTask } from "../src/brain/types";

function makeFixed(overrides: Partial<FixedEvent>): FixedEvent {
  return { title: "Event", confidence: 0.9, ...overrides };
}

function makeTask(overrides: Partial<FlexibleTask>): FlexibleTask {
  return { title: "Task", constraints: [], confidence: 0.8, ...overrides };
}

function hour(time: string): number {
  const match = time.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  const m = match[2] ? parseInt(match[2], 10) : 0;
  const p = match[3]?.toUpperCase();
  if (p === "PM" && h !== 12) h += 12;
  if (p === "AM" && h === 12) h = 0;
  return h + m / 60;
}

describe("Sprint C2 Stress Suite", () => {
  describe("day anchors", () => {
    const anchorCases: [string, string, string, boolean][] = [
      ["wake", "default wake time", "7:30 AM", false],
      ["breakfast", "default breakfast time", "8:30 AM", false],
      ["lunch", "default lunch time", "1:00 PM", false],
      ["dinner", "default dinner time", "8:00 PM", false],
      ["bedtime", "default bedtime time", "11:00 PM", false],
    ];

    it.each(anchorCases)("uses %s %s", (_type, _desc, expected, _locked) => {
      const { plan } = scheduleDay([], [], [], []);
      const anchor = plan.timeline.find(t => t.kind === "anchor" && t.startTime === expected);
      expect(anchor).toBeDefined();
    });

    it("respects an explicit dinner at 7 PM instead of the default", () => {
      const { plan } = scheduleDay(
        [makeFixed({ title: "Dinner", startTime: "7:00 PM", endTime: "8:00 PM" })],
        [],
        [],
        []
      );
      const dinnerAnchor = plan.timeline.find(t => t.kind === "anchor" && t.anchorType === "dinner");
      expect(hour(dinnerAnchor!.startTime)).toBe(19);
      // The explicit Dinner commitment itself protects 7-8 PM
      const dinnerCommitment = plan.commitments.find(c => c.title === "Dinner");
      expect(hour(dinnerCommitment!.startTime)).toBe(19);
      expect(hour(dinnerCommitment!.endTime)).toBe(20);
      expect(dinnerCommitment!.locked).toBe(true);
    });
  });

  describe("natural-language time expressions", () => {
    const constraintCases: [string, string, string | undefined, boolean][] = [
      ["journal before sleeping", "before", "Bedtime", false],
      ["read before bed", "before", "Bedtime", false],
      ["meditate after waking up", "after", "Wake", false],
      ["call parents this evening", "evening", undefined, false],
      ["study later tonight", "evening", undefined, false],
      ["read after lunch", "after", "Lunch", false],
      ["gym after dinner", "after", "Dinner", false],
      ["revision first thing", "first_thing", undefined, false],
      ["emails late afternoon", "late_afternoon", undefined, false],
    ];

    it.each(constraintCases)("extracts '%s' as %s %s", (text, type, target, _tight) => {
      const constraints = extractConstraints(text);
      const match = constraints.find(c => c.type === type);
      expect(match).toBeDefined();
      if (target) expect(match!.target).toBe(target);
    });

    it("detects tomorrow and defers it", () => {
      const { output } = preprocessConversation({
        conversation: "gym tomorrow afternoon",
        priorities: [],
        currentTime: new Date("2026-08-11T09:00:00"),
      });
      expect(output.deferredItems.some(i => i.name === "Gym")).toBe(true);
      expect(output.extractedItems).toHaveLength(0);
    });
  });

  describe("recovery after long commitments", () => {
    it("adds recovery after a 6-hour fixed event", () => {
      const { plan } = scheduleDay(
        [makeFixed({ title: "College", startTime: "9:00 AM", endTime: "3:00 PM" })],
        [],
        [],
        []
      );
      expect(plan.timeline.some(t => t.kind === "recovery" && t.recoveryReason === "after_long_fixed")).toBe(true);
    });

    it("places tasks after the recovery, not immediately after college", () => {
      const { plan } = scheduleDay(
        [makeFixed({ title: "College", startTime: "9:00 AM", endTime: "2:00 PM" })],
        [makeTask({ title: "DSA Practice", estimatedMinutes: 60 })],
        [],
        []
      );
      const recovery = plan.timeline.find(t => t.kind === "recovery");
      const dsa = plan.commitments.find(c => c.title === "DSA Practice");
      expect(recovery).toBeDefined();
      expect(hour(dsa!.startTime)).toBeGreaterThanOrEqual(hour(recovery!.endTime));
    });
  });

  describe("meal protection", () => {
    it("never schedules across the dinner meal block", () => {
      const { plan } = scheduleDay(
        [makeFixed({ title: "College", startTime: "9:00 AM", endTime: "5:00 PM" })],
        [makeTask({ title: "CAT", constraints: [{ type: "before", target: "bedtime" }] })],
        [],
        []
      );
      const dinner = plan.timeline.find(t => t.kind === "meal" && t.title === "Dinner");
      const cat = plan.commitments.find(c => c.title === "CAT");
      const overlaps = hour(cat!.startTime) < hour(dinner!.endTime) && hour(cat!.endTime) > hour(dinner!.startTime);
      expect(overlaps).toBe(false);
    });

    it("orders dinner before a before-bedtime task", () => {
      const { plan } = scheduleDay(
        [],
        [makeTask({ title: "CAT", constraints: [{ type: "before", target: "bedtime" }] })],
        [],
        []
      );
      const dinner = plan.timeline.find(t => t.kind === "meal" && t.title === "Dinner");
      const cat = plan.commitments.find(c => c.title === "CAT");
      expect(hour(dinner!.startTime)).toBeLessThan(hour(cat!.startTime));
    });
  });

  describe("rich constraints", () => {
    it("keeps before-lunch tasks out of the afternoon", () => {
      const { plan } = scheduleDay(
        [],
        [makeTask({ title: "Errands", constraints: [{ type: "before", target: "lunch" }], estimatedMinutes: 30 })],
        [],
        []
      );
      const errands = plan.commitments.find(c => c.title === "Errands");
      expect(hour(errands!.endTime)).toBeLessThanOrEqual(13);
    });

    it("keeps after-work tasks after work", () => {
      const { plan } = scheduleDay(
        [makeFixed({ title: "Office", startTime: "9:00 AM", endTime: "5:00 PM" })],
        [makeTask({ title: "Gym", constraints: [{ type: "after", target: "work" }] })],
        [],
        []
      );
      const gym = plan.commitments.find(c => c.title === "Gym");
      expect(hour(gym!.startTime)).toBeGreaterThanOrEqual(17);
    });
  });

  describe("expanded entities", () => {
    const entityCases: [string, string][] = [
      ["cat prep", "Competitive Exam"],
      ["jee math", "Competitive Exam"],
      ["gre vocabulary", "Competitive Exam"],
      ["upsc revision", "Competitive Exam"],
      ["interview practice", "Interview"],
      ["mock test", "Mock Test"],
      ["current affairs", "Current Affairs"],
      ["answer writing", "Answer Writing"],
      ["morning walk", "Walk"],
      ["yoga", "Yoga"],
      ["meditation", "Meditation"],
      ["physio", "Physio"],
      ["reply to emails", "Email"],
      ["standup", "Standup"],
      ["code review", "Coding"],
      ["ui design", "Design"],
      ["prepare presentation", "Presentation"],
      ["paperwork", "Admin"],
      ["buy groceries", "Groceries"],
      ["clean the kitchen", "Cleaning"],
      ["pay bills", "Bills"],
      ["laundry", "Laundry"],
      ["journal", "Journal"],
      ["call parents", "Call Parents"],
      ["hang out with friends", "Friends"],
      ["watch movie", "Movie"],
      ["gaming", "Gaming"],
      ["read for an hour", "Reading"],
      ["grab coffee", "Coffee"],
    ];

    it.each(entityCases)("resolves '%s' to %s", (text, expected) => {
      expect(resolveEntity(text)).toBe(expected);
    });

    it("extracts multiple entities in order", () => {
      const matches = extractEntities("study pyqs and morning run");
      expect(matches.length).toBeGreaterThanOrEqual(2);
      expect(matches[0].normalized).toBe("Study");
      expect(matches.map(m => m.normalized)).toContain("PYQs");
      expect(matches.map(m => m.normalized)).toContain("Run");
    });
  });

  describe("explainability", () => {
    it("explains after-recovery placement", () => {
      const { plan } = scheduleDay(
        [makeFixed({ title: "College", startTime: "9:00 AM", endTime: "2:00 PM" })],
        [makeTask({ title: "DSA Practice" })],
        [],
        []
      );
      const dsa = plan.commitments.find(c => c.title === "DSA Practice");
      expect(dsa!.placementReasons).toContain("after_recovery");
    });

    it("explains before-bedtime placement", () => {
      const { plan } = scheduleDay(
        [],
        [makeTask({ title: "CAT", constraints: [{ type: "before", target: "bedtime" }] })],
        [],
        []
      );
      const cat = plan.commitments.find(c => c.title === "CAT");
      expect(cat!.placementReasons).toContain("before_bedtime");
    });
  });

  describe("full pipeline", () => {
    it("turns the C2 example into a coherent plan", async () => {
      const result = await generatePlan({
        conversation: "college till 2. i want to decompress a bit. finish cat before sleeping. dsa can happen anytime after lunch. don't interrupt dinner.",
        priorities: [],
        currentTime: new Date("2026-08-11T09:00:00"),
      });
      const titles = result.todayPlan.timeline
        .filter(t => t.kind === "commitment")
        .map(t => t.title);
      expect(titles).toContain("College");
      expect(titles).toContain("Dinner");
      expect(result.todayPlan.timeline.some(t => t.kind === "recovery")).toBe(true);
    });

    it("handles a rich natural-language day", async () => {
      const result = await generatePlan({
        conversation: "college from 9 to 5. i want to decompress right after college. finish cat before sleeping. dsa after lunch. don't interrupt dinner.",
        priorities: ["studies"],
        currentTime: new Date("2026-08-11T09:00:00"),
      });
      const commitmentTitles = result.todayPlan.timeline
        .filter(t => t.kind === "commitment")
        .map(t => t.title);
      expect(commitmentTitles).toContain("College");
      expect(commitmentTitles).toContain("DSA Practice");
      expect(result.todayPlan.timeline.some(t => t.kind === "recovery")).toBe(true);
    });

    it("produces deterministic output across runs", async () => {
      const input = {
        conversation: "college till 2. finish cat before sleeping. dsa after lunch.",
        priorities: [] as string[],
        currentTime: new Date("2026-08-11T09:00:00"),
      };
      const a = await generatePlan(input);
      const b = await generatePlan(input);
      expect(a.todayPlan.commitments.map(c => `${c.title}@${c.startTime}`))
        .toEqual(b.todayPlan.commitments.map(c => `${c.title}@${c.startTime}`));
    });
  });
});