import * as Notifications from "expo-notifications";
import type { Commitment } from "../types/commitment";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function parseTimeToMinutes(timeStr: string): number {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return -1;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function scheduledDate(timeStr: string): Date {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const minutes = parseTimeToMinutes(timeStr);
  if (minutes < 0) return today;
  return new Date(today.getTime() + minutes * 60 * 1000);
}

export async function requestPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function hasPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

export async function scheduleCommitmentReminder(
  commitment: Commitment
): Promise<string | null> {
  const has = await hasPermission();
  if (!has) return null;

  const triggerDate = scheduledDate(commitment.startTime);
  if (triggerDate.getTime() <= Date.now()) return null;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "it's time.",
      body: `${commitment.title} starts now.`,
      data: { commitmentId: commitment.id, type: "commitment_start" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  return id;
}

export async function scheduleFollowUp(
  commitment: Commitment
): Promise<string | null> {
  const has = await hasPermission();
  if (!has) return null;

  const triggerDate = scheduledDate(commitment.endTime);
  if (triggerDate.getTime() <= Date.now()) return null;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "how did it go?",
      body: `did you complete ${commitment.title.toLowerCase()}?`,
      data: { commitmentId: commitment.id, type: "follow_up" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  return id;
}

export async function scheduleMorningBrief(
  summary: string
): Promise<string | null> {
  const has = await hasPermission();
  if (!has) return null;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "good morning.",
      body: summary || "your day is ready. take a look.",
      data: { type: "morning_brief" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 8,
      minute: 0,
    },
  });

  return id;
}

export async function schedulePlanReminders(
  commitments: Commitment[]
): Promise<void> {
  await cancelAllScheduled();

  for (const c of commitments) {
    await scheduleCommitmentReminder(c);
    await scheduleFollowUp(c);
  }
}

export async function cancelAllScheduled(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function cancelById(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
}

export async function getAllScheduled(): Promise<Notifications.NotificationRequest[]> {
  return Notifications.getAllScheduledNotificationsAsync();
}
