import type { BrainInput, PreprocessorOutput, ConversationAnalysis, LogEntry, ExtractedTask } from "./types";
import { BrainLogger } from "./logger/BrainLogger";

export function analyzeConversation(
  preprocessed: PreprocessorOutput,
  input: BrainInput
): {
  analysis: ConversationAnalysis;
  logs: LogEntry[];
} {
  const logs: LogEntry[] = [];

  const fixedEvents = preprocessed.extractedItems
    .filter((item) => item.type === "fixed_event")
    .map((item) => ({
      title: item.name,
      startTime: item.startTime,
      endTime: item.endTime,
      confidence: item.confidence,
    }));

  const flexibleTasks = preprocessed.extractedItems
    .filter((item) => item.type === "task")
    .map((item) => ({
      title: item.name,
      estimatedMinutes: item.quantity && item.unit?.includes("minute")
        ? item.quantity
        : item.quantity && item.unit?.includes("hour")
          ? item.quantity * 60
          : undefined,
      constraints: item.constraints,
      confidence: item.confidence,
    }));

  const constraints = preprocessed.extractedItems
    .filter((item): item is ExtractedTask => item.type === "task")
    .flatMap((item) =>
      item.constraints.map((c) => ({
        description: `${c.type}${c.target ? ` ${c.target}` : ""}`,
        confidence: item.confidence,
      }))
    );

  const analysis: ConversationAnalysis = {
    fixedEvents,
    flexibleTasks,
    constraints,
    preferences: [],
    emotion: { mood: "unknown", confidence: 0 },
    rawConversation: input.conversation,
  };

  logs.push({ module: "Analyzer", message: `✓ ${fixedEvents.length} events, ${flexibleTasks.length} tasks, ${constraints.length} constraints` });

  BrainLogger.log("Analyzer", {
    fixedEvents: fixedEvents.length,
    tasks: flexibleTasks.length,
    constraints: constraints.length,
  });

  return { analysis, logs };
}
