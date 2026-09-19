import type { FixedEvent, FlexibleTask, StructuredConstraint, Constraint, Preference, LogEntry } from "./types";
import type { TodayPlan, UnscheduledItem } from "../types/todayPlan";
import type { Commitment } from "../types/commitment";
import type { TimelineItem, RecoveryReason } from "../types/timeline";
import { parseTimeToDecimal as parseTime, formatTime } from "../utils/timeUtils";
import { BrainLogger } from "./logger/BrainLogger";
import { DEFAULT_ANCHOR_TIMES, detectAnchorType } from "../day/DayAnchorEngine";

// ── Scheduler error ─────────────────────────────────────────────

export class SchedulerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchedulerError";
  }
}

// ── Scoring weights (Ticket 2) ──────────────────────────────────
const SCORE = {
  AFTER_FIXED_EVENT: 40,
  AFTERNOON: 25,
  BEFORE_DINNER_CONSTRAINT: 20,
  BEFORE_8AM: -40,
  VERY_LATE: -15,
  CLOSE_TO_EXISTING: 10,
  AFTER_RECOVERY: 30,
  BEFORE_BEDTIME_CONSTRAINT: 25,
  POST_DINNER_WIND_DOWN: 35,
  PREFERRED_STUDY_WINDOW: 20,
  NEAR_RELATED_WORK: 15,
  SKIP_MEAL: -40,
  NO_RECOVERY: -35,
  CONSECUTIVE_DEEP_WORK: -50,
  IMMEDIATE_AFTER_LONG: -25,
} as const;

const EARLY_CUTOFF = 8;
const LATE_CUTOFF = 22;

// ── Deep work & related-work heuristics ─────────────────────────

const DEEP_WORK_NAMES = new Set([
  "DSA Practice",
  "Coding",
  "Deep Work",
  "Study",
  "Research",
  "Exam Prep",
  "Revision",
  "Mock Test",
  "Answer Writing",
  "PYQs",
  "Current Affairs",
]);

const CATEGORY_BY_NAME: Record<string, string> = {
  "Competitive Exam": "study",
  "Answer Writing": "study",
  "Current Affairs": "study",
  "Exam Prep": "study",
  "Mock Test": "study",
  "PYQs": "study",
  "Research": "study",
  "Revision": "study",
  "Study": "study",
  "Assignment": "study",
  "DSA Practice": "study",
  "Coding": "study",
  "Gym": "health",
  "Walk": "health",
  "Run": "health",
  "Jog": "health",
  "Yoga": "health",
  "Stretch": "health",
  "Meditation": "health",
  "Physio": "health",
  "Swim": "health",
  "Sport": "health",
  "Office": "work",
  "Email": "work",
  "Meeting": "work",
  "Standup": "work",
  "Design": "work",
  "Presentation": "work",
  "Deep Work": "work",
  "Admin": "work",
  "Project": "work",
  "Client Work": "work",
  "Interview": "work",
  "Laundry": "home",
  "Cooking": "home",
  "Groceries": "home",
  "Cleaning": "home",
  "Bills": "home",
  "Home Repair": "home",
  "Shopping": "home",
  "Journal": "personal",
  "Reading": "personal",
  "Family": "personal",
  "Friends": "personal",
  "Call Parents": "personal",
  "Call": "personal",
  "Coffee": "personal",
  "Gaming": "personal",
  "Movie": "personal",
  "Finances": "personal",
  "Dentist": "health",
  "Appointment": "personal",
};

// ── Meal model ──────────────────────────────────────────────────

const MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;
const MEAL_DURATION_MINUTES: Record<string, number> = {
  breakfast: 30,
  lunch: 60,
  dinner: 60,
};

interface MealBlock {
  type: string;
  start: number;
  end: number;
}

// ── Time slot types ─────────────────────────────────────────────

interface TimeSlot {
  start: number;
  end: number;
}

// ── Anchor/meal resolution ──────────────────────────────────────

function resolveAnchorTimes(fixedEvents: FixedEvent[]): Record<string, number> {
  const anchorTimes: Record<string, number> = {
    wake: parseTime(DEFAULT_ANCHOR_TIMES.wake),
    breakfast: parseTime(DEFAULT_ANCHOR_TIMES.breakfast),
    lunch: parseTime(DEFAULT_ANCHOR_TIMES.lunch),
    dinner: parseTime(DEFAULT_ANCHOR_TIMES.dinner),
    bedtime: parseTime(DEFAULT_ANCHOR_TIMES.bedtime),
  };

  for (const event of fixedEvents) {
    const type = detectAnchorType(event.title);
    if (type && event.startTime) {
      anchorTimes[type] = parseTime(event.startTime);
    }
  }

  return anchorTimes;
}

function buildMealBlocks(anchorTimes: Record<string, number>): MealBlock[] {
  const blocks: MealBlock[] = [];
  for (const type of MEAL_TYPES) {
    const start = anchorTimes[type];
    const durationHours = MEAL_DURATION_MINUTES[type] / 60;
    blocks.push({ type, start, end: start + durationHours });
  }
  return blocks;
}

