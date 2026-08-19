import type {
  Experiment,
  ExperimentStatus,
  ExperimentOutcome,
  ExperimentMetric,
  ExperimentSummary,
  LearningReport,
} from "./ExperimentTypes";
import { StorageEngine } from "../storage/StorageEngine";

let experiments: Experiment[] = [];
let loaded = false;

function generateId(): string {
  return `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function persist(): void {
  StorageEngine.saveExperiments(experiments).catch(() => {});
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export async function loadExperiments(): Promise<void> {
  if (loaded) return;
  experiments = await StorageEngine.loadExperiments();
  loaded = true;
}

export function getAll(): Experiment[] {
  return [...experiments];
}

export function getActive(): Experiment[] {
  return experiments.filter((e) => e.status === "active");
}

export function getCompleted(): Experiment[] {
  return experiments.filter((e) => e.status === "completed");
}

export function getById(id: string): Experiment | undefined {
  return experiments.find((e) => e.id === id);
}

export function create(params: {
  title: string;
  hypothesis: string;
  commitmentTitle: string;
  durationDays: number;
  metrics: ExperimentMetric[];
}): Experiment {
  const now = new Date();
  const startDate = todayStr();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + params.durationDays);

  const experiment: Experiment = {
    id: generateId(),
    title: params.title,
    hypothesis: params.hypothesis,
    commitmentTitle: params.commitmentTitle,
    status: "proposed",
    startDate,
    endDate: endDate.toISOString().split("T")[0],
    metrics: params.metrics.map((m) => ({ ...m })),
    notes: [],
    createdAt: now.toISOString(),
  };

  experiments.push(experiment);
  persist();
  return experiment;
}

export function activate(id: string): Experiment | undefined {
  const experiment = experiments.find((e) => e.id === id);
  if (!experiment || experiment.status !== "proposed") return undefined;

  experiment.status = "active";
  experiment.startDate = todayStr();
  persist();
  return experiment;
}

export function addNote(id: string, note: string): Experiment | undefined {
  const experiment = experiments.find((e) => e.id === id);
  if (!experiment) return undefined;

  experiment.notes.push(note);
  persist();
  return experiment;
}

export function updateMetric(
  id: string,
  metricName: string,
  actual: number
): Experiment | undefined {
  const experiment = experiments.find((e) => e.id === id);
  if (!experiment) return undefined;

  const metric = experiment.metrics.find((m) => m.name === metricName);
  if (!metric) return undefined;

  metric.actual = actual;
  persist();
  return experiment;
}

export function close(
  id: string,
  outcome: ExperimentOutcome
): Experiment | undefined {
  const experiment = experiments.find((e) => e.id === id);
  if (!experiment || experiment.status !== "active") return undefined;

  experiment.status = "completed";
  experiment.outcome = outcome;
  experiment.closedAt = new Date().toISOString();
  persist();
  return experiment;
}

export function cancel(id: string): Experiment | undefined {
  const experiment = experiments.find((e) => e.id === id);
  if (!experiment || experiment.status === "completed") return undefined;

  experiment.status = "cancelled";
  experiment.closedAt = new Date().toISOString();
  persist();
  return experiment;
}

export function getSummary(): ExperimentSummary {
  const active = experiments.filter((e) => e.status === "active").length;
  const completed = experiments.filter((e) => e.status === "completed");
  const successful = completed.filter((e) => e.outcome === "successful").length;
  const failed = completed.filter((e) => e.outcome === "failed").length;
  const inconclusive = completed.filter((e) => e.outcome === "inconclusive").length;

  return {
    total: experiments.length,
    active,
    completed: completed.length,
    successful,
    failed,
    inconclusive,
  };
}

export function getLearningReport(): LearningReport {
  const summary = getSummary();
  const completed = experiments.filter((e) => e.status === "completed");

  const successfulPatterns = completed
    .filter((e) => e.outcome === "successful")
    .map((e) => `${e.title}: ${e.hypothesis}`);

  const failedPatterns = completed
    .filter((e) => e.outcome === "failed")
    .map((e) => `${e.title}: ${e.hypothesis}`);

  return {
    generatedAt: new Date().toISOString(),
    experiments: [...experiments],
    summary,
    successfulPatterns,
    failedPatterns,
  };
}

export function reset(): void {
  experiments = [];
  loaded = false;
}
