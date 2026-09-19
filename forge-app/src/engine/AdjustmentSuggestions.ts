import type { TodayPlan } from "../types/todayPlan";

export type AdjustmentSuggestion = {
  label: string;
  message: string;
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function buildAdjustmentSuggestions(plan: TodayPlan): AdjustmentSuggestion[] {
  if (!plan || plan.commitments.length === 0) return [];

  const suggestions: AdjustmentSuggestion[] = [];

  const active = plan.commitments.filter((c) => !c.completed);
  if (active.length === 0) return suggestions;

  const fixedEvent = active.find((c) => c.locked);

  if (fixedEvent) {
    const title = fixedEvent.title.toLowerCase();
    suggestions.push({
      label: pickRandom([`i'm leaving ${title} early`, `${title} ends early today`]),
      message: `i'm leaving ${title} early`,
    });
    suggestions.push({
      label: pickRandom([`${title} got cancelled`, `skip ${title} today`]),
      message: `${title} got cancelled`,
    });
  }

  const flexible = active.filter((c) => !c.locked);

  if (flexible.length > 0) {
    const first = flexible[0];
    const last = flexible[flexible.length - 1];
    const firstTitle = first.title.toLowerCase();

    suggestions.push({
      label: pickRandom([`move ${firstTitle} earlier`, `${firstTitle} should be earlier`]),
      message: `move ${firstTitle} earlier`,
    });

    const lastTitle = last.title.toLowerCase();
    if (last.title !== first.title) {
      suggestions.push({
        label: pickRandom([`move ${lastTitle} later`, `${lastTitle} should be later`]),
        message: `move ${lastTitle} later`,
      });
    } else {
      suggestions.push({
        label: pickRandom([`move ${firstTitle} later`, `${firstTitle} should be later`]),
        message: `move ${firstTitle} later`,
      });
    }

    suggestions.push({
      label: pickRandom([`cancel ${firstTitle}`, `skip ${firstTitle} today`]),
      message: `cancel ${firstTitle}`,
    });

    suggestions.push({
      label: pickRandom([`i need more time for ${firstTitle}`, `need another hour for ${firstTitle}`]),
      message: `i need another hour for ${firstTitle}`,
    });
  }

  suggestions.push({
    label: pickRandom(["add something new", "add a new task", "i have something else"]),
    message: "add a new task",
  });

  suggestions.push({
    label: pickRandom(["i'm feeling tired", "energy is low today", "i need a lighter day"]),
    message: "i'm feeling tired",
  });

  const seen = new Set<string>();
  const unique = suggestions.filter((s) => {
    const key = s.label;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique;
}