function mealBlockOverlaps(meal: MealBlock, events: FixedEvent[]): boolean {
  for (const event of events) {
    if (!event.startTime || !event.endTime) continue;
    const eStart = parseTime(event.startTime);
    const eEnd = parseTime(event.endTime);
    const center = (meal.start + meal.end) / 2;
    if (center >= eStart && center <= eEnd) return true;
  }
  return false;
}

function isMealEvent(event: FixedEvent): boolean {
  const type = detectAnchorType(event.title);
  return type !== null && (MEAL_TYPES as readonly string[]).includes(type);
}

// ── Timeline construction ───────────────────────────────────────

function buildOccupiedTimeline(fixedEvents: FixedEvent[], mealBlocks: MealBlock[], anchors: Record<string, number>): TimeSlot[] {
  const slots: TimeSlot[] = fixedEvents
    .filter(e => e.startTime && e.endTime)
    .map(e => ({
      start: parseTime(e.startTime!),
      end: parseTime(e.endTime!),
    }));

  for (const meal of mealBlocks) {
    slots.push({ start: meal.start, end: meal.end });
  }

  slots.sort((a, b) => a.start - b.start);

  if (slots.length === 0) return [];

  const merged: TimeSlot[] = [slots[0]];
  for (let i = 1; i < slots.length; i++) {
    const last = merged[merged.length - 1];
    if (slots[i].start <= last.end) {
      last.end = Math.max(last.end, slots[i].end);
    } else {
      merged.push(slots[i]);
    }
  }

  return merged;
}

function findFreeWindows(occupied: TimeSlot[], dayStart: number, dayEnd: number): TimeSlot[] {
  const free: TimeSlot[] = [];
  let current = dayStart;

  for (const slot of occupied) {
    if (current < slot.start) {
      free.push({ start: current, end: slot.start });
    }
    current = Math.max(current, slot.end);
  }

  if (current < dayEnd) {
    free.push({ start: current, end: dayEnd });
  }

  return free;
}

// ── Structured constraint checking (Ticket 3) ───────────────────

const ANCHOR_TIMES: Record<string, number> = {
  dinner: parseTime(DEFAULT_ANCHOR_TIMES.dinner),
  lunch: parseTime(DEFAULT_ANCHOR_TIMES.lunch),
  breakfast: parseTime(DEFAULT_ANCHOR_TIMES.breakfast),
  wake: parseTime(DEFAULT_ANCHOR_TIMES.wake),
  bedtime: parseTime(DEFAULT_ANCHOR_TIMES.bedtime),
  college: 9,
  class: 9,
  work: 9,
  evening: 17,
  night: 21,
  morning: 6,
  afternoon: 12,
};

function resolveTarget(target: string): number | null {
  const lower = target.toLowerCase();
  if (lower in ANCHOR_TIMES) return ANCHOR_TIMES[lower];
  const timeMatch = target.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?/);
  if (timeMatch) {
    const time = parseTime(timeMatch[0]);
    if (time === 0 && (lower.includes("am") || lower === "midnight")) {
      return 24;
    }
    return time;
  }
  return null;
}

function satisfiesConstraint(
  constraint: StructuredConstraint,
  slotStart: number,
  slotEnd: number,
  occupied: TimeSlot[]
): boolean {
  switch (constraint.type) {
    case "before": {
      if (!constraint.target) return true;
      const anchorTime = resolveTarget(constraint.target);
      if (anchorTime !== null && slotEnd > anchorTime) return false;
      return true;
    }
    case "after": {
      if (!constraint.target) return true;
      const anchorTime = resolveTarget(constraint.target);
      if (anchorTime !== null && slotStart < anchorTime) return false;
      return true;
    }
    case "between": {
      if (!constraint.target) return true;
      const parts = constraint.target.split("-");
      if (parts.length === 2) {
        const startTime = resolveTarget(parts[0].trim());
        const endTime = resolveTarget(parts[1].trim());
        if (startTime !== null && slotStart < startTime) return false;
        if (endTime !== null && slotEnd > endTime) return false;
      }
      return true;
    }
    case "morning":
      return slotStart < 12 && slotEnd > 6;
    case "afternoon":
      return slotStart < 17 && slotEnd > 12;
    case "evening":
      return slotStart < 22 && slotEnd > 17;
    case "first_thing":
      return slotStart < 9 && slotStart >= 5;
    case "late_afternoon":
      return slotStart >= 15 && slotEnd <= 19;
    case "anytime":
      return true;
  }
}

function satisfiesAllConstraints(
  constraints: StructuredConstraint[],
  slotStart: number,
  slotEnd: number,
  occupied: TimeSlot[]
): boolean {
  return constraints.every(c => satisfiesConstraint(c, slotStart, slotEnd, occupied));
}

// ── Human-energy scoring (Phase 8) ──────────────────────────────

