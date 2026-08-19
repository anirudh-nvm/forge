import type { TodayPlan } from "../types/todayPlan";

export type ChangeDescription = {
  title: string;
  description: string;
};

export type ChangeExplanation = {
  changed: ChangeDescription[];
  unchanged: string[];
  summary: string;
};

function describeSingleChange(
  before: TodayPlan,
  after: TodayPlan,
  title: string,
  b: { startTime: string; endTime: string },
  a: { startTime: string; endTime: string }
): string {
  const parts: string[] = [];

  if (b.startTime !== a.startTime) {
    parts.push(`moved to ${a.startTime}`);
  }
  if (b.endTime !== a.endTime) {
    const beforeDuration = toMinutes(b.endTime) - toMinutes(b.startTime);
    const afterDuration = toMinutes(a.endTime) - toMinutes(a.startTime);

    if (afterDuration > beforeDuration) {
      parts.push(`extended until ${a.endTime}`);
    } else if (afterDuration < beforeDuration) {
      parts.push(`shortened to end at ${a.endTime}`);
    } else if (b.startTime !== a.startTime) {
      parts.push(`now ends at ${a.endTime}`);
    } else {
      parts.push(`now ends at ${a.endTime}`);
    }
  }

  return `${title} ${parts.join(", ")}.`;
}

function toMinutes(time: string): number {
  const m = time.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?/);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const p = m[3]?.toUpperCase();
  if (p === "PM" && h !== 12) h += 12;
  if (p === "AM" && h === 12) h = 0;
  if (!p && h < 8) h += 12;
  return h * 60 + min;
}

export function explainChanges(
  before: TodayPlan,
  after: TodayPlan
): ChangeExplanation {
  const changed: ChangeDescription[] = [];
  const unchanged: string[] = [];

  for (const afterCommitment of after.commitments) {
    const beforeCommitment = before.commitments.find(
      (c) => c.id === afterCommitment.id
    );

    if (!beforeCommitment) {
      changed.push({
        title: afterCommitment.title,
        description: `added at ${afterCommitment.startTime} to ${afterCommitment.endTime}.`,
      });
      continue;
    }

    if (
      beforeCommitment.startTime === afterCommitment.startTime &&
      beforeCommitment.endTime === afterCommitment.endTime
    ) {
      unchanged.push(afterCommitment.title);
    } else {
      changed.push({
        title: afterCommitment.title,
        description: describeSingleChange(
          before,
          after,
          afterCommitment.title,
          beforeCommitment,
          afterCommitment
        ),
      });
    }
  }

  for (const beforeCommitment of before.commitments) {
    const stillExists = after.commitments.some(
      (c) => c.id === beforeCommitment.id
    );
    if (!stillExists) {
      changed.push({
        title: beforeCommitment.title,
        description: `removed from today.`,
      });
    }
  }

  const summary = changed.length === 0
    ? "nothing changed."
    : changed.map((c) => `• ${c.title} ${c.description}`).join("\n");

  return { changed, unchanged, summary };
}

export function formatChangeExplanation(explanation: ChangeExplanation): string {
  const lines = explanation.changed.map(
    (c) => `• ${c.title} ${c.description}`
  );

  if (explanation.unchanged.length > 0) {
    lines.push(`• everything else stayed unchanged.`);
  }

  return lines.join("\n");
}