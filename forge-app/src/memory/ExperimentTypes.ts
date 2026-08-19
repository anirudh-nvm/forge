export type ExperimentStatus = "proposed" | "active" | "completed" | "cancelled";

export type ExperimentOutcome = "successful" | "failed" | "inconclusive";

export interface ExperimentMetric {
  name: string;
  baseline: number;
  target: number;
  actual?: number;
}

export interface Experiment {
  id: string;
  title: string;
  hypothesis: string;
  commitmentTitle: string;
  status: ExperimentStatus;
  startDate: string;
  endDate: string;
  metrics: ExperimentMetric[];
  outcome?: ExperimentOutcome;
  notes: string[];
  createdAt: string;
  closedAt?: string;
}

export interface ExperimentSummary {
  total: number;
  active: number;
  completed: number;
  successful: number;
  failed: number;
  inconclusive: number;
}

export interface LearningReport {
  generatedAt: string;
  experiments: Experiment[];
  summary: ExperimentSummary;
  successfulPatterns: string[];
  failedPatterns: string[];
}
