import type { Prediction } from "../memory/PredictionEngine";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getPredictionTone(type: Prediction["type"]): string {
  switch (type) {
    case "reschedule":
      return pickRandom(["heads up,", "just so you know,", "fair warning,"]);
    case "adjust_duration":
      return pickRandom(["based on your patterns,", "you usually take longer,"]);
    case "add_buffer":
      return pickRandom(["you might want to add buffer,", "based on past sessions,"]);
    case "skip_warning":
      return pickRandom(["i've noticed a trend,", "looking at your history,"]);
  }
}

export function formatPredictionsForChat(predictions: Prediction[]): string {
  if (predictions.length === 0) return "";

  return predictions
    .slice(0, 2)
    .map((p) => {
      const tone = getPredictionTone(p.type);
      return `${tone} ${p.suggestion.toLowerCase()}`;
    })
    .join(" ");
}
