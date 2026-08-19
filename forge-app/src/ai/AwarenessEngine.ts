import type { TodayPlan } from "../types/todayPlan";
import type { Intent } from "./IntentTypes";
import { understandIntent } from "./IntentEngine";
import { validateIntent } from "./IntentValidator";
import { applyIntent } from "./IntentApplier";
import { decideAction, actionMessage } from "./ConfidenceEngine";
import { interpretEnergyThroughIdentity, type IdentityContext } from "./IdentityAwareEngine";
import {
  diffPlans,
  recordObservations,
  getNotablePatterns,
  buildLearningPrompt,
  confirmPattern,
  dismissPattern,
  type PatternMemory,
} from "./PatternLearner";
import {
  addTurn,
  applyAccumulated,
  type ConversationMemory,
} from "./ConversationMemory";
import { explainChanges, formatChangeExplanation } from "./ChangeExplainer";

export type LearningPrompt = {
  patternId: string;
  message: string;
  options: { label: string; value: "remember" | "not_yet" }[];
};

export type UnderstandingReport = {
  intent?: Intent;
  status: string;
  message: string;
  action: "apply" | "ask" | "clarify";
  plan?: TodayPlan;
  explanation?: string;
  changeSummary?: string;
  learningPrompts: LearningPrompt[];
  confidence: number;
};

export type AwarenessStore = {
  patternMemory: PatternMemory;
  conversationMemory: ConversationMemory;
};

export type Awareness = {
  get store(): AwarenessStore;
  learn: (before: TodayPlan, after: TodayPlan) => void;
  getLearningPrompts: () => LearningPrompt[];
  remember: (patternId: string) => void;
  notYet: (patternId: string) => void;
  addTurn: (input: string, plan: TodayPlan) => void;
  resetConversation: () => void;
};

export function createAwareness(
  patternMemory: PatternMemory,
  conversationMemory: ConversationMemory
): Awareness {
  let store: AwarenessStore = { patternMemory, conversationMemory };

  return {
    get store() {
      return store;
    },
    learn(before, after) {
      const observations = diffPlans(before, after);
      if (observations.length === 0) return;
      store = {
        ...store,
        patternMemory: recordObservations(store.patternMemory, observations),
      };
    },
    getLearningPrompts() {
      return getNotablePatterns(store.patternMemory).map((pattern) => ({
        patternId: pattern.id,
        message: buildLearningPrompt(pattern),
        options: [
          { label: "Remember", value: "remember" as const },
          { label: "Not Yet", value: "not_yet" as const },
        ],
      }));
    },
    remember(patternId) {
      store = {
        ...store,
        patternMemory: confirmPattern(store.patternMemory, patternId),
      };
    },
    notYet(patternId) {
      store = {
        ...store,
        patternMemory: dismissPattern(store.patternMemory, patternId),
      };
    },
    addTurn(input, plan) {
      store = {
        ...store,
        conversationMemory: addTurn(store.conversationMemory, input, plan),
      };
    },
    resetConversation() {
      store = { ...store, conversationMemory: { turns: [] } };
    },
  };
}

export function understandWithAwareness(
  input: string,
  plan: TodayPlan,
  identity: IdentityContext,
  awareness: Awareness
): UnderstandingReport {
  let raw = understandIntent(input, plan);

  let intent = raw.intent;
  let status = raw.status;

  if (raw.status === "resolved" && raw.intent) {
    const validated = validateIntent(raw.intent, plan);
    status = validated.status;
    intent = validated.intent;
  }

  let resolvedIntent = intent;

  if (status === "resolved" && resolvedIntent) {
    const identityRun = interpretEnergyThroughIdentity(
      resolvedIntent,
      plan,
      identity
    );
    if (identityRun.respectsIdentity) {
      resolvedIntent = identityRun.intent;
    }
  }

  const confidence = resolvedIntent?.confidence ?? 0;
  const action = decideAction(confidence);

  let report: UnderstandingReport = {
    intent: resolvedIntent,
    status,
    message: "",
    action,
    confidence,
    learningPrompts: [],
  };

  if (status === "resolved" && resolvedIntent) {
    const before = plan;
    const { plan: after, changes } = applyIntent(before, resolvedIntent);

    awareness.learn(before, after);
    awareness.addTurn(input, before);

    const explanation = explainChanges(before, after);
    const learningPrompts = awareness.getLearningPrompts();

    report = {
      ...report,
      plan: after,
      explanation: explanation.summary,
      changeSummary: formatChangeExplanation(explanation),
      learningPrompts,
      message:
        changes.length > 0
          ? actionMessage(action, resolvedIntent)
          : "that wouldn't change anything — everything's already set that way.",
    };
  } else {
    report = {
      ...report,
      message: actionMessage(action, resolvedIntent),
    };
  }

  return report;
}

export function applyAccumulatedReport(
  plan: TodayPlan,
  awareness: Awareness
): { plan: TodayPlan; changeSummary: string; appliedIntents: Intent[] } {
  const { result, appliedIntents } = applyAccumulated(
    awareness.store.conversationMemory,
    plan
  );
  const explanation = explainChanges(plan, result.plan);

  return {
    plan: result.plan,
    changeSummary: formatChangeExplanation(explanation),
    appliedIntents,
  };
}