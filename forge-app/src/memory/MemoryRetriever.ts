import type { MemoryProfile, StableMemory, WorkingMemory } from "./MemoryProfile";
import type { Observation } from "../observation/ObservationTypes";
import type { Experiment } from "./ExperimentTypes";
import type { ReflectionMemory } from "../reflection/ReflectionTypes";
import type { TrustScore } from "../types/todayPlan";

export interface RetrievalContext {
  situation: string;
  keywords: string[];
  commitmentTitle?: string;
  lifeSeason?: string;
}

export interface RetrievedMemory {
  stable: StableMemory;
  working: WorkingMemory;
  relevantObservations: Observation[];
  relevantExperiments: Experiment[];
  relevantReflections: ReflectionMemory[];
  trustContext: TrustContext;
}

export interface TrustContext {
  currentScore: number;
  level: string;
  trajectory: "improving" | "stable" | "declining";
  recentSessions: { outcome: string; commitment: string }[];
}

function scoreObservationRelevance(obs: Observation, context: RetrievalContext): number {
  let score = 0;

  if (context.commitmentTitle && obs.metadata?.commitmentTitle === context.commitmentTitle) {
    score += 0.5;
  }

  for (const keyword of context.keywords) {
    if (obs.text.toLowerCase().includes(keyword.toLowerCase())) {
      score += 0.2;
    }
    if (obs.metadata?.commitmentTitle?.toLowerCase().includes(keyword.toLowerCase())) {
      score += 0.3;
    }
  }

  score += obs.confidence * 0.2;

  if (obs.status === "new") score += 0.1;

  return score;
}

function scoreExperimentRelevance(exp: Experiment, context: RetrievalContext): number {
  let score = 0;

  if (context.commitmentTitle && exp.commitmentTitle === context.commitmentTitle) {
    score += 0.5;
  }

  for (const keyword of context.keywords) {
    if (exp.title.toLowerCase().includes(keyword.toLowerCase())) {
      score += 0.3;
    }
    if (exp.hypothesis.toLowerCase().includes(keyword.toLowerCase())) {
      score += 0.2;
    }
  }

  if (exp.status === "active") score += 0.2;
  if (exp.status === "completed") score += 0.1;

  return score;
}

function scoreReflectionRelevance(ref: ReflectionMemory, context: RetrievalContext): number {
  let score = 0;

  for (const keyword of context.keywords) {
    if (ref.observationText.toLowerCase().includes(keyword.toLowerCase())) {
      score += 0.3;
    }
    if (ref.userExplanation.toLowerCase().includes(keyword.toLowerCase())) {
      score += 0.2;
    }
  }

  return score;
}

function buildTrustContext(
  trustScore: TrustScore,
  observations: Observation[]
): TrustContext {
  const history = trustScore.history;
  const recent = history.slice(-5);
  const trajectory = getTrajectory(recent);

  return {
    currentScore: trustScore.current,
    level: getTrustLevel(trustScore.current),
    trajectory,
    recentSessions: recent.map((e) => ({
      outcome: e.outcome,
      commitment: e.sessionId,
    })),
  };
}

function getTrajectory(
  history: { trustChange: number }[]
): "improving" | "stable" | "declining" {
  if (history.length < 2) return "stable";
  const recent = history.slice(-3);
  const avgChange = recent.reduce((sum, e) => sum + e.trustChange, 0) / recent.length;
  if (avgChange > 2) return "improving";
  if (avgChange < -2) return "declining";
  return "stable";
}

function getTrustLevel(score: number): string {
  if (score >= 80) return "strong";
  if (score >= 60) return "building";
  if (score >= 40) return "developing";
  if (score >= 20) return "recovering";
  return "rebuilding";
}

export function retrieveMemory(
  memory: MemoryProfile,
  observations: Observation[],
  experiments: Experiment[],
  reflections: ReflectionMemory[],
  trustScore: TrustScore,
  context: RetrievalContext
): RetrievedMemory {
  const scoredObs = observations
    .map((obs) => ({ obs, score: scoreObservationRelevance(obs, context) }))
    .filter((x) => x.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.obs)
    .slice(0, 10);

  const scoredExp = experiments
    .map((exp) => ({ exp, score: scoreExperimentRelevance(exp, context) }))
    .filter((x) => x.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.exp)
    .slice(0, 5);

  const scoredRef = reflections
    .map((ref) => ({ ref, score: scoreReflectionRelevance(ref, context) }))
    .filter((x) => x.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.ref)
    .slice(0, 5);

  return {
    stable: memory.stable,
    working: memory.working,
    relevantObservations: scoredObs,
    relevantExperiments: scoredExp,
    relevantReflections: scoredRef,
    trustContext: buildTrustContext(trustScore, observations),
  };
}

export function extractKeywords(text: string): string[] {
  const stopwords = new Set([
    "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your",
    "yours", "yourself", "yourselves", "he", "him", "his", "himself", "she", "her",
    "hers", "herself", "it", "its", "itself", "they", "them", "their", "theirs",
    "themselves", "what", "which", "who", "whom", "this", "that", "these", "those",
    "am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "having", "do", "does", "did", "doing", "a", "an", "the", "and", "but", "if",
    "or", "because", "as", "until", "while", "of", "at", "by", "for", "with",
    "about", "against", "between", "through", "during", "before", "after", "above",
    "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", "under",
    "again", "further", "then", "once", "here", "there", "when", "where", "why",
    "how", "all", "both", "each", "few", "more", "most", "other", "some", "such",
    "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s",
    "t", "can", "will", "just", "don", "should", "now", "today", "tomorrow",
    "yesterday", "feel", "feeling", "think", "like", "want", "need", "know",
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopwords.has(word));
}
