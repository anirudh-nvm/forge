import * as Calendar from "expo-calendar";
import type { CalendarEvent, CalendarPattern, CalendarRecurrence, CalendarSyncResult } from "../types/calendar";
import type { Commitment } from "../types/commitment";

function formatDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatTime(date: Date): string {
  let h = date.getHours();
  const m = date.getMinutes();
  const period = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return m > 0 ? `${h}:${String(m).padStart(2, "0")} ${period}` : `${h}:00 ${period}`;
}

function mapRecurrence(rule: Calendar.RecurrenceRule | null): CalendarRecurrence {
  if (!rule) return null;
  switch (rule.frequency) {
    case Calendar.Frequency.DAILY:
      return "daily";
    case Calendar.Frequency.WEEKLY:
      return "weekly";
    case Calendar.Frequency.MONTHLY:
      return "monthly";
    case Calendar.Frequency.YEARLY:
      return "yearly";
    default:
      return null;
  }
}

function parseDate(val: string | Date): Date {
  if (val instanceof Date) return val;
  return new Date(val);
}

export async function requestPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissions();
  return status === "granted";
}

export async function checkPermission(): Promise<boolean> {
  const { status } = await Calendar.getCalendarPermissions();
  return status === "granted";
}

export async function readEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
  const hasPermission = await checkPermission();
  if (!hasPermission) return [];

  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  const calIds = calendars.map((c) => c.id);

  if (calIds.length === 0) return [];

  const rawEvents = await Calendar.listEvents(calIds, start, end);

  return rawEvents.map((e) => ({
    id: e.id,
    calendarId: e.calendarId,
    title: e.title || "(untitled)",
    startDate: parseDate(e.startDate),
    endDate: parseDate(e.endDate),
    allDay: e.allDay,
    location: e.location ?? undefined,
    notes: e.notes ?? undefined,
    recurrence: mapRecurrence(e.recurrenceRule),
  }));
}

export async function readTodaysEvents(): Promise<CalendarEvent[]> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  return readEvents(startOfDay, endOfDay);
}

export async function readWeekEvents(): Promise<CalendarEvent[]> {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
  const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
  return readEvents(startOfWeek, endOfWeek);
}

export function detectPatterns(events: CalendarEvent[]): CalendarPattern[] {
  const byTitle = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    if (e.allDay) continue;
    const key = e.title.toLowerCase().trim();
    const list = byTitle.get(key) ?? [];
    list.push(e);
    byTitle.set(key, list);
  }

  const patterns: CalendarPattern[] = [];
  const today = formatDateKey(new Date());

  for (const [title, group] of byTitle) {
    const recurring = group.filter((e) => e.recurrence === "weekly" || e.recurrence === "daily");
    if (recurring.length === 0) continue;

    const dayOfWeek = [...new Set(recurring.map((e) => e.startDate.getDay()))];
    const startTime = formatTime(recurring[0].startDate);
    const endTime = formatTime(recurring[0].endDate);

    patterns.push({
      title: recurring[0].title,
      dayOfWeek,
      startTime,
      endTime,
      occurrences: recurring.length,
      firstSeen: today,
      lastSeen: today,
    });
  }

  return patterns;
}

export function mapToCommitment(event: CalendarEvent): Commitment {
  const startTime = event.allDay ? "12:00 AM" : formatTime(event.startDate);
  const endTime = event.allDay ? "11:59 PM" : formatTime(event.endDate);

  const id = `cal-${event.id}`;
  const title = event.title || "(untitled)";

  return {
    id,
    title,
    startTime,
    endTime,
    completed: false,
    locked: true,
    priority: "high",
    note: event.location ? `@ ${event.location}` : undefined,
  };
}

export async function syncCalendar(): Promise<CalendarSyncResult> {
  const events = await readTodaysEvents();
  const weekEvents = await readWeekEvents();
  const patterns = detectPatterns(weekEvents);

  return {
    events,
    patterns,
    syncedAt: new Date().toISOString(),
  };
}
