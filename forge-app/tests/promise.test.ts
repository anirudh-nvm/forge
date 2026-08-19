import { describe, it, expect } from "vitest";
import { determineOutcome, getOutcomeLabel, getOutcomeMessage } from "../src/engine/PromiseEngine";
import type { Session } from "../src/types/todayPlan";

function makeSession(overrides: Partial<Session>): Session {
  return {
    id: "test",
    title: "Test",
    scheduledStart: "9:00 AM",
    scheduledEnd: "10:00 AM",
    status: "active",
    durationMinutes: 60,
    message: [],
    isProtected: false,
    ...overrides,
  };
}

describe("PromiseEngine", () => {
  describe("determineOutcome", () => {
    it("missed session → skipped", () => {
      const session = makeSession({ status: "missed" });
      expect(determineOutcome(session, true, 100)).toBe("skipped");
    });

    it("completed + progress >= 90 → completed", () => {
      const session = makeSession({ status: "active" });
      expect(determineOutcome(session, true, 90)).toBe("completed");
      expect(determineOutcome(session, true, 100)).toBe("completed");
    });

    it("completed + progress >= 50 → mostlyCompleted", () => {
      const session = makeSession({ status: "active" });
      expect(determineOutcome(session, true, 50)).toBe("mostlyCompleted");
      expect(determineOutcome(session, true, 89)).toBe("mostlyCompleted");
    });

    it("completed + progress < 50 → notCompleted", () => {
      const session = makeSession({ status: "active" });
      expect(determineOutcome(session, true, 49)).toBe("notCompleted");
    });

    it("not completed + progress >= 70 → mostlyCompleted", () => {
      const session = makeSession({ status: "active" });
      expect(determineOutcome(session, false, 70)).toBe("mostlyCompleted");
    });

    it("not completed + progress < 70 → notCompleted", () => {
      const session = makeSession({ status: "active" });
      expect(determineOutcome(session, false, 69)).toBe("notCompleted");
      expect(determineOutcome(session, false, 0)).toBe("notCompleted");
    });
  });

  describe("getOutcomeLabel", () => {
    it("completed → kept", () => {
      expect(getOutcomeLabel("completed")).toBe("kept");
    });

    it("mostlyCompleted → mostly kept", () => {
      expect(getOutcomeLabel("mostlyCompleted")).toBe("mostly kept");
    });

    it("notCompleted → not kept", () => {
      expect(getOutcomeLabel("notCompleted")).toBe("not kept");
    });

    it("skipped → skipped", () => {
      expect(getOutcomeLabel("skipped")).toBe("skipped");
    });
  });

  describe("getOutcomeMessage", () => {
    it("returns message for each outcome", () => {
      expect(getOutcomeMessage("completed")).toContain("kept");
      expect(getOutcomeMessage("mostlyCompleted")).toContain("mostly");
      expect(getOutcomeMessage("notCompleted")).toContain("wasn't kept");
      expect(getOutcomeMessage("skipped")).toContain("skipped");
    });
  });
});
