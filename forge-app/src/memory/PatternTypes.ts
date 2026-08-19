import type { MemoryWindow } from "./MemoryTypes";

export interface Pattern {
  id: string;
  type: PatternType;
  confidence: number;
}

export type PatternType =
  | "completion_rate"
  | "time_preference"
  | "adjustment_frequency"
  | "trust_trend"
  | "commitment_consistency";

export interface CompletionRatePattern extends Pattern {
  type: "completion_rate";
  commitment: string;
  completed: number;
  total: number;
  rate: number;
}

export interface TimePreferencePattern extends Pattern {
  type: "time_preference";
  preferred: "morning" | "afternoon" | "evening";
  counts: { morning: number; afternoon: number; evening: number };
}

export interface AdjustmentFrequencyPattern extends Pattern {
  type: "adjustment_frequency";
  adjustments: number;
  totalSessions: number;
  ratio: number;
}

export interface TrustTrendPattern extends Pattern {
  type: "trust_trend";
  direction: "up" | "down" | "stable";
  startScore: number;
  endScore: number;
}

export interface CommitmentConsistencyPattern extends Pattern {
  type: "commitment_consistency";
  commitments: { title: string; rate: number }[];
}

export type AnyPattern =
  | CompletionRatePattern
  | TimePreferencePattern
  | AdjustmentFrequencyPattern
  | TrustTrendPattern
  | CommitmentConsistencyPattern;

export interface PatternReport {
  generatedAt: string;
  windowDays: number;
  patterns: AnyPattern[];
}
