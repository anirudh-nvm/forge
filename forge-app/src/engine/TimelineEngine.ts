import type { TimelineEvent } from "../types/events";
import type { TodayPlan } from "../types/todayPlan";
import type { Adjustment } from "./AdjustmentEngine";
import { StorageEngine } from "../storage/StorageEngine";

let timelineEvents: TimelineEvent[] = [];
let loaded = false;

function generateId(): string {
  return `tl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function persist(): void {
  StorageEngine.saveTimeline(timelineEvents).catch(() => {});
}

export async function loadTimeline(): Promise<void> {
  if (loaded) return;
  timelineEvents = await StorageEngine.loadTimeline();
  loaded = true;
}

export function resetTimeline(): void {
  timelineEvents = [];
  loaded = false;
  StorageEngine.clearTimeline().catch(() => {});
}

export function getTimeline(): readonly TimelineEvent[] {
  return timelineEvents;
}

export function addTimelineEvent(event: Omit<TimelineEvent, "id" | "timestamp">): TimelineEvent {
  const entry: TimelineEvent = {
    id: generateId(),
    timestamp: new Date(),
    ...event,
  };
  timelineEvents.push(entry);
  persist();
  return entry;
}

export function recordPlanCreated(plan: TodayPlan): void {
  addTimelineEvent({
    type: "planCreated",
    title: "Created Plan",
    details: `${plan.commitments.length} commitments scheduled`,
  });
}

export function recordAdjustment(adjustment: Adjustment, commitmentTitle: string, oldTime?: string, newTime?: string): void {
  const typeMap: Record<Adjustment["type"], TimelineEvent["type"]> = {
    moveEarlier: "movedEarlier",
    moveLater: "movedLater",
    delete: "deleted",
    addTask: "added",
    updateDuration: "durationUpdated",
    lock: "locked",
    unlock: "unlocked",
  };

  const details = oldTime && newTime
    ? `${oldTime} → ${newTime}`
    : undefined;

  addTimelineEvent({
    type: typeMap[adjustment.type],
    commitmentId: adjustment.type === "addTask" ? adjustment.title.toLowerCase().replace(/\s+/g, "-") : (adjustment as { taskId?: string }).taskId,
    title: commitmentTitle,
    details,
  });
}

export function recordCompleted(commitmentId: string, title: string): void {
  addTimelineEvent({
    type: "completed",
    commitmentId,
    title: `Completed ${title}`,
  });
}

export function recordSkipped(commitmentId: string, title: string): void {
  addTimelineEvent({
    type: "skipped",
    commitmentId,
    title: `Skipped ${title}`,
  });
}

export function recordStarted(commitmentId: string, title: string): void {
  addTimelineEvent({
    type: "started",
    commitmentId,
    title: `Started ${title}`,
  });
}
