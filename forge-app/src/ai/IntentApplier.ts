import type { TodayPlan } from "../types/todayPlan";
import type { Commitment } from "../types/commitment";
import type { Intent } from "./IntentTypes";
import { parseTimeToMinutes as toMinutes, formatTime } from "../utils/timeUtils";

export type AppliedChange = {
  type: "modify" | "cancel" | "add" | "move" | "delay";
  title: string;
  detail: string;
};

export type ApplyResult = {
  plan: TodayPlan;
  changes: AppliedChange[];
  affectedWindow: string;
};

const DAY_START = 7 * 60;
const DAY_END = 24 * 60;

function findCommitment(plan: TodayPlan, title: string): Commitment | undefined {
  return plan.commitments.find(
    (c) => c.title.toLowerCase() === title.toLowerCase()
  );
}

function cascadeShift(plan: TodayPlan, fromIndex: number): void {
  const sorted = [...plan.commitments].sort(
    (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)
  );

  for (let i = 0; i < sorted.length; i++) {
    if (i <= fromIndex) continue;
    const prev = sorted[i - 1];
    if (!prev) continue;
    const curr = sorted[i];
    if (curr.locked) continue;

    const prevEnd = toMinutes(prev.endTime);
    const currStart = toMinutes(curr.startTime);
    const currEnd = toMinutes(curr.endTime);
    const duration = currEnd - currStart;

    if (currStart < prevEnd) {
      const newStart = prevEnd;
      const newEnd = newStart + duration;
      if (newEnd > DAY_END) {
        curr.startTime = curr.startTime;
        continue;
      }
      curr.startTime = formatTime(newStart / 60);
      curr.endTime = formatTime(newEnd / 60);
    }
  }

  plan.commitments = sorted.sort(
    (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)
  );
}

function applyModify(
  plan: TodayPlan,
  target: string,
  changes: { startTime?: string; endTime?: string; durationMinutes?: number },
  changesOut: AppliedChange[]
): void {
  const commitment = findCommitment(plan, target);
  if (!commitment) return;

  const oldStart = commitment.startTime;
  const oldEnd = commitment.endTime;
  const oldDuration = toMinutes(oldEnd) - toMinutes(oldStart);

  if (changes.startTime) commitment.startTime = changes.startTime;
  if (changes.endTime) commitment.endTime = changes.endTime;
  if (changes.durationMinutes) {
    commitment.endTime = formatTime(
      (toMinutes(commitment.startTime) + changes.durationMinutes) / 60
    );
  }

  const index = plan.commitments.indexOf(commitment);
  cascadeShift(plan, index);

  const newDuration = toMinutes(commitment.endTime) - toMinutes(commitment.startTime);
  const parts: string[] = [];
  if (changes.startTime && changes.startTime !== oldStart) {
    parts.push(`starts at ${commitment.startTime}`);
  }
  if (changes.endTime && changes.endTime !== oldEnd) {
    parts.push(`ends at ${commitment.endTime}`);
  }
  if (changes.durationMinutes && newDuration !== oldDuration) {
    parts.push(`now ${newDuration} minutes long`);
  }

  changesOut.push({
    type: "modify",
    title: commitment.title,
    detail: parts.join(", ") || `${oldStart}–${oldEnd} → ${commitment.startTime}–${commitment.endTime}`,
  });
}

function applyCancel(plan: TodayPlan, target: string, changesOut: AppliedChange[]): void {
  if (target === "all") {
    const removed = plan.commitments.filter((c) => !c.locked);
    for (const c of removed) {
      changesOut.push({ type: "cancel", title: c.title, detail: "removed" });
    }
    plan.commitments = plan.commitments.filter((c) => c.locked);
    return;
  }

  const commitment = findCommitment(plan, target);
  if (!commitment) return;

  const index = plan.commitments.indexOf(commitment);
  plan.commitments = plan.commitments.filter((c) => c.id !== commitment.id);
  cascadeShift(plan, index - 1);

  changesOut.push({ type: "cancel", title: commitment.title, detail: "removed" });
}

function applyAdd(
  plan: TodayPlan,
  title: string,
  startTime: string | undefined,
  endTime: string | undefined,
  changesOut: AppliedChange[]
): void {
  const duration = startTime && endTime
    ? toMinutes(endTime) - toMinutes(startTime)
    : 60;

  let start = startTime ? toMinutes(startTime) : DAY_START;
  const end = startTime && endTime ? toMinutes(endTime) : start + duration;

  const sorted = [...plan.commitments].sort(
    (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)
  );

  for (const block of sorted) {
    const blockStart = toMinutes(block.startTime);
    const blockEnd = toMinutes(block.endTime);
    if (start < blockEnd && end > blockStart) {
      start = blockEnd;
    }
  }

  const newStart = formatTime(start / 60);
  const newEnd = formatTime((start + duration) / 60);

  const commitment: Commitment = {
    id: title.toLowerCase().replace(/\s+/g, "-"),
    title,
    startTime: newStart,
    endTime: newEnd,
    completed: false,
    locked: false,
    priority: "medium",
  };

  plan.commitments.push(commitment);
  plan.commitments.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

  changesOut.push({
    type: "add",
    title,
    detail: `added ${newStart} to ${newEnd}`,
  });
}

