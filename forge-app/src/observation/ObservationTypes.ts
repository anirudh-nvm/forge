export type ObservationCategory =
  | "consistency"
  | "timing"
  | "energy"
  | "capacity"
  | "identity"
  | "rhythm";

export type ObservationStatus = "new" | "confirmed" | "dismissed" | "resolved";

export interface Observation {
  id: string;
  category: ObservationCategory;
  text: string;
  confidence: number;
  supportingEvents: SupportingEvent[];
  firstSeen: string;
  lastSeen: string;
  status: ObservationStatus;
  discussedAt?: string;
  resolvedAt?: string;
  metadata?: ObservationMetadata;
}

export interface SupportingEvent {
  id: string;
  timestamp: string;
  type: string;
  title: string;
  details?: string;
}

export interface ObservationMetadata {
  commitmentTitle?: string;
  patternType?: string;
  sampleSize?: number;
  trendDirection?: "up" | "down" | "stable";
  relatedObservationIds?: string[];
}

export interface ObservationGroup {
  category: ObservationCategory;
  observations: Observation[];
  highestConfidence: number;
  totalCount: number;
}

export interface ObservationEngineInput {
  patterns: AnyPattern[];
  timelineEvents: TimelineEvent[];
  trustHistory: TrustSnapshot[];
  identityContext?: IdentityContext;
  activeExperiments?: ExperimentSummary[];
}

export interface IdentityContext {
  lifeSeason?: string;
  currentPriorities?: string[];
  activeGoals?: string[];
}

export interface ExperimentSummary {
  id: string;
  title: string;
  hypothesis: string;
  commitmentTitle: string;
  status: "proposed" | "active" | "completed" | "cancelled";
  outcome?: "successful" | "failed";
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: "planCreated" | "movedEarlier" | "movedLater" | "deleted" | "added" | "durationUpdated" | "locked" | "unlocked" | "completed" | "started" | "skipped";
  commitmentId?: string;
  title: string;
  details?: string;
}

export interface TrustSnapshot {
  date: string;
  score: number;
}

export type PatternType =
  | "completion_rate"
  | "time_preference"
  | "adjustment_frequency"
  | "trust_trend"
  | "commitment_consistency";

export interface Pattern {
  id: string;
  type: PatternType;
  confidence: number;
}

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

export interface ObservationEngineOutput {
  observations: Observation[];
  groups: ObservationGroup[];
  triggeredForReflection: Observation[];
}