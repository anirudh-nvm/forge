import { describe, it, expect } from "vitest";
import type { TodayPlan } from "../src/types/todayPlan";
import type { Commitment } from "../src/types/commitment";
import {
  diffPlans,
  recordObservations,
  getNotablePatterns,
  confirmPattern,
  dismissPattern,
  buildLearningPrompt,
  createEmptyPatternMemory,
} from "../src/ai/PatternLearner";
import {
  interpretEnergyThroughIdentity,
  isLearningPriority,
} from "../src/ai/IdentityAwareEngine";
import {
  createEmptyConversationMemory,
  addTurn,
  applyAccumulated,
  mergeIntents,
} from "../src/ai/ConversationMemory";
import { explainChanges, formatChangeExplanation } from "../src/ai/ChangeExplainer";
import { decideAction, actionMessage } from "../src/ai/ConfidenceEngine";
import {
  createAwareness,
  understandWithAwareness,
  applyAccumulatedReport,
} from "../src/ai/AwarenessEngine";

function makeCommitment(overrides: Partial<Commitment>): Commitment {
  return {
    id: "id-" + Math.random().toString(36).slice(2, 8),
    title: "Test",
    startTime: "9:00 AM",
    endTime: "10:00 AM",
    completed: false,
    locked: false,
    priority: "medium",
    ...overrides,
  };
}

function makePlan(commitments: Commitment[]): TodayPlan {
  return {
    greeting: "test",
    summary: [],
    commitments: [...commitments].sort((a, b) => (pt(a.startTime) - pt(b.startTime))),
    timeline: [],
    unscheduled: [],
    warnings: [],
    recommendation: "",
    status: "active",
  };
}

