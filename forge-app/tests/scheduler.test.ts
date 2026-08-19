import { describe, it, expect } from "vitest";
import { scheduleDay, SchedulerError } from "../src/brain/Scheduler";
import type { FixedEvent, FlexibleTask, Constraint, Preference } from "../src/brain/types";

function makeFixed(overrides: Partial<FixedEvent>): FixedEvent {
  return { title: "Event", confidence: 0.9, ...overrides };
}

function makeTask(overrides: Partial<FlexibleTask>): FlexibleTask {
  return { title: "Task", constraints: [], confidence: 0.8, ...overrides };
}

describe("Scheduler", () => {
  describe("fixed events", () => {
    it("schedules a single fixed event", () => {
      const { plan } = scheduleDay(
        [makeFixed({ title: "College", startTime: "9:00 AM", endTime: "5:00 PM" })],
        [],
        [],
        []
      );
      expect(plan.commitments).toHaveLength(1);
      expect(plan.commitments[0].title).toBe("College");
      expect(plan.commitments[0].locked).toBe(true);
    });

    it("schedules multiple fixed events chronologically", () => {
      const { plan } = scheduleDay(
        [
          makeFixed({ title: "Lunch", startTime: "12:00 PM", endTime: "1:00 PM" }),
          makeFixed({ title: "College", startTime: "9:00 AM", endTime: "11:00 AM" }),
        ],
        [],
        [],
        []
      );
      expect(plan.commitments[0].title).toBe("College");
      expect(plan.commitments[1].title).toBe("Lunch");
    });

    it("skips fixed events without time range", () => {
      const { plan } = scheduleDay(
        [makeFixed({ title: "Event" })],
        [],
        [],
        []
      );
      expect(plan.commitments).toHaveLength(0);
      expect(plan.warnings).toHaveLength(1);
    });
  });

  describe("flexible tasks", () => {
    it("places a task after fixed events", () => {
      const { plan } = scheduleDay(
        [makeFixed({ title: "College", startTime: "9:00 AM", endTime: "5:00 PM" })],
        [makeTask({ title: "Gym" })],
        [],
        []
      );
      expect(plan.commitments).toHaveLength(2);
      expect(plan.commitments[1].title).toBe("Gym");
      expect(plan.commitments[1].locked).toBe(false);
    });

    it("does not overlap flexible tasks with fixed events", () => {
      const { plan } = scheduleDay(
        [makeFixed({ title: "College", startTime: "9:00 AM", endTime: "5:00 PM" })],
        [makeTask({ title: "Gym" })],
        [],
        []
      );
      const college = plan.commitments.find(c => c.title === "College")!;
      const gym = plan.commitments.find(c => c.title === "Gym")!;
      expect(college.startTime).toBe("9:00 AM");
      expect(college.endTime).toBe("5:00 PM");
      // Gym should be after 5:00 PM
      const gymStart = gym.startTime;
      expect(gymStart.includes("PM")).toBe(true);
    });

    it("puts tasks in unscheduled when no free window fits", () => {
      const { plan } = scheduleDay(
        [makeFixed({ title: "College", startTime: "6:00 AM", endTime: "11:30 PM" })],
        [makeTask({ title: "Gym", estimatedMinutes: 60 })],
        [],
        []
      );
      expect(plan.unscheduled.some(u => u.title === "Gym")).toBe(true);
    });
  });

  describe("constraints", () => {
    it("respects before constraint", () => {
      const { plan } = scheduleDay(
        [],
        [makeTask({ title: "Exercise", constraints: [{ type: "before", target: "dinner" }] })],
        [],
        []
      );
      const exercise = plan.commitments.find(c => c.title === "Exercise");
      expect(exercise).toBeDefined();
      // Should end before 7 PM (dinner)
      const endHour = parseInt(exercise!.endTime.split(":")[0]);
      const isPM = exercise!.endTime.includes("PM");
      const end24 = isPM && endHour !== 12 ? endHour + 12 : endHour;
      expect(end24).toBeLessThanOrEqual(19);
    });

    it("respects afternoon constraint", () => {
      const { plan } = scheduleDay(
        [],
        [makeTask({ title: "Study", constraints: [{ type: "afternoon" }] })],
        [],
        []
      );
      const study = plan.commitments.find(c => c.title === "Study");
      expect(study).toBeDefined();
      const startHour = parseInt(study!.startTime.split(":")[0]);
      const isPM = study!.startTime.includes("PM");
      const start24 = isPM && startHour !== 12 ? startHour + 12 : startHour;
      expect(start24).toBeGreaterThanOrEqual(12);
    });
  });

  describe("plan structure", () => {
    it("has greeting and summary", () => {
      const { plan } = scheduleDay([], [], [], []);
      expect(plan.greeting).toBeTruthy();
      expect(plan.summary.length).toBeGreaterThan(0);
    });

    it("sorts commitments chronologically", () => {
      const { plan } = scheduleDay(
        [
          makeFixed({ title: "Dinner", startTime: "7:00 PM", endTime: "8:00 PM" }),
          makeFixed({ title: "College", startTime: "9:00 AM", endTime: "5:00 PM" }),
        ],
        [],
        [],
        []
      );
      const times = plan.commitments.map(c => {
        const h = parseInt(c.startTime.split(":")[0]);
        const isPM = c.startTime.includes("PM");
        return isPM && h !== 12 ? h + 12 : h;
      });
      for (let i = 1; i < times.length; i++) {
        expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
      }
    });

    it("has no overlapping commitments", () => {
      const { plan } = scheduleDay(
        [makeFixed({ title: "College", startTime: "9:00 AM", endTime: "5:00 PM" })],
        [makeTask({ title: "Gym" }), makeTask({ title: "Study" })],
        [],
        []
      );
      for (let i = 0; i < plan.commitments.length; i++) {
        for (let j = i + 1; j < plan.commitments.length; j++) {
          const parse = (t: string) => {
            const match = t.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
            if (!match) return 0;
            let h = parseInt(match[1], 10);
            const m = match[2] ? parseInt(match[2], 10) : 0;
            const p = match[3]?.toUpperCase();
            if (p === "PM" && h !== 12) h += 12;
            if (p === "AM" && h === 12) h = 0;
            return h + m / 60;
          };
          const startA = parse(plan.commitments[i].startTime);
          const endA = parse(plan.commitments[i].endTime);
          const startB = parse(plan.commitments[j].startTime);
          const endB = parse(plan.commitments[j].endTime);
          expect(startA < endB && startB < endA).toBe(false);
        }
      }
    });
  });

  describe("empty inputs", () => {
    it("handles no events and no tasks", () => {
      const { plan } = scheduleDay([], [], [], []);
      expect(plan.commitments).toHaveLength(0);
      expect(plan.unscheduled).toHaveLength(0);
    });
  });
});
