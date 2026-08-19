import type { Commitment } from "./commitment";
import type { TimelineItem } from "./timeline";
import type { CalendarEvent } from "./calendar";

export type PlanStatus = "draft" | "active" | "completed" | "archived";

export type TodayPlan = {
  greeting: string;
  summary: string[];
  commitments: Commitment[];
  timeline: TimelineItem[];
  unscheduled: UnscheduledItem[];
  warnings: string[];
  recommendation: string;
  status: PlanStatus;
  calendarEvents?: CalendarEvent[];
};

export type UnscheduledItem = {
  title: string;
  reason: string;
};

export type SessionStatus = "scheduled" | "waiting" | "active" | "completed" | "missed";

export type SessionOutcome = "completed" | "mostlyCompleted" | "notCompleted" | "skipped";

export type Session = {
  id: string;
  title: string;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart?: string;
  actualEnd?: string;
  status: SessionStatus;
  outcome?: SessionOutcome;
  durationMinutes: number;
  message: string[];
  isProtected: boolean;
};

export type TrustEvent = {
  sessionId: string;
  outcome: SessionOutcome;
  isProtected: boolean;
  trustChange: number;
  timestamp: Date;
};

export type TrustScore = {
  current: number;
  history: TrustEvent[];
};
