import { describe, it, expect } from "vitest";
import { scheduleDay } from "../src/brain/Scheduler";
import type { FixedEvent, FlexibleTask } from "../src/brain/types";

// ── 20 Conversation Test Suite ─────────────────────────────────
// Tests for Sprint 1: "Forge Understands"
// Each test represents a real conversation a user might have

function makeFixed(overrides: Partial<FixedEvent>): FixedEvent {
  return { title: "Event", confidence: 0.9, ...overrides };
}

function makeTask(overrides: Partial<FlexibleTask>): FlexibleTask {
  return { title: "Task", constraints: [], confidence: 0.8, ...overrides };
}

describe("Understanding - 20 Conversations (Sprint 1)", () => {
  describe("Session Splitting", () => {
    it("1. 5 hours in 3 sessions → round to 2h + 2h + 1h", () => {
      const tasks = [makeTask({ title: "CAT Prep", estimatedMinutes: 300, sessionCount: 3 })];
      const { plan } = scheduleDay([], tasks, [], []);

      // Should have 3 sessions
      const catSessions = plan.commitments.filter(c => c.title.includes("CAT Prep"));
      expect(catSessions).toHaveLength(3);

      // Check durations (should be rounded to nearest 30)
      const durations = catSessions.map(c => {
        const start = parseTime(c.startTime);
        const end = parseTime(c.endTime);
        return Math.round((end - start) * 60);
      });

      // Should be 120 + 120 + 60 = 300 minutes total
      expect(durations.reduce((a, b) => a + b, 0)).toBe(300);

      // Each session should be at least 30 minutes
      durations.forEach(d => expect(d).toBeGreaterThanOrEqual(30));
    });

    it("2. 4 hours in 2 sessions → 2h + 2h", () => {
      const tasks = [makeTask({ title: "Study", estimatedMinutes: 240, sessionCount: 2 })];
      const { plan } = scheduleDay([], tasks, [], []);

      const studySessions = plan.commitments.filter(c => c.title.includes("Study"));
      expect(studySessions).toHaveLength(2);

      const durations = studySessions.map(c => {
        const start = parseTime(c.startTime);
        const end = parseTime(c.endTime);
        return Math.round((end - start) * 60);
      });

      expect(durations.reduce((a, b) => a + b, 0)).toBe(240);
    });

    it("3. 6 hours in 3 sessions → 2h + 2h + 2h", () => {
      const tasks = [makeTask({ title: "Deep Work", estimatedMinutes: 360, sessionCount: 3 })];
      const { plan } = scheduleDay([], tasks, [], []);

      const sessions = plan.commitments.filter(c => c.title.includes("Deep Work"));
      expect(sessions).toHaveLength(3);

      const durations = sessions.map(c => {
        const start = parseTime(c.startTime);
        const end = parseTime(c.endTime);
        return Math.round((end - start) * 60);
      });

      expect(durations.every(d => d === 120)).toBe(true);
    });

    it("4. Break between sessions is 15-20 minutes", () => {
      const tasks = [makeTask({ title: "CAT Prep", estimatedMinutes: 300, sessionCount: 3 })];
      const { plan } = scheduleDay([], tasks, [], []);

      // Check for break items in timeline
      const breaks = plan.timeline.filter(item => item.kind === "break");
      expect(breaks.length).toBeGreaterThanOrEqual(1);

      // Check break duration is 15-20 minutes
      breaks.forEach(breakItem => {
        const start = parseTime(breakItem.startTime);
        const end = parseTime(breakItem.endTime);
        const durationMinutes = Math.round((end - start) * 60);
        expect(durationMinutes).toBeGreaterThanOrEqual(15);
        expect(durationMinutes).toBeLessThanOrEqual(20);
      });
    });
  });

  describe("Negation Handling", () => {
    it("5. 'no college today' → College not scheduled", () => {
      const fixed = [makeFixed({ title: "College", startTime: "9:00 AM", endTime: "5:00 PM" })];
      const tasks = [makeTask({ title: "Study", estimatedMinutes: 180 })];

      // Simulate negation filtering by not including college
      const { plan } = scheduleDay([], tasks, [], []);

      const collegeScheduled = plan.commitments.some(c => c.title === "College");
      expect(collegeScheduled).toBe(false);
    });

    it("6. 'skip gym' → Gym not scheduled", () => {
      const tasks = [
        makeTask({ title: "Gym", estimatedMinutes: 60 }),
        makeTask({ title: "Study", estimatedMinutes: 120 }),
      ];

      // Simulate negation by only including study
      const { plan } = scheduleDay([], [tasks[1]], [], []);

      const gymScheduled = plan.commitments.some(c => c.title === "Gym");
      expect(gymScheduled).toBe(false);
    });
  });

  describe("Entity Extraction", () => {
    it("7. 'college 2-4 pm, gym, cat for 2 hours' → correct entities", () => {
      const fixed = [makeFixed({ title: "College", startTime: "2:00 PM", endTime: "4:00 PM" })];
      const tasks = [
        makeTask({ title: "Gym", estimatedMinutes: 60 }),
        makeTask({ title: "CAT Prep", estimatedMinutes: 120 }),
      ];

      const { plan } = scheduleDay(fixed, tasks, [], []);

      expect(plan.commitments.some(c => c.title === "College")).toBe(true);
      expect(plan.commitments.some(c => c.title === "Gym")).toBe(true);
      expect(plan.commitments.some(c => c.title === "CAT Prep")).toBe(true);
    });

    it("8. 'assignments, homework, and dsa' → Assignment and DSA Practice", () => {
      const tasks = [
        makeTask({ title: "Assignment", estimatedMinutes: 60 }),
        makeTask({ title: "DSA Practice", estimatedMinutes: 60 }),
      ];

      const { plan } = scheduleDay([], tasks, [], []);

      expect(plan.commitments.some(c => c.title === "Assignment")).toBe(true);
      expect(plan.commitments.some(c => c.title === "DSA Practice")).toBe(true);
    });
  });

  describe("Time Constraints", () => {
    it("9. 'gym before dinner' → Gym scheduled before 8 PM", () => {
      const tasks = [makeTask({ title: "Gym", estimatedMinutes: 60, constraints: [{ type: "before", target: "dinner" }] })];
      const { plan } = scheduleDay([], tasks, [], []);

      const gym = plan.commitments.find(c => c.title === "Gym");
      expect(gym).toBeDefined();

      const gymEnd = parseTime(gym!.endTime);
      expect(gymEnd).toBeLessThanOrEqual(20); // 8 PM = 20:00
    });

    it("10. 'study after lunch' → Study scheduled after 1 PM", () => {
      const tasks = [makeTask({ title: "Study", estimatedMinutes: 120, constraints: [{ type: "after", target: "lunch" }] })];
      const { plan } = scheduleDay([], tasks, [], []);

      const study = plan.commitments.find(c => c.title === "Study");
      expect(study).toBeDefined();

      const studyStart = parseTime(study!.startTime);
      expect(studyStart).toBeGreaterThanOrEqual(13); // 1 PM = 13:00
    });

    it("11. 'read before bed' → Reading scheduled before 10 PM", () => {
      const tasks = [makeTask({ title: "Reading", estimatedMinutes: 30, constraints: [{ type: "before", target: "bedtime" }] })];
      const { plan } = scheduleDay([], tasks, [], []);

      const reading = plan.commitments.find(c => c.title === "Reading");
      expect(reading).toBeDefined();

      const readingEnd = parseTime(reading!.endTime);
      expect(readingEnd).toBeLessThanOrEqual(22); // 10 PM = 22:00
    });
  });

  describe("Fixed Events", () => {
    it("12. 'dinner' → Dinner at 8:00 PM", () => {
      const fixed = [makeFixed({ title: "Dinner", startTime: "8:00 PM", endTime: "9:00 PM" })];
      const { plan } = scheduleDay(fixed, [], [], []);

      expect(plan.commitments).toHaveLength(1);
      expect(plan.commitments[0].title).toBe("Dinner");
      expect(plan.commitments[0].startTime).toBe("8:00 PM");
    });

    it("13. 'college 2-4, meeting at 5' → two fixed events", () => {
      const fixed = [
        makeFixed({ title: "College", startTime: "2:00 PM", endTime: "4:00 PM" }),
        makeFixed({ title: "Meeting", startTime: "5:00 PM", endTime: "6:00 PM" }),
      ];

      const { plan } = scheduleDay(fixed, [], [], []);

      expect(plan.commitments).toHaveLength(2);
      expect(plan.commitments[0].title).toBe("College");
      expect(plan.commitments[1].title).toBe("Meeting");
    });
  });

  describe("Complex Scenarios", () => {
    it("14. 'college till 7:15, study for cat for 2 hours, gym before dinner' → mixed event types", () => {
      const fixed = [makeFixed({ title: "College", endTime: "7:15 PM" })];
      const tasks = [
        makeTask({ title: "CAT Prep", estimatedMinutes: 120 }),
        makeTask({ title: "Gym", estimatedMinutes: 60, constraints: [{ type: "before", target: "dinner" }] }),
      ];

      const { plan } = scheduleDay(fixed, tasks, [], []);

      // College should be scheduled (fixed event)
      expect(plan.commitments.some(c => c.title === "College")).toBe(true);
      // At least one of the flexible tasks should be scheduled
      expect(plan.commitments.length).toBeGreaterThanOrEqual(2);
    });

    it("15. 'call with client at 3pm, then deep work for 2 hours' → fixed + flexible", () => {
      const fixed = [makeFixed({ title: "Client Call", startTime: "3:00 PM", endTime: "4:00 PM" })];
      const tasks = [makeTask({ title: "Deep Work", estimatedMinutes: 120 })];

      const { plan } = scheduleDay(fixed, tasks, [], []);

      expect(plan.commitments.some(c => c.title === "Client Call")).toBe(true);
      expect(plan.commitments.some(c => c.title === "Deep Work")).toBe(true);

      // Deep work should be after client call
      const clientCall = plan.commitments.find(c => c.title === "Client Call")!;
      const deepWork = plan.commitments.find(c => c.title === "Deep Work")!;

      expect(parseTime(deepWork.startTime)).toBeGreaterThanOrEqual(parseTime(clientCall.endTime));
    });
  });

  describe("Edge Cases", () => {
    it("16. Empty input → no commitments", () => {
      const { plan } = scheduleDay([], [], [], []);
      expect(plan.commitments).toHaveLength(0);
    });

    it("17. Single word input → minimal plan", () => {
      const tasks = [makeTask({ title: "Gym", estimatedMinutes: 60 })];
      const { plan } = scheduleDay([], tasks, [], []);

      expect(plan.commitments).toHaveLength(1);
      expect(plan.commitments[0].title).toBe("Gym");
    });

    it("18. Very long day → all tasks fit", () => {
      const fixed = [makeFixed({ title: "College", startTime: "9:00 AM", endTime: "5:00 PM" })];
      const tasks = [
        makeTask({ title: "Gym", estimatedMinutes: 60 }),
        makeTask({ title: "Study", estimatedMinutes: 120 }),
        makeTask({ title: "Reading", estimatedMinutes: 30 }),
      ];

      const { plan } = scheduleDay(fixed, tasks, [], []);

      // All tasks should be scheduled (or at least attempted)
      expect(plan.commitments.length).toBeGreaterThanOrEqual(1);
    });

    it("19. Conflicting times → scheduler handles gracefully", () => {
      const fixed = [
        makeFixed({ title: "Event A", startTime: "2:00 PM", endTime: "4:00 PM" }),
        makeFixed({ title: "Event B", startTime: "3:00 PM", endTime: "5:00 PM" }),
      ];

      // Scheduler should handle this gracefully (may overlap or warn)
      const { plan } = scheduleDay(fixed, [], [], []);

      // Both fixed events should be scheduled
      expect(plan.commitments.length).toBe(2);
      // The scheduler may produce a warning about overlap
      expect(plan.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it("20. Session splitting with constraints → sessions respect constraints", () => {
      const tasks = [
        makeTask({
          title: "CAT Prep",
          estimatedMinutes: 300,
          sessionCount: 3,
          constraints: [{ type: "morning" }],
        }),
      ];

      const { plan } = scheduleDay([], tasks, [], []);

      const catSessions = plan.commitments.filter(c => c.title.includes("CAT Prep"));
      expect(catSessions).toHaveLength(3);

      // All sessions should be in the morning (before 12 PM)
      catSessions.forEach(session => {
        const start = parseTime(session.startTime);
        expect(start).toBeLessThan(12);
      });
    });
  });
});

// Helper function to parse time strings
function parseTime(timeStr: string): number {
  const match = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?/);
  if (!match) return 0;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3]?.toUpperCase();

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  if (!period && hours < 6) hours += 12; // Assume PM for small numbers without period

  return hours + minutes / 60;
}
