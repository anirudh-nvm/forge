import type { StableMemory } from "./MemoryProfile";
import type { Observation } from "../observation/ObservationTypes";

export type MemoryCandidateStatus = "pending" | "approved" | "rejected";

export interface MemoryCandidate {
  id: string;
  field: keyof StableMemory;
  currentValue: string;
  proposedValue: string;
  reason: string;
  observationIds: string[];
  status: MemoryCandidateStatus;
  createdAt: string;
  resolvedAt?: string;
}

export interface MemoryCandidateContext {
  stableMemory: StableMemory;
  observations: Observation[];
}

function generateId(): string {
  return `mc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function detectRhythmCandidate(
  stable: StableMemory,
  observations: Observation[]
): MemoryCandidate | null {
  const rhythmObs = observations.filter(
    (o) => o.category === "rhythm" && o.confidence >= 0.7
  );

  if (rhythmObs.length === 0) return null;

  for (const obs of rhythmObs) {
    if (obs.text.toLowerCase().includes("morning") && stable.rhythm.studyPreference !== "morning") {
      return {
        id: generateId(),
        field: "rhythm",
        currentValue: JSON.stringify(stable.rhythm),
        proposedValue: JSON.stringify({ ...stable.rhythm, studyPreference: "morning" }),
        reason: obs.text,
        observationIds: [obs.id],
        status: "pending",
        createdAt: new Date().toISOString(),
      };
    }

    if (obs.text.toLowerCase().includes("evening") && stable.rhythm.studyPreference !== "evening") {
      return {
        id: generateId(),
        field: "rhythm",
        currentValue: JSON.stringify(stable.rhythm),
        proposedValue: JSON.stringify({ ...stable.rhythm, studyPreference: "evening" }),
        reason: obs.text,
        observationIds: [obs.id],
        status: "pending",
        createdAt: new Date().toISOString(),
      };
    }
  }

  return null;
}

function detectPriorityCandidate(
  stable: StableMemory,
  observations: Observation[]
): MemoryCandidate | null {
  const identityObs = observations.filter(
    (o) => o.category === "identity" && o.confidence >= 0.8 && o.status === "confirmed"
  );

  if (identityObs.length === 0) return null;

  for (const obs of identityObs) {
    const text = obs.text.toLowerCase();
    if (text.includes("college") && text.includes("ends") && text.includes("2 pm")) {
      const alreadyKnown = stable.constraints.some(
        (c) => c.toLowerCase().includes("college") && c.toLowerCase().includes("2")
      );
      if (!alreadyKnown) {
        return {
          id: generateId(),
          field: "constraints",
          currentValue: stable.constraints.join("; "),
          proposedValue: [...stable.constraints, "College typically ends at 2 PM"].join("; "),
          reason: obs.text,
          observationIds: [obs.id],
          status: "pending",
          createdAt: new Date().toISOString(),
        };
      }
    }
  }

  return null;
}

function detectValueCandidate(
  stable: StableMemory,
  observations: Observation[]
): MemoryCandidate | null {
  const highConfObs = observations.filter(
    (o) => o.confidence >= 0.85 && o.status === "confirmed" && o.category === "identity"
  );

  if (highConfObs.length < 2) return null;

  return {
    id: generateId(),
    field: "values",
    currentValue: stable.values.join(", "),
    proposedValue: stable.values.join(", "),
    reason: `${highConfObs.length} confirmed identity observations suggest consistent values`,
    observationIds: highConfObs.map((o) => o.id),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

export function findMemoryCandidates(ctx: MemoryCandidateContext): MemoryCandidate[] {
  const candidates: MemoryCandidate[] = [];

  const rhythm = detectRhythmCandidate(ctx.stableMemory, ctx.observations);
  if (rhythm) candidates.push(rhythm);

  const priority = detectPriorityCandidate(ctx.stableMemory, ctx.observations);
  if (priority) candidates.push(priority);

  const value = detectValueCandidate(ctx.stableMemory, ctx.observations);
  if (value) candidates.push(value);

  return candidates;
}

export function approveCandidate(
  candidate: MemoryCandidate,
  stable: StableMemory
): { updated: StableMemory; candidate: MemoryCandidate } {
  const now = new Date().toISOString();

  if (candidate.field === "rhythm") {
    const proposed = JSON.parse(candidate.proposedValue);
    return {
      updated: { ...stable, rhythm: proposed, lastUpdated: now },
      candidate: { ...candidate, status: "approved", resolvedAt: now },
    };
  }

  if (candidate.field === "constraints") {
    const newConstraints = candidate.proposedValue.split("; ").filter(Boolean);
    return {
      updated: { ...stable, constraints: newConstraints, lastUpdated: now },
      candidate: { ...candidate, status: "approved", resolvedAt: now },
    };
  }

  if (candidate.field === "values") {
    const newValues = candidate.proposedValue.split(", ").filter(Boolean);
    return {
      updated: { ...stable, values: newValues, lastUpdated: now },
      candidate: { ...candidate, status: "approved", resolvedAt: now },
    };
  }

  return {
    updated: stable,
    candidate: { ...candidate, status: "approved", resolvedAt: now },
  };
}

export function rejectCandidate(candidate: MemoryCandidate): MemoryCandidate {
  return { ...candidate, status: "rejected", resolvedAt: new Date().toISOString() };
}
