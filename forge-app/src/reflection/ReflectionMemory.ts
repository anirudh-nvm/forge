import type { ReflectionMemory, ReflectionSession } from "./ReflectionTypes";
import { StorageEngine } from "../storage/StorageEngine";

export function createReflectionMemory(session: ReflectionSession): ReflectionMemory | null {
  if (!session.completedAt || session.turns.length === 0) return null;

  const turn = session.turns.find((t) => t.response);
  if (!turn) return null;

  return {
    date: session.date,
    observationId: turn.prompt.observationId,
    category: turn.prompt.category,
    observationText: turn.prompt.observationText,
    userExplanation: turn.response!.userExplanation,
    summary: session.summary ?? "",
    linkedExperiments: [],
  };
}

export async function saveReflectionMemory(memory: ReflectionMemory): Promise<void> {
  const existing = await StorageEngine.loadReflectionMemory();
  const updated = [...existing.filter((m) => m.observationId !== memory.observationId), memory];
  await StorageEngine.saveReflectionMemory(updated);
}

export async function loadReflectionMemory(): Promise<ReflectionMemory[]> {
  return StorageEngine.loadReflectionMemory();
}

export async function clearReflectionMemory(): Promise<void> {
  await StorageEngine.clearReflectionMemory();
}
