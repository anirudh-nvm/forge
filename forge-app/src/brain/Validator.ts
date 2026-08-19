import type { ConversationAnalysis, ValidationResult, LogEntry } from "./types";
import { BrainLogger } from "./logger/BrainLogger";

const REQUIRED_FIELDS = ["fixedEvents", "flexibleTasks", "constraints", "preferences", "emotion"];

export function validateAnalysis(data: unknown): {
  isValid: boolean;
  errors: string[];
  logs: LogEntry[];
} {
  const logs: LogEntry[] = [];
  const errors: string[] = [];

  if (typeof data !== "object" || data === null) {
    errors.push("Invalid data type: expected object");
    logs.push({ module: "Validator", message: "✗ Invalid data type" });
    BrainLogger.log("Validator", { isValid: false, errors });
    return { isValid: false, errors, logs };
  }

  const obj = data as Record<string, unknown>;

  for (const field of REQUIRED_FIELDS) {
    if (!(field in obj)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if ("fixedEvents" in obj && !Array.isArray(obj.fixedEvents)) {
    errors.push("Wrong type: fixedEvents must be an array");
  }

  if ("flexibleTasks" in obj && !Array.isArray(obj.flexibleTasks)) {
    errors.push("Wrong type: flexibleTasks must be an array");
  }

  if ("constraints" in obj && !Array.isArray(obj.constraints)) {
    errors.push("Wrong type: constraints must be an array");
  }

  if ("preferences" in obj && !Array.isArray(obj.preferences)) {
    errors.push("Wrong type: preferences must be an array");
  }

  if ("emotion" in obj) {
    const emotion = obj.emotion;
    if (typeof emotion !== "object" || emotion === null) {
      errors.push("Wrong type: emotion must be an object");
    } else {
      const emotionObj = emotion as Record<string, unknown>;
      if ("mood" in emotionObj && typeof emotionObj.mood !== "string") {
        errors.push("Wrong type: emotion.mood must be a string");
      }
      if ("confidence" in emotionObj && typeof emotionObj.confidence !== "number") {
        errors.push("Wrong type: emotion.confidence must be a number");
      }
    }
  }

  const isValid = errors.length === 0;

  if (isValid) {
    logs.push({ module: "Validator", message: "✓ Valid response" });
  } else {
    errors.forEach((error) => {
      logs.push({ module: "Validator", message: `✗ ${error}` });
    });
  }

  BrainLogger.log("Validator", { isValid, errors });

  return { isValid, errors, logs };
}
