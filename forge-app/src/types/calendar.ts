export type CalendarRecurrence = "daily" | "weekly" | "monthly" | "yearly" | null;

export type CalendarEvent = {
  id: string;
  calendarId: string;
  title: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  location?: string;
  notes?: string;
  recurrence: CalendarRecurrence;
};

export type CalendarPattern = {
  title: string;
  dayOfWeek: number[];
  startTime: string;
  endTime: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
};

export type CalendarSyncResult = {
  events: CalendarEvent[];
  patterns: CalendarPattern[];
  syncedAt: string;
};
