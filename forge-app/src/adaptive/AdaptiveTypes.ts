export type TimeWindow = "morning" | "afternoon" | "evening";

export interface TimePreference {
  commitmentTitle: string;
  preferredWindow: TimeWindow;
  confidence: number;
  basedOnExperiments: string[];
}

export interface DurationPreference {
  commitmentTitle: string;
  preferredMinutes: number;
  confidence: number;
}

export interface AvoidancePreference {
  commitmentTitle: string;
  avoidAfter: string;
  confidence: number;
  reason: string;
}

export interface PlanningPreferences {
  timePreferences: TimePreference[];
  durationPreferences: DurationPreference[];
  avoidancePreferences: AvoidancePreference[];
  generatedAt: string;
  windowDays: number;
}

export interface PlanningProfile {
  id: string;
  timePreferences: TimePreference[];
  durationPreferences: DurationPreference[];
  avoidancePreferences: AvoidancePreference[];
  createdAt: string;
  updatedAt: string;
}

export interface AdaptationProposal {
  id: string;
  type: "reorder" | "reschedule" | "adjust_duration";
  currentPlan: { title: string; startTime: string; endTime: string };
  proposedPlan: { title: string; startTime: string; endTime: string };
  reason: string;
  confidence: number;
  experimentId?: string;
  createdAt: string;
}

export interface AdaptationResult {
  accepted: AdaptationProposal[];
  rejected: AdaptationProposal[];
  appliedAt: string;
}
