import type { TodayPlan } from "../types/todayPlan";
import type { Commitment } from "../types/commitment";
import type {
  PlanningPreferences,
  AdaptationProposal,
  TimeWindow,
} from "./AdaptiveTypes";

function parseTime(time: string): number {
  const match = time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${String(m).padStart(2, "0")} ${period}`;
}

function getWindowCenter(window: TimeWindow): number {
  switch (window) {
    case "morning":
      return 9 * 60;
    case "afternoon":
      return 14 * 60;
    case "evening":
      return 19 * 60;
  }
}

function getWindowRange(window: TimeWindow): { start: number; end: number } {
  switch (window) {
    case "morning":
      return { start: 6 * 60, end: 12 * 60 };
    case "afternoon":
      return { start: 12 * 60, end: 17 * 60 };
    case "evening":
      return { start: 17 * 60, end: 22 * 60 };
  }
}

function isInWindow(timeStr: string, window: TimeWindow): boolean {
  const minutes = parseTime(timeStr);
  const range = getWindowRange(window);
  return minutes >= range.start && minutes < range.end;
}

function isLocked(commitment: Commitment): boolean {
  return commitment.locked;
}

function hasTimeConflict(
  commitment: Commitment,
  proposedStart: number,
  proposedEnd: number,
  allCommitments: Commitment[]
): boolean {
  const start = parseTime(commitment.startTime);
  const end = parseTime(commitment.endTime);
  return proposedStart < end && proposedEnd > start;
}

function findBestSlot(
  duration: number,
  window: TimeWindow,
  allCommitments: Commitment[],
  existing: Commitment
): { start: number; end: number } | null {
  const range = getWindowRange(window);
  const center = getWindowCenter(window);

  for (let offset = 0; offset < 360; offset += 15) {
    for (const sign of [0, -1, 1]) {
      const start = center + sign * offset;
      const end = start + duration;

      if (start < range.start || end > range.end) continue;

      const conflict = allCommitments.some(
        (c) =>
          c.id !== existing.id &&
          !isLocked(c) &&
          hasTimeConflict(c, start, end, allCommitments)
      );

      if (!conflict) {
        return { start, end };
      }
    }
  }

  return null;
}

export function proposeAdaptations(
  plan: TodayPlan,
  preferences: PlanningPreferences
): AdaptationProposal[] {
  const proposals: AdaptationProposal[] = [];
  const allCommitments = plan.commitments;

  for (const timePref of preferences.timePreferences) {
    const commitment = allCommitments.find(
      (c) => c.title === timePref.commitmentTitle && !isLocked(c)
    );
    if (!commitment) continue;

    if (isInWindow(commitment.startTime, timePref.preferredWindow)) continue;

    const duration = parseTime(commitment.endTime) - parseTime(commitment.startTime);
    const slot = findBestSlot(
      duration,
      timePref.preferredWindow,
      allCommitments,
      commitment
    );

    if (slot) {
      proposals.push({
        id: `adapt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: "reschedule",
        currentPlan: {
          title: commitment.title,
          startTime: commitment.startTime,
          endTime: commitment.endTime,
        },
        proposedPlan: {
          title: commitment.title,
          startTime: formatTime(slot.start),
          endTime: formatTime(slot.end),
        },
        reason: `${commitment.title} was suggested for ${timePref.preferredWindow} based on ${timePref.basedOnExperiments.length} experiment(s)`,
        confidence: timePref.confidence,
        createdAt: new Date().toISOString(),
      });
    }
  }

  for (const durPref of preferences.durationPreferences) {
    const commitment = allCommitments.find(
      (c) => c.title === durPref.commitmentTitle && !isLocked(c)
    );
    if (!commitment) continue;

    const currentDuration = parseTime(commitment.endTime) - parseTime(commitment.startTime);
    if (Math.abs(currentDuration - durPref.preferredMinutes) < 15) continue;

    const newEnd = parseTime(commitment.startTime) + durPref.preferredMinutes;
    const conflict = allCommitments.some(
      (c) =>
        c.id !== commitment.id &&
        !isLocked(c) &&
        hasTimeConflict(c, parseTime(commitment.startTime), newEnd, allCommitments)
    );

    if (!conflict) {
      proposals.push({
        id: `adapt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: "adjust_duration",
        currentPlan: {
          title: commitment.title,
          startTime: commitment.startTime,
          endTime: commitment.endTime,
        },
        proposedPlan: {
          title: commitment.title,
          startTime: commitment.startTime,
          endTime: formatTime(newEnd),
        },
        reason: `${commitment.title} duration adjusted to ${durPref.preferredMinutes}min based on experiment results`,
        confidence: durPref.confidence,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return proposals;
}

export function applyAdaptations(
  plan: TodayPlan,
  accepted: AdaptationProposal[]
): TodayPlan {
  const updated = {
    ...plan,
    commitments: plan.commitments.map((c) => ({ ...c })),
  };

  for (const proposal of accepted) {
    const commitment = updated.commitments.find(
      (c) => c.title === proposal.proposedPlan.title
    );
    if (commitment && !isLocked(commitment)) {
      commitment.startTime = proposal.proposedPlan.startTime;
      commitment.endTime = proposal.proposedPlan.endTime;
    }
  }

  updated.commitments.sort(
    (a, b) => parseTime(a.startTime) - parseTime(b.startTime)
  );

  return updated;
}
