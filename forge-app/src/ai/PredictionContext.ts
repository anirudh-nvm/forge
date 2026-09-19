import * as PredictionEngine from "../memory/PredictionEngine";
import * as MemoryEngine from "../memory/MemoryEngine";
import type { Prediction } from "../memory/PredictionEngine";

export interface PredictionContext {
  predictions: Prediction[];
  relevantPredictions: Prediction[];
  hasWarnings: boolean;
}

export async function buildPredictionContext(userInput: string): Promise<PredictionContext> {
  const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const predictions = await PredictionEngine.generatePredictions(dayOfWeek).catch(() => []);

  // Find predictions relevant to what the user is mentioning
  const relevantPredictions = findRelevantPredictions(predictions, userInput);

  return {
    predictions,
    relevantPredictions,
    hasWarnings: predictions.length > 0,
  };
}

function findRelevantPredictions(predictions: Prediction[], userInput: string): Prediction[] {
  const inputLower = userInput.toLowerCase();
  const relevant: Prediction[] = [];

  for (const pred of predictions) {
    const titleLower = pred.title.toLowerCase();
    // Check if user mentions this task
    if (inputLower.includes(titleLower) || titleLower.includes(inputLower.split(" ")[0])) {
      relevant.push(pred);
    }
  }

  // If no specific match, return high-confidence predictions
  if (relevant.length === 0) {
    return predictions
      .filter((p) => p.confidence >= 0.7)
      .slice(0, 2);
  }

  return relevant.slice(0, 2);
}

export function formatPredictionsForLLM(predictions: Prediction[]): string {
  if (predictions.length === 0) return "";

  const formatted = predictions.map((p) => {
    const icon = p.type === "reschedule" ? "📅" : p.type === "adjust_duration" ? "⏱️" : p.type === "add_buffer" ? "➕" : "⚠️";
    return `${icon} ${p.title}: ${p.suggestion}`;
  });

  return `\n\nPREDICTIONS BASED ON HISTORY:\n${formatted.join("\n")}`;
}
