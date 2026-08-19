import type { Observation, ObservationCategory } from "../observation/ObservationTypes";

export type ReflectionReason = "pattern_detected" | "trust_decline" | "streak_broken" | "user_initiated";

export type ReflectionStage = "observation" | "question" | "explanation" | "summary";

export interface ReflectionPrompt {
  observationId: string;
  category: ObservationCategory;
  observationText: string;
  question: string;
  context: string;
}

export interface ReflectionResponse {
  promptId: string;
  userExplanation: string;
  timestamp: string;
}

export interface ReflectionTurn {
  prompt: ReflectionPrompt;
  response?: ReflectionResponse;
}

export interface ReflectionSession {
  id: string;
  date: string;
  reason: ReflectionReason;
  stage: ReflectionStage;
  turns: ReflectionTurn[];
  summary?: string;
  completedAt?: string;
}

export interface ReflectionMemory {
  date: string;
  observationId: string;
  category: ObservationCategory;
  observationText: string;
  userExplanation: string;
  summary: string;
  linkedExperiments: string[];
}
