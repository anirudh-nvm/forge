import type { TodayPlan } from "../types/todayPlan";

export type AdjustmentSuggestion = {
  label: string;
  message: string;
};

export function buildAdjustmentSuggestions(plan: TodayPlan): AdjustmentSuggestion[] {
  if (!plan || plan.commitments.length === 0) return [];

  const suggestions: AdjustmentSuggestion[] = [];

  const active = plan.commitments.filter((c) => !c.completed);
  if (active.length === 0) return suggestions;

  const fixedEvent = active.find((c) => c.locked);

  if (fixedEvent) {
    suggestions.push({
      label: `i'm leaving ${fixedEvent.title.toLowerCase()} early`,
      message: `i'm leaving ${fixedEvent.title.toLowerCase()} early`,
    });
    suggestions.push({
      label: `${fixedEvent.title.toLowerCase()} got cancelled`,
      message: `${fixedEvent.title.toLowerCase()} got cancelled`,
    });
  }

  const flexible = active.filter((c) => !c.locked);

  if (flexible.length > 0) {
    const first = flexible[0];
    const last = flexible[flexible.length - 1];

    suggestions.push({
      label: `move ${first.title.toLowerCase()} earlier`,
      message: `move ${first.title.toLowerCase()} earlier`,
    });

    if (last.title !== first.title) {
      suggestions.push({
        label: `move ${last.title.toLowerCase()} later`,
        message: `move ${last.title.toLowerCase()} later`,
      });
    } else {
      suggestions.push({
        label: `move ${first.title.toLowerCase()} later`,
        message: `move ${first.title.toLowerCase()} later`,
      });
    }

    suggestions.push({
      label: `cancel ${flexible[0].title.toLowerCase()}`,
      message: `cancel ${flexible[0].title.toLowerCase()}`,
    });

    suggestions.push({
      label: `i need another hour for ${first.title.toLowerCase()}`,
      message: `i need another hour for ${first.title.toLowerCase()}`,
    });
  }

  suggestions.push({
    label: "add a new task",
    message: "add a new task",
  });

  suggestions.push({
    label: "i'm feeling tired",
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