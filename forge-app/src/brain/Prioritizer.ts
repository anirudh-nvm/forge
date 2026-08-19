import type { ConversationAnalysis, FixedEvent, FlexibleTask, LogEntry } from "./types";
import { getKeywordsForKey } from "./PriorityKeywords";
import { BrainLogger } from "./logger/BrainLogger";

function matchesPriority(title: string, priority: string): boolean {
  const lowerTitle = title.toLowerCase();
  return getKeywordsForKey(priority).some((keyword) =>
    lowerTitle.includes(keyword.toLowerCase())
  );
}

export function prioritizeIntents(
  analysis: ConversationAnalysis,
  priorities: string[]
): {
  fixedEvents: FixedEvent[];
  flexibleTasks: FlexibleTask[];
  logs: LogEntry[];
} {
  const logs: LogEntry[] = [];

  const protectedFixedEvents = analysis.fixedEvents.map((event) => ({
    ...event,
    confidence: Math.max(event.confidence, 0.8),
  }));

  const protectedFlexibleTasks = analysis.flexibleTasks.map((task) => {
    const isPriority = priorities.some((p) => matchesPriority(task.title, p));
    return {
      ...task,
      confidence: isPriority ? Math.max(task.confidence, 0.9) : task.confidence,
    };
  });

  protectedFixedEvents.forEach((event) => {
    logs.push({ module: "Prioritizer", message: `✓ Protected: ${event.title}` });
  });

  protectedFlexibleTasks.forEach((task) => {
    const isPriority = priorities.some((p) => matchesPriority(task.title, p));
    if (isPriority) {
      logs.push({ module: "Prioritizer", message: `✓ Protected: ${task.title}` });
    } else {
      logs.push({ module: "Prioritizer", message: `⚪ Optional: ${task.title}` });
    }
  });

  BrainLogger.log("Prioritizer", {
    protectedFixed: protectedFixedEvents.length,
    protectedFlexible: protectedFlexibleTasks.filter((t) =>
      priorities.some((p) => matchesPriority(t.title, p))
    ).length,
  });

  return {
    fixedEvents: protectedFixedEvents,
    flexibleTasks: protectedFlexibleTasks,
    logs,
  };
}
