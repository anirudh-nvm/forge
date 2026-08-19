import type { Session, SessionOutcome } from "../types/todayPlan";

export function determineOutcome(
  session: Session,
  completed: boolean,
  progressPercent: number
): SessionOutcome {
  if (session.status === "missed") {
    return "skipped";
  }

  if (!completed) {
    if (progressPercent >= 70) {
      return "mostlyCompleted";
    }
    return "notCompleted";
  }

  if (progressPercent >= 90) {
    return "completed";
  }

  if (progressPercent >= 50) {
    return "mostlyCompleted";
  }

  return "notCompleted";
}

export function getOutcomeLabel(outcome: SessionOutcome): string {
  switch (outcome) {
    case "completed":
      return "kept";
    case "mostlyCompleted":
      return "mostly kept";
    case "notCompleted":
      return "not kept";
    case "skipped":
      return "skipped";
  }
}

export function getOutcomeMessage(outcome: SessionOutcome): string {
  switch (outcome) {
    case "completed":
      return "you kept this promise.";
    case "mostlyCompleted":
      return "you mostly kept this promise.";
    case "notCompleted":
      return "this promise wasn't kept.";
    case "skipped":
      return "this promise was skipped.";
  }
}
