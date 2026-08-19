import type { TodayPlan } from "../types/todayPlan";
import type { IntentResolution } from "./IntentTypes";
import { applyIntent } from "./IntentApplier";

export type SuggestionOption = {
  label: string;
  intent: string;
};

export type ConversationalResponse = {
  message: string;
  options: SuggestionOption[];
  showConfirmation: boolean;
};

function morningCommitments(plan: TodayPlan, boundary: string): string[] {
  const boundaryMin = parseBoundary(boundary);
  if (boundaryMin === null) return [];
  return plan.commitments
    .filter((c) => parseBoundary(c.startTime) !== null && parseBoundary(c.startTime)! < boundaryMin)
    .map((c) => c.title);
}

function parseBoundary(time: string): number | null {
  const m = time.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const p = m[3]?.toUpperCase();
  if (p === "PM" && h !== 12) h += 12;
  if (p === "AM" && h === 12) h = 0;
  if (!p && h < 8) h += 12;
  return h * 60 + min;
}

export function buildSuggestionOptions(
  before: TodayPlan,
  after: TodayPlan,
  resolution: IntentResolution
): SuggestionOption[] {
  const options: SuggestionOption[] = [];
  const intent = resolution.intent;

  if (!intent) {
    return options;
  }

  if (resolution.status === "ambiguous" && resolution.candidates) {
    for (const candidate of resolution.candidates.slice(0, 3)) {
      options.push({
        label: candidate,
        intent: `the ${candidate.toLowerCase()} one`,
      });
    }
    return options;
  }

  const newPlan = after;

  if (intent.type === "cancel_commitment" && intent.target === "all") {
    options.push({ label: "keep college", intent: "keep college" });
    return options;
  }

  if (intent.type === "modify_commitment") {
    const affected = newPlan.commitments.filter((c) =>
      before.commitments.some(
        (o) => o.id === c.id && (o.startTime !== c.startTime || o.endTime !== c.endTime)
      )
    );

    const moved = affected[0];
    if (moved) {
      options.push({
        label: `move ${moved.title.toLowerCase()} to ${moved.startTime}`,
        intent: `move ${moved.title.toLowerCase()} to ${moved.startTime}`,
      });
    }

    const untouched = newPlan.commitments.filter(
      (c) =>
        before.commitments.some(
          (o) => o.id === c.id && o.startTime === c.startTime && o.endTime === c.endTime
        ) && !c.locked
    );

    for (const c of untouched.slice(0, 3)) {
      options.push({
        label: `keep ${c.title.toLowerCase()}`,
        intent: `keep ${c.title.toLowerCase()}`,
      });
    }

    return options;
  }

  if (intent.type === "move_commitment" || intent.type === "delay_commitment") {
    const target = newPlan.commitments.find(
      (c) => c.title.toLowerCase() === intent.target.toLowerCase()
    );
    if (target) {
      options.push({
        label: `move ${target.title.toLowerCase()} to ${target.startTime}`,
        intent: `move ${target.title.toLowerCase()} to ${target.startTime}`,
      });
    }
    return options;
  }

  return options;
}

export function buildConversationalResponse(
  before: TodayPlan,
  after: TodayPlan,
  resolution: IntentResolution
): ConversationalResponse {
  if (resolution.status === "ambiguous" || resolution.status === "not_found") {
    return {
      message: resolution.message,
      options: resolution.candidates
        ? resolution.candidates.slice(0, 3).map((c) => ({
            label: c,
            intent: `the ${c.toLowerCase()} one`,
          }))
        : [],
      showConfirmation: false,
    };
  }

  const intent = resolution.intent;

  if (resolution.status === "locked") {
    return { message: resolution.message, options: [], showConfirmation: false };
  }

  if (!intent || intent.type === "general_conversation") {
    return {
      message: "i'm listening. what's on your mind?",
      options: [],
      showConfirmation: false,
    };
  }

  const { changes, affectedWindow } = applyIntent(before, intent);
  const options = buildSuggestionOptions(before, after, resolution);

  if (changes.length === 0) {
    return {
      message: "that wouldn't change anything — everything's already set that way.",
      options: [],
      showConfirmation: false,
    };
  }

  const detail = changes.map((c) => c.detail).join(", ");

  let message: string;
  switch (intent.type) {
    case "cancel_commitment":
      message =
        intent.target === "all"
          ? "that clears everything. want to keep anything?"
          : `ok — removing ${intent.target.toLowerCase()}.`;
      break;
    case "add_commitment":
      message = `adding ${intent.title.toLowerCase()}${affectedWindow !== "no change" ? ` — it fits after ${affectedWindow.toLowerCase()}` : ""}.`;
      break;
    case "modify_commitment":
      message = `that moves your ${intent.target.toLowerCase()} window: ${detail}.`;
      break;
    case "move_commitment":
      message = `shifting ${intent.target.toLowerCase()} ${intent.direction}.`;
      break;
    case "delay_commitment":
      message = `delaying ${intent.target.toLowerCase()} by ${intent.minutes} minutes.`;
      break;
    case "energy":
      message =
        intent.level === "tired"
          ? "i hear you. want to drop something low-priority to take the pressure off?"
          : "take it easy — i won't add anything heavy.";
      break;
    default:
      message = "got it.";
  }

  const showConfirmation =
    intent.type === "modify_commitment" ||
    intent.type === "move_commitment" ||
    intent.type === "delay_commitment" ||
    intent.type === "cancel_commitment";

  return { message, options, showConfirmation };
}