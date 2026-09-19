import * as MemoryEngine from "../memory/MemoryEngine";
import * as BeliefsEngine from "../memory/BeliefsEngine";
import * as PredictionEngine from "../memory/PredictionEngine";
import { getProfile } from "../adaptive/PlanningProfile";
import type { MemoryInsight } from "../components/intelligence/ChatMemorySurface";

export interface ChatMemoryContext {
  patterns: string[];
  predictions: string[];
  beliefs: string[];
  timePreferences: string;
  completionRates: string;
  insights: MemoryInsight[];
}

export async function buildChatMemoryContext(): Promise<ChatMemoryContext> {
  const [patterns, summaries, beliefs, profile] = await Promise.all([
    MemoryEngine.detectPatterns().catch(() => []),
    MemoryEngine.getSummaries().catch(() => []),
    BeliefsEngine.getHighConfidenceBeliefs(0.7).catch(() => []),
    getProfile(),
  ]);

  const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const predictions = await PredictionEngine.generatePredictions(dayOfWeek).catch(() => []);

  const formattedPatterns = formatPatterns(patterns);
  const formattedPredictions = formatPredictions(predictions);
  const formattedBeliefs = formatBeliefs(beliefs);
  const timePreferences = formatTimePreferences(profile);
  const completionRates = formatCompletionRates(summaries);

  const insights = buildInsights(patterns, predictions, beliefs, summaries);

  return {
    patterns: formattedPatterns,
    predictions: formattedPredictions,
    beliefs: formattedBeliefs,
    timePreferences,
    completionRates,
    insights,
  };
}

function buildInsights(
  patterns: MemoryEngine.PatternInsight[],
  predictions: PredictionEngine.Prediction[],
  beliefs: BeliefsEngine.Belief[],
  summaries: MemoryEngine.OutcomeSummary[]
): MemoryInsight[] {
  const insights: MemoryInsight[] = [];

  // Top patterns
  for (const pattern of patterns.slice(0, 2)) {
    insights.push({
      type: "pattern",
      text: `${pattern.title}: ${pattern.pattern.toLowerCase()}`,
      confidence: pattern.confidence,
    });
  }

  // High-confidence predictions
  for (const pred of predictions.slice(0, 1)) {
    insights.push({
      type: "prediction",
      text: pred.suggestion.toLowerCase(),
      confidence: pred.confidence,
    });
  }

  // High-confidence beliefs
  for (const belief of beliefs.slice(0, 1)) {
    insights.push({
      type: "belief",
      text: belief.statement.toLowerCase(),
      confidence: belief.confidence,
    });
  }

  // Completion rate insights
  for (const summary of summaries) {
    if (summary.completionRate >= 0.8 && summary.totalPlanned >= 3) {
      insights.push({
        type: "pattern",
        text: `you almost always follow through on ${summary.title.toLowerCase()}.`,
        confidence: summary.completionRate,
      });
    } else if (summary.completionRate < 0.5 && summary.totalPlanned >= 3) {
      insights.push({
        type: "prediction",
        text: `${summary.title.toLowerCase()} has been tough to keep lately.`,
        confidence: 1 - summary.completionRate,
      });
    }
  }

  return insights.slice(0, 3);
}

function formatPatterns(patterns: MemoryEngine.PatternInsight[]): string[] {
  return patterns.map((p) => `${p.title}: ${p.pattern.toLowerCase()}`);
}

function formatPredictions(predictions: PredictionEngine.Prediction[]): string[] {
  return predictions.map((p) => p.suggestion.toLowerCase());
}

function formatBeliefs(beliefs: BeliefsEngine.Belief[]): string[] {
  return beliefs.map((b) => b.statement.toLowerCase());
}

function formatTimePreferences(profile: ReturnType<typeof getProfile>): string {
  if (!profile?.timePreferences) return "";
  return profile.timePreferences
    .map((p) => `${p.commitmentTitle} prefers ${p.preferredWindow}`)
    .join("; ");
}

function formatCompletionRates(summaries: MemoryEngine.OutcomeSummary[]): string {
  return summaries
    .filter((s) => s.totalPlanned >= 3)
    .map((s) => `${s.title}: ${Math.round(s.completionRate * 100)}%`)
    .join("; ");
}
