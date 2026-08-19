import type { BrainInput, PreprocessorOutput, ExtractedItem, LogEntry } from "./types";
import type { BrainLogger as BrainLoggerType } from "./logger/BrainLogger";
import { BrainLogger } from "./logger/BrainLogger";
import { splitSentences } from "./pipeline/SentenceSplitter";
import { cleanFillers } from "./pipeline/FillerCleaner";
import { classifySentence } from "./pipeline/IntentClassifier";
import { getDefaults } from "./pipeline/EventDefaults";
import { detectDayExpression } from "./pipeline/TimeExpressions";
import { parseTimeToDecimal } from "../utils/timeUtils";

function formatHour(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display}:00 ${period}`;
}

function parseTimeTo24h(timeStr: string): number {
  return Math.floor(parseTimeToDecimal(timeStr));
}

function applyDefaults(name: string, startTime: string, endTime: string): { startTime: string; endTime: string } {
  if (startTime && endTime) return { startTime, endTime };

  const defaults = getDefaults(name);
  if (!defaults) return { startTime, endTime };

  if (!startTime && endTime) {
    return { startTime: formatHour(defaults.defaultStartHour), endTime };
  }

  if (startTime && !endTime) {
    const startH = parseTimeTo24h(startTime);
    const endH = startH + Math.round(defaults.defaultDurationMinutes / 60);
    return { startTime, endTime: formatHour(endH) };
  }

  return { startTime: formatHour(defaults.defaultStartHour), endTime: formatHour(defaults.defaultStartHour + Math.round(defaults.defaultDurationMinutes / 60)) };
}

export function preprocessConversation(input: BrainInput): {
  output: PreprocessorOutput;
  logs: LogEntry[];
} {
  const logs: LogEntry[] = [];
  const sentences = splitSentences(input.conversation);

  logs.push({ module: "Preprocessor", message: `✓ Split into ${sentences.length} sentences` });

  const items: ExtractedItem[] = [];
  const deferredItems: ExtractedItem[] = [];
  const removedFillers: string[] = [];

  for (const sentence of sentences) {
    const { cleaned, removed } = cleanFillers(sentence);
    removedFillers.push(...removed);

    const classified = classifySentence(cleaned, sentence);
    const { daysFromNow } = detectDayExpression(sentence);

    if (classified.intent === "ignore") {
      logs.push({ module: "Preprocessor", message: `  Ignored: "${sentence}"` });
      continue;
    }

    if (classified.intent === "fixed_event" && classified.entity) {
      const times = applyDefaults(classified.entity, classified.startTime || "", classified.endTime || "");
      const item: ExtractedItem = {
        type: "fixed_event",
        name: classified.entity,
        startTime: times.startTime,
        endTime: times.endTime,
        confidence: 0.95,
        daysFromNow: daysFromNow > 0 ? daysFromNow : undefined,
      };
      (daysFromNow > 0 ? deferredItems : items).push(item);
      logs.push({ module: "Preprocessor", message: `  FixedEvent: ${classified.entity} ${times.startTime}-${times.endTime}` });
    }

    if (classified.intent === "task" && classified.entity) {
      const item: ExtractedItem = {
        type: "task",
        name: classified.entity,
        quantity: classified.quantity,
        unit: classified.unit,
        constraints: classified.constraints,
        confidence: classified.constraints.some(c => c.type === "anytime") ? 0.60 : 0.80,
        daysFromNow: daysFromNow > 0 ? daysFromNow : undefined,
      };
      (daysFromNow > 0 ? deferredItems : items).push(item);
      const cDesc = classified.constraints.map(c => `${c.type}${c.target ? ` ${c.target}` : ""}`).join(", ");
      logs.push({ module: "Preprocessor", message: `  Task: ${classified.entity} [${cDesc}]` });
    }
  }

  const totalEvents = items.filter(i => i.type === "fixed_event").length;
  const totalTasks = items.filter(i => i.type === "task").length;

  const avgConfidence = items.length > 0
    ? items.reduce((sum, item) => sum + item.confidence, 0) / items.length
    : 0.3;

  const output: PreprocessorOutput = {
    extractedItems: items,
    deferredItems,
    detectedTimes: [],
    matchedPatterns: [],
    removedFillers,
    confidence: Math.round(avgConfidence * 100) / 100,
  };

  logs.push({ module: "Preprocessor", message: `✓ Found ${totalEvents} fixed events, ${totalTasks} tasks` });
  if (deferredItems.length > 0) {
    logs.push({ module: "Preprocessor", message: `✓ Deferred ${deferredItems.length} item(s) to a future day` });
  }
  logs.push({ module: "Preprocessor", message: `✓ Confidence: ${output.confidence}` });

  BrainLogger.log("Preprocessor", {
    events: totalEvents,
    tasks: totalTasks,
    fillersRemoved: removedFillers.length,
    confidence: output.confidence,
  });

  return { output, logs };
}
