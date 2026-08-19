import type { TodayPlan } from "../types/todayPlan";
import type { Commitment, CommitmentPriority } from "../types/commitment";
import type { EngineEvent } from "../types/events";
import { parseTimeToDecimal as parseTime, formatTime, parseTimeToMinutes as timeToMinutes } from "../utils/timeUtils";
import { recordAdjustment } from "./TimelineEngine";

// ── Adjustment types (Phase 2) ───────────────────────────────────

export type MoveEarlier = {
  type: "moveEarlier";
  taskId: string;
  minutes?: number;
};

export type MoveLater = {
  type: "moveLater";
  taskId: string;
  minutes?: number;
};

export type Delete = {
  type: "delete";
  taskId: string;
};

export type AddTask = {
  type: "addTask";
  title: string;
  startTime: string;
  endTime: string;
  priority?: CommitmentPriority;
};

export type UpdateDuration = {
  type: "updateDuration";
  taskId: string;
  minutes: number;
};

export type LockCommitment = {
  type: "lock";
  taskId: string;
};

export type UnlockCommitment = {
  type: "unlock";
  taskId: string;
};

export type Adjustment =
  | MoveEarlier
  | MoveLater
  | Delete
  | AddTask
  | UpdateDuration
  | LockCommitment
  | UnlockCommitment;

export type AdjustmentResult = {
  plan: TodayPlan;
  events: EngineEvent[];
};

// ── Validation (Phase 7) ───────────────────────────────────────

function validatePlan(plan: TodayPlan): void {
  assertNoOverlap(plan);
  assertChronological(plan);
  assertNoDuplicateTimes(plan);
  assertNoDuplicateIds(plan);
}

function assertNoOverlap(plan: TodayPlan): void {
  for (let i = 0; i < plan.commitments.length; i++) {
    for (let j = i + 1; j < plan.commitments.length; j++) {
      const startA = timeToMinutes(plan.commitments[i].startTime);
      const endA = timeToMinutes(plan.commitments[i].endTime);
      const startB = timeToMinutes(plan.commitments[j].startTime);
      const endB = timeToMinutes(plan.commitments[j].endTime);
      if (startA < endB && startB < endA) {
        throw new Error(
          `${plan.commitments[i].title} overlaps ${plan.commitments[j].title}`
        );
      }
    }
  }
}

function assertChronological(plan: TodayPlan): void {
  for (let i = 1; i < plan.commitments.length; i++) {
    const prev = timeToMinutes(plan.commitments[i - 1].startTime);
    const curr = timeToMinutes(plan.commitments[i].startTime);
    if (curr < prev) {
      throw new Error(
        `"${plan.commitments[i].title}" is before "${plan.commitments[i - 1].title}"`
      );
    }
  }
}

function assertNoDuplicateTimes(plan: TodayPlan): void {
  const used = new Map<string, string>();
  for (const c of plan.commitments) {
    const key = `${c.startTime}-${c.endTime}`;
    if (used.has(key)) {
      throw new Error(`"${c.title}" has same time as "${used.get(key)}"`);
    }
    used.set(key, c.title);
  }
}

function assertNoDuplicateIds(plan: TodayPlan): void {
  const seen = new Set<string>();
  for (const c of plan.commitments) {
    if (seen.has(c.id)) {
      throw new Error(`Duplicate commitment id: "${c.id}"`);
    }
    seen.add(c.id);
  }
}

// ── Main API (Phase 1, 3) ──────────────────────────────────────

export function adjustPlan(plan: TodayPlan, adjustment: Adjustment): AdjustmentResult {
  const newPlan = structuredClone(plan);
  const events: EngineEvent[] = [];

  try {
    const result = (() => {
      switch (adjustment.type) {
        case "moveEarlier":
          return handleMoveEarlier(newPlan, adjustment, events);
        case "moveLater":
          return handleMoveLater(newPlan, adjustment, events);
        case "delete":
          return handleDelete(newPlan, adjustment, events);
        case "addTask":
          return handleAddTask(newPlan, adjustment, events);
        case "updateDuration":
          return handleUpdateDuration(newPlan, adjustment, events);
        case "lock":
          return handleLock(newPlan, adjustment, events);
        case "unlock":
          return handleUnlock(newPlan, adjustment, events);
      }
    })();

    return { plan: result, events };
  } catch {
    return { plan: structuredClone(plan), events: [] };
  }
}

// ── Handlers (Phase 3, 4, 5) ───────────────────────────────────

function handleMoveEarlier(plan: TodayPlan, adj: MoveEarlier, events: EngineEvent[]): TodayPlan {
  const commitment = plan.commitments.find(c => c.id === adj.taskId);
  if (!commitment) throw new Error(`Commitment "${adj.taskId}" not found`);
  if (commitment.locked) throw new Error(`Cannot move locked commitment "${commitment.title}"`);

  const minutes = adj.minutes || 60;
  const currentStart = timeToMinutes(commitment.startTime);
  const currentEnd = timeToMinutes(commitment.endTime);
  const duration = currentEnd - currentStart;
  const newStart = currentStart - minutes;
  const newEnd = newStart + duration;

  if (newStart < 0) throw new Error(`Cannot move "${commitment.title}" before midnight`);

  const oldTime = commitment.startTime;
  commitment.startTime = formatTime(newStart / 60);
  commitment.endTime = formatTime(newEnd / 60);

  validatePlan(plan);

  events.push({
    timestamp: new Date(),
    engine: "Adjustment",
    action: "Moved Earlier",
    metadata: { taskId: adj.taskId, from: oldTime, to: commitment.startTime, minutes },
  });
  recordAdjustment(adj, commitment.title, oldTime, commitment.startTime);

  return plan;
}

