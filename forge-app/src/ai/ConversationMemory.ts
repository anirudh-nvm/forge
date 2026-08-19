import type { TodayPlan } from "../types/todayPlan";
import type { Intent } from "./IntentTypes";
import { understandIntent } from "./IntentEngine";
import { validateIntent } from "./IntentValidator";
import { applyIntent, type ApplyResult } from "./IntentApplier";

export type ConversationTurn = {
  input: string;
  intent?: Intent;
  status: string;
  timestamp: string;
};

export type ConversationMemory = {
  turns: ConversationTurn[];
};

export function createEmptyConversationMemory(): ConversationMemory {
  return { turns: [] };
}

export function addTurn(
  memory: ConversationMemory,
  input: string,
  plan: TodayPlan,
  timestamp?: Date
): ConversationMemory {
  const raw = understandIntent(input, plan);

  let intent: Intent | undefined = raw.intent;
  let status = raw.status;

  if (raw.status === "resolved" && raw.intent) {
    const validated = validateIntent(raw.intent, plan);
    intent = validated.intent;
    status = validated.status;
  }

  return {
    turns: [
      ...memory.turns,
      {
        input,
        intent,
        status,
        timestamp: (timestamp ?? new Date()).toISOString(),
      },
    ],
  };
}

export function resetConversationMemory(): ConversationMemory {
  return createEmptyConversationMemory();
}

export function mergeIntents(intents: Intent[]): Intent[] {
  const merged: Intent[] = [];
  const seen = new Set<string>();

  for (const intent of intents) {
    const key =
      intent.type === "add_commitment"
        ? `add:${intent.title.toLowerCase()}`
        : `${intent.type}:${"target" in intent && intent.target ? String(intent.target).toLowerCase() : ""}`;

    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(intent);
  }

  return merged;
}

export function applyAccumulated(
  memory: ConversationMemory,
  plan: TodayPlan
): { result: ApplyResult; appliedIntents: Intent[]; skipped: string[] } {
  const intents = memory.turns
    .filter((t) => t.status === "resolved" && t.intent)
    .map((t) => t.intent as Intent);

  const unique = mergeIntents(intents);
  const skipped: string[] = [];
  const allChanges: ApplyResult["changes"] = [];
  let current = structuredClone(plan);

  for (const intent of unique) {
    if (intent.type === "general_conversation") {
      skipped.push(intent.message);
      continue;
    }
    const { plan: next, changes } = applyIntent(current, intent);
    if (changes.length > 0) {
      allChanges.push(...changes);
      current = next;
    } else {
      skipped.push(intent.type);
    }
  }

  const result: ApplyResult = {
    plan: current,
    changes: allChanges,
    affectedWindow: "accumulated",
  };

  return { result, appliedIntents: unique, skipped };
}

export function latestIntent(
  memory: ConversationMemory
): Intent | undefined {
  const resolved = [...memory.turns].reverse().find((t) => t.intent);
  return resolved?.intent;
}