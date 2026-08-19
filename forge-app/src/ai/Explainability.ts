export type SourceType = "user" | "memory" | "assumption" | "scheduler" | "planning_profile";

export interface SourcedItem<T> {
  value: T;
  source: SourceType;
  detail?: string;
}

export function fromUser<T>(value: T, detail?: string): SourcedItem<T> {
  return { value, source: "user", detail };
}

export function fromMemory<T>(value: T, detail?: string): SourcedItem<T> {
  return { value, source: "memory", detail };
}

export function fromAssumption<T>(value: T, detail?: string): SourcedItem<T> {
  return { value, source: "assumption", detail };
}

export function fromScheduler<T>(value: T, detail?: string): SourcedItem<T> {
  return { value, source: "scheduler", detail };
}

export function fromPlanningProfile<T>(value: T, detail?: string): SourcedItem<T> {
  return { value, source: "planning_profile", detail };
}

export function explainSource(item: SourcedItem<any>): string {
  switch (item.source) {
    case "user":
      return item.detail ? `you said "${item.detail}"` : "you mentioned this";
    case "memory":
      return item.detail ? `from your history: ${item.detail}` : "from your past patterns";
    case "assumption":
      return item.detail ? `I assumed ${item.detail}` : "I made an assumption";
    case "scheduler":
      return item.detail ? `scheduled because ${item.detail}` : "scheduled by the engine";
    case "planning_profile":
      return item.detail ? `from your preferences: ${item.detail}` : "from your planning profile";
  }
}

export function formatExplanation(items: SourcedItem<any>[]): string {
  return items.map(explainSource).join("; ");
}