function isDeepWork(title: string): boolean {
  return DEEP_WORK_NAMES.has(title);
}

function isAdjacent(prevEnd: number, slotStart: number): boolean {
  return Math.abs(slotStart - prevEnd) < 0.5;
}

function spansMeal(mealBlocks: MealBlock[], slotStart: number, slotEnd: number): boolean {
  for (const meal of mealBlocks) {
    if (slotStart < meal.end && slotEnd > meal.start) return true;
  }
  return false;
}

function scoreSlot(
  task: FlexibleTask,
  slotStart: number,
  slotEnd: number,
  occupied: TimeSlot[],
  allCommitments: Commitment[],
  placedBlocks: TimeSlot[],
  mealBlocks: MealBlock[]
): number {
  let score = 0;

  // +40 if after a related fixed event
  for (const event of occupied) {
    if (Math.abs(slotStart - event.end) < 0.5) {
      score += SCORE.AFTER_FIXED_EVENT;
      break;
    }
  }

  // +30 if directly after a recovery/break block
  const prevBlock = [...placedBlocks].sort((a, b) => b.end - a.end)[0];
  if (prevBlock && Math.abs(slotStart - prevBlock.end) < 0.5 && prevBlock.end <= slotStart) {
    score += SCORE.AFTER_RECOVERY;
  }

  // -25 if task starts immediately after a >=6h commitment
  if (allCommitments.length > 0) {
    const prev = allCommitments[allCommitments.length - 1];
    const prevEnd = parseTime(prev.endTime);
    const prevStart = parseTime(prev.startTime);
    if (prevEnd - prevStart >= 6 && Math.abs(slotStart - prevEnd) < 0.5) {
      score += SCORE.IMMEDIATE_AFTER_LONG;
    }
  }

  // -35 if no recovery between long commitment and this slot
  if (allCommitments.length > 0) {
    const prev = allCommitments[allCommitments.length - 1];
    const prevEnd = parseTime(prev.endTime);
    const prevStart = parseTime(prev.startTime);
    if (prevEnd - prevStart >= 4 && Math.abs(slotStart - prevEnd) < 0.5 && prevEnd < slotStart) {
      score += SCORE.NO_RECOVERY;
    }
  }

  // -40 if the slot would skip/squeeze a meal
  if (spansMeal(mealBlocks, slotStart, slotEnd)) {
    score += SCORE.SKIP_MEAL;
  }

  // -50 if three deep work blocks in a row
  const deepInARow = allCommitments
    .slice(-2)
    .filter(c => isDeepWork(c.title)).length;
  if (isDeepWork(task.title) && deepInARow >= 2) {
    score += SCORE.CONSECUTIVE_DEEP_WORK;
  }

  // +25 if before bedtime constraint
  const hasBeforeBedtime = task.constraints.some(
    c => c.type === "before" && ["bedtime", "bed", "sleep", "sleeping"].includes(c.target?.toLowerCase() ?? "")
  );
  if (hasBeforeBedtime && slotEnd <= ANCHOR_TIMES.bedtime) {
    score += SCORE.BEFORE_BEDTIME_CONSTRAINT;
    // Wind-down tasks belong after the last meal — place them post-dinner.
    const dinnerEnd = ANCHOR_TIMES.dinner + MEAL_DURATION_MINUTES.dinner / 60;
    if (slotStart >= dinnerEnd) {
      score += SCORE.POST_DINNER_WIND_DOWN;
    }
  }

  // +25 afternoon
  if (slotStart >= 12 && slotStart < 17) {
    score += SCORE.AFTERNOON;
  }

  // +20 before dinner constraint
  const hasBeforeDinner = task.constraints.some(
    c => c.type === "before" && c.target?.toLowerCase() === "dinner"
  );
  if (hasBeforeDinner && slotEnd <= ANCHOR_TIMES.dinner) {
    score += SCORE.BEFORE_DINNER_CONSTRAINT;
  }

  // +20 preferred study window
  if (CATEGORY_BY_NAME[task.title] === "study" && slotStart >= 12 && slotEnd <= 19) {
    score += SCORE.PREFERRED_STUDY_WINDOW;
  }

  // +15 near related work
  if (allCommitments.length > 0 && CATEGORY_BY_NAME[task.title]) {
    const prev = allCommitments[allCommitments.length - 1];
    if (CATEGORY_BY_NAME[prev.title] === CATEGORY_BY_NAME[task.title]) {
      const prevEnd = parseTime(prev.endTime);
      if (slotStart >= prevEnd && slotStart - prevEnd <= 1) {
        score += SCORE.NEAR_RELATED_WORK;
      }
    }
  }

  // -40 before 8 AM
  if (slotEnd <= EARLY_CUTOFF) {
    score += SCORE.BEFORE_8AM;
  }

  // -15 very late
  if (slotStart >= LATE_CUTOFF) {
    score += SCORE.VERY_LATE;
  }

  // +10 close to existing commitments
  if (allCommitments.length > 0) {
    const minGap = Math.min(
      ...allCommitments.map(c => {
        const cStart = parseTime(c.startTime);
        const cEnd = parseTime(c.endTime);
        if (slotStart >= cEnd) return slotStart - cEnd;
        if (slotEnd <= cStart) return cStart - slotEnd;
        return 0;
      })
    );
    if (minGap <= 1) {
      score += SCORE.CLOSE_TO_EXISTING;
    }
  }

  return score;
}