function applyMove(
  plan: TodayPlan,
  target: string,
  direction: "earlier" | "later",
  minutes: number | undefined,
  changesOut: AppliedChange[]
): void {
  const shift = minutes ?? 60;
  const targets = target === "all"
    ? plan.commitments.filter((c) => !c.locked)
    : (() => {
        const c = findCommitment(plan, target);
        return c ? [c] : [];
      })();

  for (const commitment of targets) {
    const start = toMinutes(commitment.startTime);
    const end = toMinutes(commitment.endTime);
    const duration = end - start;

    const delta = direction === "earlier" ? -shift : shift;
    let newStart = start + delta;
    let newEnd = newStart + duration;

    if (direction === "earlier") {
      const prev = [...plan.commitments]
        .filter((c) => c !== commitment && !c.locked)
        .map((c) => toMinutes(c.endTime))
        .filter((t) => t <= start)
        .sort((a, b) => b - a)[0];

      if (prev !== undefined && newStart < prev) {
        newStart = prev;
        newEnd = newStart + duration;
      }
      if (newStart < DAY_START) newStart = DAY_START;
      newEnd = newStart + duration;
    }

    const oldStart = commitment.startTime;
    commitment.startTime = formatTime(newStart / 60);
    commitment.endTime = formatTime(newEnd / 60);

    const index = plan.commitments.indexOf(commitment);
    cascadeShift(plan, index);

    changesOut.push({
      type: "move",
      title: commitment.title,
      detail: `${oldStart} → ${commitment.startTime} (${direction})`,
    });
  }
}

function applyDelay(
  plan: TodayPlan,
  target: string,
  minutes: number,
  changesOut: AppliedChange[]
): void {
  const targets = target === "all"
    ? plan.commitments.filter((c) => !c.locked)
    : (() => {
        const c = findCommitment(plan, target);
        return c ? [c] : [];
      })();

  for (const commitment of targets) {
    const oldStart = commitment.startTime;
    const start = toMinutes(commitment.startTime);
    const end = toMinutes(commitment.endTime);
    const duration = end - start;

    commitment.startTime = formatTime((start + minutes) / 60);
    commitment.endTime = formatTime((start + minutes + duration) / 60);

    const index = plan.commitments.indexOf(commitment);
    cascadeShift(plan, index);

    changesOut.push({
      type: "delay",
      title: commitment.title,
      detail: `${oldStart} → ${commitment.startTime} (${minutes} min later)`,
    });
  }
}

export function applyIntent(plan: TodayPlan, intent: Intent): ApplyResult {
  const newPlan: TodayPlan = structuredClone(plan);
  const changes: AppliedChange[] = [];
  const oldCommitments = plan.commitments.map((c) => c.title);

  switch (intent.type) {
    case "modify_commitment":
      applyModify(newPlan, intent.target, intent.changes, changes);
      break;
    case "cancel_commitment":
      applyCancel(newPlan, intent.target, changes);
      break;
    case "add_commitment":
      applyAdd(newPlan, intent.title, intent.startTime, intent.endTime, changes);
      break;
    case "move_commitment":
      applyMove(newPlan, intent.target, intent.direction, intent.minutes, changes);
      break;
    case "delay_commitment":
      applyDelay(newPlan, intent.target, intent.minutes, changes);
      break;
    case "energy":
    case "general_conversation":
      break;
  }

  const affected = newPlan.commitments.filter((c) => {
    if (changes.some((ch) => ch.title === c.title)) return true;
    const old = plan.commitments.find((o) => o.id === c.id);
    return old && (old.startTime !== c.startTime || old.endTime !== c.endTime);
  });

  const window = affected.length > 0
    ? `${affected[0].startTime} onwards`
    : "no change";

  const firstChangedIndex = newPlan.commitments.findIndex((c) =>
    changes.some((ch) => ch.title === c.title)
  );
  const firstChangedStart =
    firstChangedIndex >= 0 ? newPlan.commitments[firstChangedIndex].startTime : window;

  return {
    plan: newPlan,
    changes,
    affectedWindow: firstChangedStart,
  };
}

export function unaffectedWindow(
  before: TodayPlan,
  after: TodayPlan
): { title: string; startTime: string; endTime: string }[] {
  const untouched: { title: string; startTime: string; endTime: string }[] = [];
  for (const c of after.commitments) {
    const old = before.commitments.find((o) => o.id === c.id);
    if (old && old.startTime === c.startTime && old.endTime === c.endTime) {
      untouched.push({ title: c.title, startTime: c.startTime, endTime: c.endTime });
    }
  }
  return untouched;
}