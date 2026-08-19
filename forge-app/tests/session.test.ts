import { describe, it, expect } from "vitest";
import { getSessionState, getTimeUntilSession, getTimeRemainingInSession, formatDuration, formatCountdown } from "../src/engine/SessionEngine";
import type { Session } from "../src/types/todayPlan";

function makeSession(overrides: Partial<Session>): Session {
  return {
    id: "test",
    title: "Test",
    scheduledStart: "9:00 AM",
    scheduledEnd: "10:00 AM",
    status: "scheduled",
    durationMinutes: 60,
    message: [],
    isProtected: false,
    ...overrides,
  };
}

function makeTime(hours: number, minutes: number): Date {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

describe("SessionEngine", () => {
  describe("getSessionState", () => {
    it("before start → waiting", () => {
      const session = makeSession({ scheduledStart: "9:00 AM", scheduledEnd: "10:00 AM" });
      expect(getSessionState(session, makeTime(8, 0))).toBe("waiting");
    });

    it("at start → active", () => {
      const session = makeSession({ scheduledStart: "9:00 AM", scheduledEnd: "10:00 AM" });
      expect(getSessionState(session, makeTime(9, 0))).toBe("active");
    });

    it("between start and end → active", () => {
      const session = makeSession({ scheduledStart: "9:00 AM", scheduledEnd: "10:00 AM" });
      expect(getSessionState(session, makeTime(9, 30))).toBe("active");
    });

    it("at end with active status → missed", () => {
      const session = makeSession({ scheduledStart: "9:00 AM", scheduledEnd: "10:00 AM", status: "active" });
      expect(getSessionState(session, makeTime(10, 0))).toBe("missed");
    });

    it("at end with completed status → completed", () => {
      const session = makeSession({ scheduledStart: "9:00 AM", scheduledEnd: "10:00 AM", status: "completed" });
      expect(getSessionState(session, makeTime(10, 0))).toBe("completed");
    });

    it("completed status mid-window → completed (not active)", () => {
      const session = makeSession({ scheduledStart: "9:00 AM", scheduledEnd: "10:00 AM", status: "completed" });
      expect(getSessionState(session, makeTime(9, 30))).toBe("completed");
    });

    it("skipped status mid-window → completed so outcome screen shows", () => {
      const session = makeSession({ scheduledStart: "9:00 AM", scheduledEnd: "10:00 AM", status: "completed", outcome: "skipped" });
      expect(getSessionState(session, makeTime(9, 15))).toBe("completed");
    });

    it("missed status mid-window → missed", () => {
      const session = makeSession({ scheduledStart: "9:00 AM", scheduledEnd: "10:00 AM", status: "missed" });
      expect(getSessionState(session, makeTime(9, 30))).toBe("missed");
    });

    it("after end → missed", () => {
      const session = makeSession({ scheduledStart: "9:00 AM", scheduledEnd: "10:00 AM" });
      expect(getSessionState(session, makeTime(11, 0))).toBe("missed");
    });
  });

  describe("getTimeUntilSession", () => {
    it("returns minutes until start", () => {
      const session = makeSession({ scheduledStart: "9:00 AM" });
      expect(getTimeUntilSession(session, makeTime(8, 0))).toBe(60);
    });

    it("returns 0 when already started", () => {
      const session = makeSession({ scheduledStart: "9:00 AM" });
      expect(getTimeUntilSession(session, makeTime(9, 0))).toBe(0);
      expect(getTimeUntilSession(session, makeTime(10, 0))).toBe(0);
    });
  });

  describe("getTimeRemainingInSession", () => {
    it("returns minutes until end", () => {
      const session = makeSession({ scheduledEnd: "10:00 AM" });
      expect(getTimeRemainingInSession(session, makeTime(9, 0))).toBe(60);
    });

    it("returns 0 when past end", () => {
      const session = makeSession({ scheduledEnd: "10:00 AM" });
      expect(getTimeRemainingInSession(session, makeTime(10, 0))).toBe(0);
      expect(getTimeRemainingInSession(session, makeTime(11, 0))).toBe(0);
    });
  });

  describe("formatDuration", () => {
    it("hours only", () => {
      expect(formatDuration(60)).toBe("1 hours");
      expect(formatDuration(120)).toBe("2 hours");
    });

    it("minutes only", () => {
      expect(formatDuration(30)).toBe("30 minutes");
    });

    it("hours and minutes", () => {
      expect(formatDuration(90)).toBe("1 hours 30 minutes");
    });
  });

  describe("formatCountdown", () => {
    it("0 → now", () => {
      expect(formatCountdown(0)).toBe("now");
    });

    it("negative → now", () => {
      expect(formatCountdown(-5)).toBe("now");
    });

    it("minutes only", () => {
      expect(formatCountdown(30)).toBe("30 min");
    });

    it("hours only", () => {
      expect(formatCountdown(60)).toBe("1h");
    });

    it("hours and minutes", () => {
      expect(formatCountdown(90)).toBe("1h 30m");
    });
  });
});