function pt(t: string): number {
  const m = t.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (m[3] === "PM" && h !== 12) h += 12;
  if (m[3] === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

const college = () => makeCommitment({ id: "college", title: "College", startTime: "9:00 AM", endTime: "5:00 PM", locked: true });
const gym = () => makeCommitment({ id: "gym", title: "Gym", startTime: "5:30 PM", endTime: "6:30 PM" });
const dsa = () => makeCommitment({ id: "dsa", title: "DSA Practice", startTime: "7:00 PM", endTime: "8:00 PM" });
const cat = () => makeCommitment({ id: "cat", title: "Competitive Exam", startTime: "9:00 PM", endTime: "10:00 PM" });

describe("Phase 6 — Long-Term Learning", () => {
  it("records a deviation between planned and actual", () => {
    const before = makePlan([college()]);
    const after = makePlan([{ ...college(), endTime: "2:00 PM" }]);
    const obs = diffPlans(before, after);
    expect(obs).toHaveLength(1);
    expect(obs[0].field).toBe("endTime");
    expect(obs[0].plannedValue).toBe("5:00 PM");
    expect(obs[0].actualValue).toBe("2:00 PM");
  });

  it("only flags patterns after enough occurrences", () => {
    let memory = createEmptyPatternMemory();
    for (let i = 0; i < 3; i++) {
      const before = makePlan([college()]);
      const after = makePlan([{ ...college(), endTime: "2:00 PM" }]);
      memory = recordObservations(memory, diffPlans(before, after));
    }
    const notable = getNotablePatterns(memory, 3);
    expect(notable).toHaveLength(1);
    expect(notable[0].title).toBe("College");
    expect(notable[0].actualValue).toBe("2:00 PM");
  });

  it("does not flag a pattern before enough occurrences", () => {
    let memory = createEmptyPatternMemory();
    for (let i = 0; i < 2; i++) {
      const before = makePlan([college()]);
      const after = makePlan([{ ...college(), endTime: "2:00 PM" }]);
      memory = recordObservations(memory, diffPlans(before, after));
    }
    expect(getNotablePatterns(memory, 3)).toHaveLength(0);
  });

  it("builds a conversational learning prompt", () => {
    let memory = createEmptyPatternMemory();
    for (let i = 0; i < 3; i++) {
      const before = makePlan([college()]);
      const after = makePlan([{ ...college(), endTime: "2:00 PM" }]);
      memory = recordObservations(memory, diffPlans(before, after));
    }
    const prompt = buildLearningPrompt(getNotablePatterns(memory, 3)[0]);
    expect(prompt).toContain("college usually ends around 2:00 PM");
  });

  it("confirm and dismiss change status", () => {
    let memory = createEmptyPatternMemory();
    const before = makePlan([college()]);
    const after = makePlan([{ ...college(), endTime: "2:00 PM" }]);
    memory = recordObservations(memory, diffPlans(before, after));
    memory = recordObservations(memory, diffPlans(before, after));
    memory = recordObservations(memory, diffPlans(before, after));

    const id = memory.patterns[0].id;
    memory = confirmPattern(memory, id);
    expect(memory.patterns[0].status).toBe("confirmed");

    memory = dismissPattern(memory, id);
    expect(memory.patterns[0].status).toBe("dismissed");
    expect(getNotablePatterns(memory, 3)).toHaveLength(0);
  });
});

describe("Phase 7 — Identity-Aware Understanding", () => {
  it("shortens a learning session instead of dropping it", () => {
    const plan = makePlan([college(), dsa()]);
    const identity = { priorities: ["Learning", "Health"], values: [] };
    const energyIntent = {
      type: "energy" as const,
      level: "tired" as const,
      confidence: 0.9,
    };
    const result = interpretEnergyThroughIdentity(energyIntent, plan, identity);
    expect(result.respectsIdentity).toBe(true);
    expect(result.intent.type).toBe("modify_commitment");
    expect(result.intent).toMatchObject({
      target: "DSA Practice",
      changes: { durationMinutes: 30 },
    });
    expect(result.explanation).toContain("learning still matters");
  });

  it("recognizes learning as a priority", () => {
    expect(isLearningPriority(["Learning", "Health"])).toBe(true);
    expect(isLearningPriority(["Gym", "Sleep"])).toBe(false);
  });

  it("falls back to lightening the day without identity", () => {
    const plan = makePlan([college(), dsa()]);
    const identity = { priorities: [], values: [] };
    const energyIntent = {
      type: "energy" as const,
      level: "tired" as const,
      confidence: 0.9,
    };
    const result = interpretEnergyThroughIdentity(energyIntent, plan, identity);
    expect(result.respectsIdentity).toBe(false);
    expect(result.intent.type).toBe("energy");
  });
});

describe("Phase 8 — Real Conversation Memory", () => {
  it("accumulates turns across the conversation", () => {
    const plan = makePlan([college(), gym(), dsa()]);
    let memory = createEmptyConversationMemory();
    memory = addTurn(memory, "college till 2", plan);
    memory = addTurn(memory, "gym cancelled", plan);
    memory = addTurn(memory, "make dsa longer", plan);
    expect(memory.turns).toHaveLength(3);
  });

  it("merges duplicate intents", () => {
    const a = {
      type: "cancel_commitment" as const,
      target: "Gym",
      confidence: 0.95,
    };
    const b = {
      type: "cancel_commitment" as const,
      target: "Gym",
      confidence: 0.95,
    };
    const merged = mergeIntents([a, b]);
    expect(merged).toHaveLength(1);
  });

  it("applies accumulated turns as one schedule update", () => {
    const plan = makePlan([college(), gym(), dsa()]);
    let memory = createEmptyConversationMemory();
    memory = addTurn(memory, "college till 2", plan);
    memory = addTurn(memory, "gym cancelled", plan);
    memory = addTurn(memory, "make dsa longer", plan);

    const { result, appliedIntents } = applyAccumulated(memory, plan);
    expect(appliedIntents.length).toBeGreaterThan(0);
    expect(result.plan.commitments.some((c) => c.title === "Gym")).toBe(false);
  });
});

describe("Phase 9 — Explainability", () => {
  it("describes changes and keeps unchanged items", () => {
    const before = makePlan([college(), gym(), dsa()]);
    const after = makePlan([
      { ...college(), endTime: "2:00 PM" },
      { ...gym(), startTime: "2:20 PM", endTime: "3:20 PM" },
      { ...dsa(), startTime: "3:30 PM", endTime: "4:30 PM" },
    ]);
    const explanation = explainChanges(before, after);
    expect(explanation.changed.length).toBeGreaterThan(0);
    expect(explanation.changed.some((c) => c.title === "College")).toBe(true);
    expect(explanation.changed[0].description).toContain("shortened to end at 2:00 PM");
  });

  it("marks removed commitments", () => {
    const before = makePlan([college(), gym()]);
    const after = makePlan([college()]);
    const explanation = explainChanges(before, after);
    expect(explanation.changed.some((c) => c.title === "Gym" && c.description.includes("removed"))).toBe(true);
  });

  it("formats with bullets and unchanged line", () => {
    const before = makePlan([college(), gym()]);
    const after = makePlan([{ ...college(), endTime: "2:00 PM" }, gym()]);
    const formatted = formatChangeExplanation(explainChanges(before, after));
    expect(formatted).toContain("•");
    expect(formatted).toContain("everything else stayed unchanged");
  });
});

describe("Phase 10 — Confidence", () => {
  it("applies immediately at high confidence", () => {
    expect(decideAction(0.97)).toBe("apply");
  });
  it("asks at medium confidence", () => {
    expect(decideAction(0.62)).toBe("ask");
  });
  it("clarifies at low confidence", () => {
    expect(decideAction(0.21)).toBe("clarify");
  });
  it("produces honest messages", () => {
    expect(actionMessage("apply")).toBe("i know what you mean.");
    expect(actionMessage("ask")).toContain("i think");
    expect(actionMessage("clarify")).toContain("let's clarify");
  });
});

describe("Awareness engine — full flow", () => {
  it("learns from an applied change and builds a prompt", () => {
    const awareness = createAwareness(createEmptyPatternMemory(), createEmptyConversationMemory());
    const plan = makePlan([college(), dsa()]);
    const identity = { priorities: [], values: [] };

    for (let i = 0; i < 3; i++) {
      awareness.learn(plan, makePlan([{ ...college(), endTime: "2:00 PM" }, dsa()]));
    }

    const prompts = awareness.getLearningPrompts();
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts[0].message).toContain("college usually ends");
    expect(prompts[0].options.map((o) => o.label)).toEqual(["Remember", "Not Yet"]);
  });

  it("remember resolves the prompt", () => {
    const awareness = createAwareness(createEmptyPatternMemory(), createEmptyConversationMemory());
    const plan = makePlan([college()]);

    for (let i = 0; i < 3; i++) {
      awareness.learn(plan, makePlan([{ ...college(), endTime: "2:00 PM" }]));
    }

    const prompt = awareness.getLearningPrompts()[0];
    awareness.remember(prompt.patternId);
    expect(awareness.getLearningPrompts()).toHaveLength(0);
  });

  it("understandWithAwareness produces a report with explanation", () => {
    const awareness = createAwareness(createEmptyPatternMemory(), createEmptyConversationMemory());
    const plan = makePlan([college(), dsa()]);
    const report = understandWithAwareness("college till 2", plan, { priorities: [], values: [] }, awareness);
    expect(report.action).toBe("apply");
    expect(report.plan).toBeDefined();
    expect(report.changeSummary).toContain("•");
  });

  it("identity-aware tired handling shortens DSA via the awareness path", () => {
    const awareness = createAwareness(createEmptyPatternMemory(), createEmptyConversationMemory());
    const plan = makePlan([college(), dsa()]);
    const report = understandWithAwareness("i'm tired", plan, { priorities: ["Learning"], values: [] }, awareness);
    expect(report.intent).toMatchObject({ target: "DSA Practice", changes: { durationMinutes: 30 } });
  });

  it("applies the accumulated conversation as one update", () => {
    const awareness = createAwareness(createEmptyPatternMemory(), createEmptyConversationMemory());
    const plan = makePlan([college(), gym(), dsa()]);

    awareness.addTurn("college till 2", plan);
    awareness.addTurn("gym cancelled", plan);
    awareness.addTurn("make dsa longer", plan);

    const report = applyAccumulatedReport(plan, awareness);
    expect(report.plan.commitments.some((c) => c.title === "Gym")).toBe(false);
    expect(report.changeSummary).toContain("•");
  });
});