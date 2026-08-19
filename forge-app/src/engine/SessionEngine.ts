import type { Session, SessionStatus } from "../types/todayPlan";
import { parseTimeToMinutes as parseTime } from "../utils/timeUtils";

function getCurrentMinutes(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function getSessionState(session: Session, currentTime: Date): SessionStatus {
  if (session.status === "completed") return "completed";
  if (session.status === "missed") return "missed";

  const currentMinutes = getCurrentMinutes(currentTime);
  const startMinutes = parseTime(session.scheduledStart);
  const endMinutes = parseTime(session.scheduledEnd);

  if (currentMinutes >= endMinutes) {
    return "missed";
  }

  if (currentMinutes >= startMinutes) {
    return "active";
  }

  return "waiting";
}

export function getTimeUntilSession(session: Session, currentTime: Date): number {
  const currentMinutes = getCurrentMinutes(currentTime);
  const startMinutes = parseTime(session.scheduledStart);

  return Math.max(0, startMinutes - currentMinutes);
}

export function getTimeRemainingInSession(session: Session, currentTime: Date): number {
  const currentMinutes = getCurrentMinutes(currentTime);
  const endMinutes = parseTime(session.scheduledEnd);

  return Math.max(0, endMinutes - currentMinutes);
}

export function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hrs === 0) return `${mins} minutes`;
  if (mins === 0) return `${hrs} hours`;
  return `${hrs} hours ${mins} minutes`;
}

export function formatCountdown(minutes: number): string {
  if (minutes <= 0) return "now";

  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}