function collectPlacementReasons(
  task: FlexibleTask,
  slotStart: number,
  slotEnd: number,
  occupied: TimeSlot[],
  allCommitments: Commitment[],
  placedBlocks: TimeSlot[],
  mealBlocks: MealBlock[]
): { code: string; human: string }[] {
  const reasons: { code: string; human: string }[] = [];

  const prevBlock = [...placedBlocks].sort((a, b) => b.end - a.end)[0];
  if (prevBlock && Math.abs(slotStart - prevBlock.end) < 0.5 && prevBlock.end <= slotStart) {
    reasons.push({
      code: "after_recovery",
      human: `i left ${formatTime(slotStart)} after ${formatTime(prevBlock.end)} because a short recovery break helps you ease back in.`,
    });
  }

  for (const event of occupied) {
    if (Math.abs(slotStart - event.end) < 0.5) {
      reasons.push({
        code: "after_fixed_event",
        human: `i scheduled ${task.title} right after ${formatTime(event.end)}.`,
      });
      break;
    }
  }

  const hasBeforeDinner = task.constraints.some(
    c => c.type === "before" && c.target?.toLowerCase() === "dinner"
  );
  if (hasBeforeDinner && slotEnd <= ANCHOR_TIMES.dinner) {
    reasons.push({
      code: "before_dinner",
      human: `i kept ${task.title} before dinner because you asked for it before dinner.`,
    });
  }

  const hasBeforeBedtime = task.constraints.some(
    c => c.type === "before" && ["bedtime", "bed", "sleep", "sleeping"].includes(c.target?.toLowerCase() ?? "")
  );
  if (hasBeforeBedtime && slotEnd <= ANCHOR_TIMES.bedtime) {
    reasons.push({
      code: "before_bedtime",
      human: `i scheduled ${task.title} before bedtime because you wanted it done before sleeping.`,
    });
  }

  for (const constraint of task.constraints) {
    if (constraint.type === "morning" || (constraint.type === "before" && constraint.target === "12:00 PM")) {
      reasons.push({ code: "morning_preference", human: `${task.title} fits your morning preference.` });
    }
    if (constraint.type === "afternoon") {
      reasons.push({ code: "afternoon_preference", human: `${task.title} fits your afternoon preference.` });
    }
    if (constraint.type === "evening") {
      reasons.push({ code: "evening_preference", human: `${task.title} fits your evening preference.` });
    }
    if (constraint.type === "first_thing") {
      reasons.push({ code: "first_thing", human: `${task.title} is placed first thing, before anything else fills the morning.` });
    }
    if (constraint.type === "late_afternoon") {
      reasons.push({ code: "late_afternoon", human: `${task.title} sits in the late afternoon as you asked.` });
    }
  }

  if (slotStart >= 12 && slotStart < 17 && !reasons.some(r => r.code === "afternoon_preference")) {
    reasons.push({ code: "preferred_time_window", human: `${task.title} lands in a preferred afternoon window.` });
  }

  if (allCommitments.length > 0) {
    const prev = allCommitments[allCommitments.length - 1];
    if (CATEGORY_BY_NAME[prev.title] === CATEGORY_BY_NAME[task.title] && CATEGORY_BY_NAME[task.title]) {
      reasons.push({
        code: "near_related",
        human: `i placed ${task.title} near ${prev.title} so related work stays together.`,
      });
    }
  }

  if (allCommitments.length > 0) {
    const minGap = Math.min(
      ...allCommitments.map(c => {
        const cStart = parseTime(c.startTime);
        const cEnd = parseTime(c.endTime);
        if (slotStart >= cEnd) return slotStart - cEnd;
        if (slotEnd <= cStart) return cStart - slotEnd;
        return 0;
      })
    );
    if (minGap <= 1) {
      reasons.push({ code: "close_to_existing", human: `${task.title} sits close to your existing commitments.` });
    }
  }

  if (slotEnd <= EARLY_CUTOFF) {
    reasons.push({ code: "avoiding_early", human: `i avoided the pre-8 am hours for ${task.title}.` });
  }

  if (slotStart >= LATE_CUTOFF) {
    reasons.push({ code: "avoiding_late", human: `i avoided placing ${task.title} too late.` });
  }

  return reasons;
}