function handleMoveLater(plan: TodayPlan, adj: MoveLater, events: EngineEvent[]): TodayPlan {
  const commitment = plan.commitments.find(c => c.id === adj.taskId);
  if (!commitment) throw new Error(`Commitment "${adj.taskId}" not found`);
  if (commitment.locked) throw new Error(`Cannot move locked commitment "${commitment.title}"`);

  const minutes = adj.minutes || 60;
  const currentStart = timeToMinutes(commitment.startTime);
  const currentEnd = timeToMinutes(commitment.endTime);
  const duration = currentEnd - currentStart;
  const newStart = currentStart + minutes;
  const newEnd = newStart + duration;

  const oldTime = commitment.startTime;
  commitment.startTime = formatTime(newStart / 60);
  commitment.endTime = formatTime(newEnd / 60);

  validatePlan(plan);

  events.push({
    timestamp: new Date(),
    engine: "Adjustment",
    action: "Moved Later",
    metadata: { taskId: adj.taskId, from: oldTime, to: commitment.startTime, minutes },
  });
  recordAdjustment(adj, commitment.title, oldTime, commitment.startTime);

  return plan;
}

function handleDelete(plan: TodayPlan, adj: Delete, events: EngineEvent[]): TodayPlan {
  const commitment = plan.commitments.find(c => c.id === adj.taskId);
  if (!commitment) throw new Error(`Commitment "${adj.taskId}" not found`);
  if (commitment.locked) throw new Error(`Cannot delete locked commitment "${commitment.title}"`);

  plan.commitments = plan.commitments.filter(c => c.id !== adj.taskId);

  plan.unscheduled.push({
    title: commitment.title,
    reason: "deleted by user",
  });

  validatePlan(plan);

  events.push({
    timestamp: new Date(),
    engine: "Adjustment",
    action: "Deleted",
    metadata: { taskId: adj.taskId, title: commitment.title },
  });
  recordAdjustment(adj, commitment.title);

  return plan;
}

function handleAddTask(plan: TodayPlan, adj: AddTask, events: EngineEvent[]): TodayPlan {
  const id = adj.title.toLowerCase().replace(/\s+/g, "-");
  const existing = plan.commitments.find(c => c.id === id);
  if (existing) throw new Error(`Commitment "${adj.title}" already exists`);

  const newCommitment: Commitment = {
    id,
    title: adj.title,
    startTime: adj.startTime,
    endTime: adj.endTime,
    completed: false,
    locked: false,
    priority: adj.priority || "medium",
  };

  plan.commitments.push(newCommitment);

  plan.unscheduled = plan.unscheduled.filter(u => u.title !== adj.title);

  validatePlan(plan);

  events.push({
    timestamp: new Date(),
    engine: "Adjustment",
    action: "Added",
    metadata: { taskId: id, title: adj.title, startTime: adj.startTime, endTime: adj.endTime },
  });
  recordAdjustment(adj, adj.title);

  return plan;
}

function handleUpdateDuration(plan: TodayPlan, adj: UpdateDuration, events: EngineEvent[]): TodayPlan {
  const commitment = plan.commitments.find(c => c.id === adj.taskId);
  if (!commitment) throw new Error(`Commitment "${adj.taskId}" not found`);
  if (commitment.locked) throw new Error(`Cannot update duration of locked commitment "${commitment.title}"`);

  const currentStart = timeToMinutes(commitment.startTime);
  const newEnd = currentStart + adj.minutes;

  const oldTime = commitment.endTime;
  commitment.endTime = formatTime(newEnd / 60);

  validatePlan(plan);

  events.push({
    timestamp: new Date(),
    engine: "Adjustment",
    action: "Duration Updated",
    metadata: { taskId: adj.taskId, from: oldTime, to: commitment.endTime, minutes: adj.minutes },
  });
  recordAdjustment(adj, commitment.title, oldTime, commitment.endTime);

  return plan;
}

function handleLock(plan: TodayPlan, adj: LockCommitment, events: EngineEvent[]): TodayPlan {
  const commitment = plan.commitments.find(c => c.id === adj.taskId);
  if (!commitment) throw new Error(`Commitment "${adj.taskId}" not found`);

  commitment.locked = true;

  events.push({
    timestamp: new Date(),
    engine: "Adjustment",
    action: "Locked",
    metadata: { taskId: adj.taskId, title: commitment.title },
  });
  recordAdjustment(adj, commitment.title);

  return plan;
}

function handleUnlock(plan: TodayPlan, adj: UnlockCommitment, events: EngineEvent[]): TodayPlan {
  const commitment = plan.commitments.find(c => c.id === adj.taskId);
  if (!commitment) throw new Error(`Commitment "${adj.taskId}" not found`);

  commitment.locked = false;

  events.push({
    timestamp: new Date(),
    engine: "Adjustment",
    action: "Unlocked",
    metadata: { taskId: adj.taskId, title: commitment.title },
  });
  recordAdjustment(adj, commitment.title);

  return plan;
}
