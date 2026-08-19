import type { TodayPlan } from "../types/todayPlan";
import type { Commitment } from "../types/commitment";
import type {
  Intent,
  IntentResolution,
  CancelCommitmentIntent,
  MoveCommitmentIntent,
  ModifyCommitmentIntent,
  DelayCommitmentIntent,
} from "./IntentTypes";

function findExact(plan: TodayPlan, target: string): Commitment | undefined {
  return plan.commitments.find(
    (c) => c.title.toLowerCase() === target.toLowerCase()
  );
}

function findFuzzy(plan: TodayPlan, target: string): Commitment[] {
  const lower = target.toLowerCase();
  return plan.commitments.filter((c) => {
    const title = c.title.toLowerCase();
    if (title === lower) return true;
    const words = lower.split(/[^a-z]+/).filter((w) => w.length > 1);
    return words.length > 0 && words.some((w) => title.includes(w));
  });
}

export function validateIntent(intent: Intent, plan: TodayPlan): IntentResolution {
  switch (intent.type) {
    case "cancel_commitment":
      return validateCancel(intent, plan);
    case "modify_commitment":
      return validateModify(intent, plan);
    case "move_commitment":
      return validateMove(intent, plan);
    case "delay_commitment":
      return validateDelay(intent, plan);
    case "add_commitment": {
      const exists = plan.commitments.some(
        (c) => c.title.toLowerCase() === intent.title.toLowerCase()
      );
      if (exists) {
        return {
          status: "not_found",
          message: `"${intent.title}" is already on today's plan. did you want to change it instead?`,
        };
      }
      return { status: "resolved", intent, message: "add validated" };
    }
    case "energy":
      return { status: "resolved", intent, message: "energy intent validated" };
    case "general_conversation":
      return { status: "general", message: "general conversation" };
  }
}

function validateCancel(
  intent: CancelCommitmentIntent,
  plan: TodayPlan
): IntentResolution {
  if (intent.target === "all") {
    const cancellable = plan.commitments.some((c) => !c.locked);
    if (!cancellable) {
      return {
        status: "locked",
        message: "everything on today's plan is locked — i can't cancel it.",
      };
    }
    return { status: "resolved", intent, message: "cancel all validated" };
  }

  const matches = findFuzzy(plan, intent.target);
  if (matches.length === 0) {
    return {
      status: "not_found",
      candidates: plan.commitments.map((c) => c.title),
      message: `i couldn't find "${intent.target}". which commitment did you mean?`,
    };
  }

  const target = matches.find((c) => c.title.toLowerCase() === intent.target.toLowerCase()) ?? matches[0];

  return {
    status: "resolved",
    intent: { ...intent, target: target.title },
    message: `cancel validated for ${target.title}`,
  };
}

function validateModify(
  intent: ModifyCommitmentIntent,
  plan: TodayPlan
): IntentResolution {
  const matches = findFuzzy(plan, intent.target);
  if (matches.length === 0) {
    return {
      status: "not_found",
      candidates: plan.commitments.map((c) => c.title),
      message: `i couldn't find "${intent.target}". which commitment did you mean?`,
    };
  }

  if (matches.length > 1) {
    return {
      status: "ambiguous",
      candidates: matches.map((c) => c.title),
      message: `that could be a few things. which one?`,
    };
  }

  const target = matches[0];

  return {
    status: "resolved",
    intent: { ...intent, target: target.title },
    message: `modify validated for ${target.title}`,
  };
}

function validateMove(
  intent: MoveCommitmentIntent,
  plan: TodayPlan
): IntentResolution {
  if (intent.target === "all") {
    const movable = plan.commitments.some((c) => !c.locked);
    if (!movable) {
      return {
        status: "locked",
        message: "everything on today's plan is locked — i can't move it.",
      };
    }
    return { status: "resolved", intent, message: "move all validated" };
  }

  const matches = findFuzzy(plan, intent.target);
  if (matches.length === 0) {
    return {
      status: "not_found",
      candidates: plan.commitments.map((c) => c.title),
      message: `i couldn't find "${intent.target}". which commitment did you mean?`,
    };
  }

  if (matches.length > 1) {
    return {
      status: "ambiguous",
      candidates: matches.map((c) => c.title),
      message: `that could be a few things. which one?`,
    };
  }

  const target = matches[0];

  return {
    status: "resolved",
    intent: { ...intent, target: target.title },
    message: `move validated for ${target.title}`,
  };
}

function validateDelay(
  intent: DelayCommitmentIntent,
  plan: TodayPlan
): IntentResolution {
  if (intent.target === "all") {
    const movable = plan.commitments.some((c) => !c.locked);
    if (!movable) {
      return {
        status: "locked",
        message: "everything on today's plan is locked — i can't move it.",
      };
    }
    return { status: "resolved", intent, message: "delay all validated" };
  }

  const matches = findFuzzy(plan, intent.target);
  if (matches.length === 0) {
    return {
      status: "not_found",
      candidates: plan.commitments.map((c) => c.title),
      message: `i couldn't find "${intent.target}". which commitment did you mean?`,
    };
  }

  if (matches.length > 1) {
    return {
      status: "ambiguous",
      candidates: matches.map((c) => c.title),
      message: `that could be a few things. which one?`,
    };
  }

  const target = matches[0];

  return {
    status: "resolved",
    intent: { ...intent, target: target.title },
    message: `delay validated for ${target.title}`,
  };
}