function generateCandidateSlots(
  task: FlexibleTask,
  freeWindows: TimeSlot[],
  occupied: TimeSlot[],
  allCommitments: Commitment[],
  placedBlocks: TimeSlot[],
  mealBlocks: MealBlock[]
): { slot: TimeSlot; score: number }[] {
  const duration = (task.estimatedMinutes || 60) / 60;
  const candidates: { slot: TimeSlot; score: number }[] = [];

  for (const window of freeWindows) {
    if ((window.end - window.start) < duration) continue;

    for (let start = window.start; start + duration <= window.end; start += 0.5) {
      const end = start + duration;

      if (!satisfiesAllConstraints(task.constraints, start, end, occupied)) continue;

      const allSlots = [...occupied, ...allCommitments.map(c => ({
        start: parseTime(c.startTime),
        end: parseTime(c.endTime),
      })), ...placedBlocks];

      const hasOverlap = allSlots.some(slot => start < slot.end && end > slot.start);
      if (hasOverlap) continue;

      candidates.push({
        slot: { start, end },
        score: scoreSlot(task, start, end, occupied, allCommitments, placedBlocks, mealBlocks),
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

// ── Duplicate check ─────────────────────────────────────────────

function makeCommitmentId(title: string, commitments: Commitment[]): string {
  const base = title.toLowerCase().replace(/\s+/g, "-");
  if (!commitments.some(c => c.id === base)) return base;
  let n = 2;
  while (commitments.some(c => c.id === `${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// ── Session splitting (Sprint 1) ───────────────────────────────

function roundToNearest30(minutes: number): number {
  return Math.round(minutes / 30) * 30;
}

function splitIntoSessions(
  totalMinutes: number,
  sessionCount: number,
  breakMinutes: number = 15
): { durationMinutes: number; breakAfterMinutes: number }[] {
  if (sessionCount <= 1) {
    return [{ durationMinutes: totalMinutes, breakAfterMinutes: 0 }];
  }

  // Round to nearest 30 for each session
  const basePerSession = roundToNearest30(totalMinutes / sessionCount);
  const sessions: { durationMinutes: number; breakAfterMinutes: number }[] = [];
  let remaining = totalMinutes;

  for (let i = 0; i < sessionCount; i++) {
    const isLast = i === sessionCount - 1;
    // Last session gets the remainder
    const duration = isLast ? remaining : Math.min(basePerSession, remaining - (sessionCount - i - 1) * basePerSession);
    sessions.push({
      durationMinutes: Math.max(30, duration), // minimum 30 min per session
      breakAfterMinutes: isLast ? 0 : breakMinutes,
    });
    remaining -= duration;
  }

  return sessions;
}

// ── Recovery buffers (Phase 6) ──────────────────────────────────

function recoveryAfterEvent(event: FixedEvent, committed: Commitment): { kind: "recovery" | "break" | "buffer"; minutes: number; reason: RecoveryReason } | null {
  if (!event.startTime || !event.endTime) return null;
  const start = parseTime(event.startTime);
  const end = parseTime(event.endTime);
  const hours = end - start;

  if (hours > 4) {
    return { kind: "recovery", minutes: 20, reason: "after_long_fixed" };
  }
  if (isDeepWork(committed.title)) {
    return { kind: "buffer", minutes: 15, reason: "after_deep_work" };
  }
  if (hours >= 1.5) {
    return { kind: "break", minutes: 10, reason: "after_work_block" };
  }
  return null;
}

function buildAnchorItems(anchorTimes: Record<string, number>): TimelineItem[] {
  const items: TimelineItem[] = [];
  const order = ["wake", "breakfast", "lunch", "dinner", "bedtime"];
  for (const type of order) {
    const t = anchorTimes[type];
    items.push({
      id: `anchor-${type}`,
      kind: "anchor",
      title: type,
      startTime: formatTime(t),
      endTime: formatTime(t),
      locked: true,
      anchorType: type as TimelineItem["anchorType"],
    });
  }
  return items;
}

// ── Scheduler assertions (Step 6) ───────────────────────────────

function assertNoOverlap(plan: TodayPlan): void {
  for (let i = 0; i < plan.commitments.length; i++) {
    for (let j = i + 1; j < plan.commitments.length; j++) {
      const startA = parseTime(plan.commitments[i].startTime);
      const endA = parseTime(plan.commitments[i].endTime);
      const startB = parseTime(plan.commitments[j].startTime);
      const endB = parseTime(plan.commitments[j].endTime);
      if (startA < endB && startB < endA) {
        throw new SchedulerError(
          `${plan.commitments[i].title} overlaps ${plan.commitments[j].title}: ` +
          `${plan.commitments[i].startTime}-${plan.commitments[i].endTime} vs ` +
          `${plan.commitments[j].startTime}-${plan.commitments[j].endTime}`
        );
      }
    }
  }
}

function assertFixedEventsProtected(plan: TodayPlan, events: FixedEvent[]): void {
  for (const event of events) {
    if (!event.startTime || !event.endTime) continue;
    const found = plan.commitments.find(c => c.title === event.title && c.locked);
    if (!found) {
      throw new SchedulerError(`Fixed event "${event.title}" not preserved in plan`);
    }
    if (found.startTime !== event.startTime || found.endTime !== event.endTime) {
      throw new SchedulerError(
        `Fixed event "${event.title}" time changed: ` +
        `expected ${event.startTime}-${event.endTime}, ` +
        `got ${found.startTime}-${found.endTime}`
      );
    }
  }
}

function assertNoDuplicateTimes(plan: TodayPlan): void {
  const used = new Map<string, string>();
  for (const c of plan.commitments) {
    const key = `${c.startTime}-${c.endTime}`;
    if (used.has(key)) {
      throw new SchedulerError(
        `"${c.title}" has same time as "${used.get(key)}": ${key}`
      );
    }
    used.set(key, c.title);
  }
}

function assertChronological(plan: TodayPlan): void {
  for (let i = 1; i < plan.commitments.length; i++) {
    const prev = parseTime(plan.commitments[i - 1].startTime);
    const curr = parseTime(plan.commitments[i].startTime);
    if (curr < prev) {
      throw new SchedulerError(
        `"${plan.commitments[i].title}" (${plan.commitments[i].startTime}) ` +
        `is before "${plan.commitments[i - 1].title}" (${plan.commitments[i - 1].startTime})`
      );
    }
  }
}

function assertPlanValid(
  plan: TodayPlan,
  events: FixedEvent[],
  tasks: FlexibleTask[],
  occupied: TimeSlot[]
): void {
  assertNoOverlap(plan);
  assertFixedEventsProtected(plan, events);
  assertNoDuplicateTimes(plan);
  assertChronological(plan);

  for (const task of tasks) {
    const c = plan.commitments.find(x => x.title === task.title && !x.locked);
    if (c && task.constraints.length > 0) {
      const s = parseTime(c.startTime);
      const e = parseTime(c.endTime);
      if (!satisfiesAllConstraints(task.constraints, s, e, occupied)) {
        throw new SchedulerError(
          `"${task.title}" does not satisfy constraints: ` +
          task.constraints.map(c => `${c.type}${c.target ? ` ${c.target}` : ""}`).join(", ")
        );
      }
    }
  }

  for (const item of plan.unscheduled) {
    if (!item.reason || item.reason.trim().length === 0) {
      throw new SchedulerError(`"${item.title}" is unscheduled but has no reason`);
    }
  }
}

// ── Main scheduler ──────────────────────────────────────────────

export function scheduleDay(
  fixedEvents: FixedEvent[],
  flexibleTasks: FlexibleTask[],
  constraints: Constraint[],
  preferences: Preference[],
  currentTime?: Date
): {
  plan: TodayPlan;
  logs: LogEntry[];
} {
  const logs: LogEntry[] = [];
  const warnings: string[] = [];
  const unscheduled: UnscheduledItem[] = [];
  const commitments: Commitment[] = [];
  const placedBlocks: TimeSlot[] = [];
  const recoveryItems: TimelineItem[] = [];

  const anchorTimes = resolveAnchorTimes(fixedEvents);
  const mealBlocks = buildMealBlocks(anchorTimes);

  const protectedMealBlocks = mealBlocks.filter(meal =>
    !mealBlockOverlaps(meal, fixedEvents) && !fixedEvents.some(e => isMealEvent(e) && e.startTime && parseTime(e.startTime) === meal.start)
  );

  const occupied = buildOccupiedTimeline(fixedEvents, protectedMealBlocks, anchorTimes);
  const defaultDayStart = 6;
  const currentHour = currentTime ? currentTime.getHours() + currentTime.getMinutes() / 60 : defaultDayStart;
  const BUFFER_MINUTES = 5;
  const roundedUp = Math.ceil((currentHour * 60 + BUFFER_MINUTES) / 15) * (15 / 60);
  const dayStart = Math.max(defaultDayStart, roundedUp);
  const dayEnd = 24;
  const freeWindows = findFreeWindows(occupied, dayStart, dayEnd);

  logs.push({ module: "Scheduler", message: `✓ Day: ${formatTime(dayStart)} - ${formatTime(dayEnd)}` });
  logs.push({ module: "Scheduler", message: `✓ Occupied slots: ${occupied.length}` });
  logs.push({ module: "Scheduler", message: `✓ Free windows: ${freeWindows.length}` });
  occupied.forEach(s => {
    logs.push({ module: "Scheduler", message: `  Occupied: ${formatTime(s.start)} - ${formatTime(s.end)}` });
  });
  freeWindows.forEach(s => {
    logs.push({ module: "Scheduler", message: `  Free: ${formatTime(s.start)} - ${formatTime(s.end)}` });
  });

  // Schedule fixed events first
  for (const event of fixedEvents) {
    // Handle endTime-only events (e.g. "college till 7:45pm"): derive startTime from current time
    if (!event.startTime && event.endTime) {
      const eventEnd = parseTime(event.endTime);
      if (eventEnd <= currentHour) {
        // End time already past — skip
        warnings.push(`${event.title} ends at ${event.endTime} which is already past — skipped`);
        continue;
      } else {
        // Start from NOW, not from dayStart (dayStart has buffer + rounding)
        event.startTime = formatTime(currentHour);
      }
      logs.push({ module: "Scheduler", message: `✓ Derived start for ${event.title}: ${event.startTime} - ${event.endTime}` });
    }

    if (!event.startTime || !event.endTime) {
      warnings.push(`${event.title} has no time range — skipped`);
      continue;
    }

    let adjustedStart = parseTime(event.startTime);
    let adjustedEnd = parseTime(event.endTime);
    let eventDuration = adjustedEnd - adjustedStart;

    // Handle negative duration (跨越 midnight, e.g. 7:15 PM → 5:15 AM)
    if (eventDuration < 0) {
      eventDuration += 24;
    }

    // Sanity check: fixed events > 6 hours with ONLY endTime are likely hallucinated start times
    // Only applies to events where we derived the startTime (endTime-only pattern)
    if (eventDuration > 6 && !event.startTime) {
      const derivedStart = currentHour;
      event.startTime = formatTime(derivedStart);
      adjustedStart = derivedStart;
      eventDuration = adjustedEnd - derivedStart;
      if (eventDuration < 0) eventDuration += 24;
      logs.push({ module: "Scheduler", message: `✓ Fixed hallucinated duration for ${event.title}: derived start ${event.startTime}` });
    }

    // Clamp past fixed events to dayStart
    if (adjustedEnd <= dayStart) {
      // Entirely in the past — shift to dayStart
      adjustedStart = dayStart;
      adjustedEnd = dayStart + eventDuration;
      event.startTime = formatTime(adjustedStart);
      event.endTime = formatTime(adjustedEnd);
      logs.push({ module: "Scheduler", message: `✓ Clamped past event ${event.title} to ${event.startTime} - ${event.endTime}` });
    } else if (adjustedStart < dayStart) {
      // Partially in the past — clamp start to dayStart
      adjustedStart = dayStart;
      event.startTime = formatTime(adjustedStart);
      logs.push({ module: "Scheduler", message: `✓ Clamped start of ${event.title} to ${event.startTime}` });
    }

    const commitment: Commitment = {
      id: makeCommitmentId(event.title, commitments),
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      completed: false,
      locked: true,
      priority: "high",
      confidence: event.confidence,
      note: `Protected commitment with ${Math.round(event.confidence * 100)}% confidence`,
    };
    commitments.push(commitment);
    placedBlocks.push({ start: parseTime(event.startTime), end: parseTime(event.endTime) });

    const recovery = recoveryAfterEvent(event, commitment);
    if (recovery) {
      const recoveryStart = parseTime(event.endTime);
      const recoveryEnd = recoveryStart + recovery.minutes / 60;
      recoveryItems.push({
        id: `recovery-after-${event.title.toLowerCase().replace(/\s+/g, "-")}`,
        kind: recovery.kind,
        title: recovery.kind === "recovery" ? "Recovery" : recovery.kind === "buffer" ? "Reset" : "Break",
        startTime: formatTime(recoveryStart),
        endTime: formatTime(recoveryEnd),
        locked: false,
        recoveryReason: recovery.reason,
      });
      placedBlocks.push({ start: recoveryStart, end: recoveryEnd });
      logs.push({
        module: "Scheduler",
        message: `✓ ${recovery.kind} ${formatTime(recoveryStart)} - ${formatTime(recoveryEnd)} after ${event.title}`,
      });
    }

    logs.push({ module: "Scheduler", message: `✓ Scheduled ${event.title} ${event.startTime} - ${event.endTime}` });
  }

  // Rebuild occupied/free after clamping past fixed events
  occupied.length = 0;
  occupied.push(...buildOccupiedTimeline(fixedEvents, protectedMealBlocks, anchorTimes));
  freeWindows.length = 0;
  freeWindows.push(...findFreeWindows(occupied, dayStart, dayEnd));

  // Schedule flexible tasks using energy-based placement (Phase 8)
  const sortedTasks = [...flexibleTasks].sort((a, b) => b.confidence - a.confidence);

  for (const task of sortedTasks) {
    // Handle session splitting
    const sessionCount = task.sessionCount ?? 1;
    const sessions = splitIntoSessions(task.estimatedMinutes ?? 60, sessionCount);

    for (let sessionIdx = 0; sessionIdx < sessions.length; sessionIdx++) {
      const session = sessions[sessionIdx];
      const sessionTask: FlexibleTask = {
        ...task,
        estimatedMinutes: session.durationMinutes,
        sessionCount: 1, // prevent recursive splitting
        title: sessions.length > 1 ? `${task.title} (session ${sessionIdx + 1}/${sessions.length})` : task.title,
      };

      const candidates = generateCandidateSlots(sessionTask, freeWindows, occupied, commitments, placedBlocks, protectedMealBlocks);

      if (candidates.length === 0) {
        const constraintDesc = sessionTask.constraints
          .map(c => `${c.type}${c.target ? ` ${c.target}` : ""}`)
          .join(", ");
        const reason = constraintDesc
          ? `no free window satisfies constraints: ${constraintDesc}`
          : "no free window with enough duration";
        unscheduled.push({
          title: sessionTask.title,
          reason,
        });
        logs.push({ module: "Scheduler", message: `✗ Could not schedule ${sessionTask.title}: ${reason}` });
        continue;
      }

      const best = candidates[0];
      const reasons = collectPlacementReasons(sessionTask, best.slot.start, best.slot.end, occupied, commitments, placedBlocks, protectedMealBlocks);

      const commitment: Commitment = {
        id: makeCommitmentId(sessionTask.title, commitments),
        title: sessionTask.title,
        startTime: formatTime(best.slot.start),
        endTime: formatTime(best.slot.end),
        completed: false,
        locked: false,
        priority: "medium",
        confidence: sessionTask.confidence,
        note: `Flexible task with ${Math.round(sessionTask.confidence * 100)}% confidence (score: ${best.score})${sessions.length > 1 ? ` [session ${sessionIdx + 1}/${sessions.length}]` : ""}`,
        placementReasons: reasons.map(r => r.code) as Commitment["placementReasons"],
      };
      commitments.push(commitment);
      placedBlocks.push(best.slot);

      logs.push({
        module: "Scheduler",
        message: `✓ Scheduled ${sessionTask.title} ${formatTime(best.slot.start)} - ${formatTime(best.slot.end)} (score: ${best.score})`,
      });

      // Add break after session if there are more sessions
      if (session.breakAfterMinutes > 0 && sessionIdx < sessions.length - 1) {
        const breakStart = best.slot.end;
        const breakEnd = breakStart + session.breakAfterMinutes / 60;
        placedBlocks.push({ start: breakStart, end: breakEnd });
        recoveryItems.push({
          id: `break-after-${task.title.toLowerCase().replace(/\s+/g, "-")}-${sessionIdx}`,
          kind: "break",
          title: "Break",
          startTime: formatTime(breakStart),
          endTime: formatTime(breakEnd),
          locked: false,
          recoveryReason: "between_sessions",
        });
        logs.push({
          module: "Scheduler",
          message: `✓ Break ${formatTime(breakStart)} - ${formatTime(breakEnd)} after ${sessionTask.title}`,
        });
      }
    }
  }

  // Sort all commitments chronologically
  commitments.sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));

  // Build the timeline (Phase 5): anchors, meals, commitments, recovery
  const mealItems: TimelineItem[] = protectedMealBlocks.map(meal => ({
    id: `meal-${meal.type}`,
    kind: "meal",
    title: meal.type.charAt(0).toUpperCase() + meal.type.slice(1),
    startTime: formatTime(meal.start),
    endTime: formatTime(meal.end),
    locked: true,
  }));

  const anchorItems = buildAnchorItems(anchorTimes);

  const commitmentItems: TimelineItem[] = commitments.map(c => ({
    id: c.id,
    kind: "commitment",
    title: c.title,
    startTime: c.startTime,
    endTime: c.endTime,
    locked: c.locked,
    completed: c.completed,
    priority: c.priority,
    note: c.note,
    placementReasons: c.placementReasons,
    confidence: c.confidence,
  }));

  const timeline: TimelineItem[] = [...anchorItems, ...mealItems, ...commitmentItems, ...recoveryItems]
    .sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime) || (a.endTime.length - b.endTime.length));

  // Build plan
  const plan: TodayPlan = {
    greeting: "here's what i suggest.",
    summary: [
      `found ${fixedEvents.length} fixed events and ${flexibleTasks.length} flexible tasks.`,
      `${commitments.length} scheduled, ${unscheduled.length} couldn't fit.`,
    ],
    commitments,
    timeline,
    unscheduled,
    warnings,
    recommendation: unscheduled.length > 0
      ? `${unscheduled.map(u => u.title).join(", ")} didn't fit today. try adjusting or moving them to tomorrow.`
      : "priorities first, everything else follows.",
    status: "draft",
  };

  // Validate plan (Step 6) — throw on invalid
  try {
    assertPlanValid(plan, fixedEvents, flexibleTasks, occupied);
    logs.push({ module: "Scheduler", message: "✓ All assertions passed" });
  } catch (e) {
    if (e instanceof SchedulerError) {
      warnings.push(e.message);
      plan.warnings = warnings;
      plan.summary.push(`⚠ Scheduler error: ${e.message}`);
      logs.push({ module: "Scheduler", message: `✗ Assertion failed: ${e.message}` });
    }
  }

  BrainLogger.log("Scheduler", {
    fixedEvents: fixedEvents.length,
    flexibleTasks: flexibleTasks.length,
    totalCommitments: commitments.length,
    timelineItems: timeline.length,
    unscheduled: unscheduled.length,
    warnings: warnings.length,
  });

  return { plan, logs };
}