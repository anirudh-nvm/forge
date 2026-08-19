import type { TodayPlan, Session } from "../types/todayPlan";
import { StorageEngine } from "../storage/StorageEngine";

export type DayArchive = {
  date: string;
  plan: TodayPlan;
  sessions: Session[];
  trustScoreAtEnd: number;
};

export type LifecycleState = {
  isSameDay: boolean;
  lastActiveDate: string | null;
  hasActiveSession: boolean;
  activeSession: Session | null;
  hasPlan: boolean;
  todaysPlan: TodayPlan | null;
};

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function isNewDay(lastActiveDate: string | null, currentTime: Date): boolean {
  if (!lastActiveDate) return true;
  const today = formatDate(currentTime);
  return lastActiveDate !== today;
}

export async function checkLifecycleState(currentTime: Date): Promise<LifecycleState> {
  const lastActiveDate = await StorageEngine.getLastActiveDate();
  const isSameDay = !isNewDay(lastActiveDate, currentTime);
  const todaysPlan = isSameDay ? await StorageEngine.loadTodayPlan() : null;
  const activeSession = await StorageEngine.loadCurrentSession();
  const hasActiveSession = activeSession !== null && activeSession.status === "active";

  return {
    isSameDay,
    lastActiveDate,
    hasActiveSession,
    activeSession,
    hasPlan: todaysPlan !== null,
    todaysPlan,
  };
}

export async function archiveYesterday(
  plan: TodayPlan | null,
  sessions: Session[],
  trustScore: number
): Promise<void> {
  if (!plan) return;

  const lastActiveDate = await StorageEngine.getLastActiveDate();
  if (!lastActiveDate) return;

  const archive: DayArchive = {
    date: lastActiveDate,
    plan,
    sessions,
    trustScoreAtEnd: trustScore,
  };

  await StorageEngine.saveDayArchive(archive);
}

export async function startNewDay(): Promise<void> {
  await StorageEngine.clearTodayPlan();
  await StorageEngine.clearCurrentSession();
  await StorageEngine.setLastActiveDate(formatDate(new Date()));
}

export async function resumeSession(session: Session): Promise<Session> {
  return {
    ...session,
    status: "active" as const,
    actualStart: session.actualStart || new Date().toISOString(),
  };
}

export async function completeAbandonedSession(
  session: Session
): Promise<Session> {
  if (session.status === "active") {
    return {
      ...session,
      status: "completed" as const,
      outcome: "notCompleted",
      actualEnd: new Date().toISOString(),
    };
  }
  return session;
}

export function getRecoveryMessage(session: Session): string {
  const title = session.title.toLowerCase();
  return `looks like you left during ${title}. here's where today stands.`;
}

export function getMorningGreeting(time: Date): string {
  const hour = time.getHours();

  if (hour < 12) return "good morning";
  if (hour < 17) return "good afternoon";
  return "good evening";
}
