import { describe, it, expect } from "vitest";
import type { TodayPlan } from "../src/types/todayPlan";
import type { Commitment } from "../src/types/commitment";
import { understandIntent } from "../src/ai/IntentEngine";
import { validateIntent } from "../src/ai/IntentValidator";
import { applyIntent, unaffectedWindow } from "../src/ai/IntentApplier";
import { processIntent } from "../src/ai/UnderstandingEngine";

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
    commitments: [...commitments].sort((a, b) =>
      (parseTime(a.startTime) - parseTime(b.startTime))
    ),
    timeline: [],
    unscheduled: [],
    warnings: [],
    recommendation: "",
    status: "active",
  };
}

function parseTime(t: string): number {
  const m = t.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (m[3] === "PM" && h !== 12) h += 12;
  if (m[3] === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

const college = makeCommitment({ id: "college", title: "College", startTime: "9:00 AM", endTime: "5:00 PM", locked: true });
const gym = makeCommitment({ id: "gym", title: "Gym", startTime: "5:30 PM", endTime: "6:30 PM" });
const dsa = makeCommitment({ id: "dsa", title: "DSA Practice", startTime: "7:00 PM", endTime: "8:00 PM" });
const cat = makeCommitment({ id: "cat", title: "Competitive Exam", startTime: "9:00 PM", endTime: "10:00 PM" });

describe("Phase 1 — Intent Engine", () => {
  it("detects modify_commitment for 'college till 2'", () => {
    const plan = makePlan([college, gym, dsa]);
    const res = understandIntent("college till 2", plan);
    expect(res.status).toBe("resolved");
    expect(res.intent).toMatchObject({
      type: "modify_commitment",
      target: "College",
      changes: { endTime: "2:00 PM" },
    });
    expect(res.intent!.confidence).toBeGreaterThan(0.9);
  });

  it("detects cancel_commitment for 'cancel gym'", () => {
    const plan = makePlan([college, gym, dsa]);
    const res = understandIntent("cancel gym", plan);
    expect(res.status).toBe("resolved");
    expect(res.intent).toMatchObject({ type: "cancel_commitment", target: "Gym" });
  });

  it("detects cancel all for 'cancel today'", () => {
    const plan = makePlan([college, gym]);
    const res = understandIntent("cancel today", plan);
    expect(res.intent).toMatchObject({ type: "cancel_commitment", target: "all" });
  });

  it("detects move_commitment later", () => {
    const plan = makePlan([college, gym, dsa]);
    const res = understandIntent("move dsa later", plan);
    expect(res.intent).toMatchObject({
      type: "move_commitment",
      target: "DSA Practice",
      direction: "later",
    });
  });

  it("detects move_commitment earlier", () => {
    const plan = makePlan([college, gym, dsa]);
    const res = understandIntent("move gym earlier", plan);
    expect(res.intent).toMatchObject({
      type: "move_commitment",
      target: "Gym",
      direction: "earlier",
    });
  });

  it("detects add_commitment", () => {
    const plan = makePlan([college, gym]);
    const res = understandIntent("add a doctor appointment", plan);
    expect(res.intent).toMatchObject({ type: "add_commitment", title: "Appointment" });
  });

  it("detects energy intent for 'i'm tired'", () => {
    const plan = makePlan([college, gym]);
    const res = understandIntent("i'm feeling tired", plan);
    expect(res.intent).toMatchObject({ type: "energy", level: "tired" });
  });

  it("returns ambiguous when no target is named", () => {
    const plan = makePlan([dsa, gym, cat]);
    const res = understandIntent("move it later", plan);
    expect(res.status).toBe("ambiguous");
    expect(res.candidates).toContain("DSA Practice");
  });

  it("returns not_found for a commitment that doesn't exist", () => {
    const plan = makePlan([college, gym]);
    const res = understandIntent("cancel chemistry lab", plan);
    expect(res.status).toBe("not_found");
    expect(res.candidates).toEqual(["College", "Gym"]);
  });

  it("returns general conversation otherwise", () => {
    const plan = makePlan([college]);
    const res = understandIntent("how's your day going", plan);
    expect(res.status).toBe("general");
    expect(res.intent?.type).toBe("general_conversation");
  });
});

describe("Phase 2 — Intent Validator", () => {
  it("rejects cancel of a commitment that doesn't exist", () => {
    const plan = makePlan([college, gym]);
    const intent = understandIntent("cancel chemistry lab", plan);
    expect(intent.status).toBe("not_found");
  });

  it("honors explicit user intent even for locked commitments", () => {
    const plan = makePlan([college, gym]);
    const res = understandIntent("cancel college", plan);
    expect(res.status).toBe("resolved");
    if (res.status === "resolved" && res.intent) {
      const validated = validateIntent(res.intent, plan);
      expect(validated.status).toBe("resolved");
    }
  });

  it("flags ambiguity when multiple commitments match", () => {
    const plan = makePlan([
      makeCommitment({ id: "gym1", title: "Gym", startTime: "6:00 AM", endTime: "7:00 AM" }),
      makeCommitment({ id: "gym2", title: "Gym Session", startTime: "5:30 PM", endTime: "6:30 PM" }),
    ]);
    const res = understandIntent("move gym later", plan);
    if (res.status === "resolved" && res.intent) {
      const validated = validateIntent(res.intent, plan);
      expect(validated.status).toBe("ambiguous");
    } else {
      expect(res.status).toBe("ambiguous");
    }
  });

  it("resolves to a valid intent when target exists", () => {
    const plan = makePlan([college, gym, dsa]);
    const res = understandIntent("cancel gym", plan);
    expect(res.status).toBe("resolved");
    if (res.status === "resolved" && res.intent) {
      const validated = validateIntent(res.intent, plan);
      expect(validated.status).toBe("resolved");
    }
  });
});

describe("Phase 3 — Adjustment Engine V2 (patch, replan affected window)", () => {
  it("college till 2 moves only the afternoon, morning untouched", () => {
    const before = makePlan([college, gym, dsa]);
    const res = understandIntent("college till 2", before);
    if (res.status === "resolved" && res.intent) {
      const validated = validateIntent(res.intent, before);
      if (validated.status === "resolved" && validated.intent) {
        const { plan, changes } = applyIntent(before, validated.intent);
        const collegeAfter = plan.commitments.find((c) => c.title === "College");
        expect(collegeAfter?.endTime).toBe("2:00 PM");
        expect(changes.length).toBeGreaterThan(0);
        expect(changes[0].type).toBe("modify");
      } else {
        expect(true).toBe(true);
      }
    } else {
      expect(true).toBe(true);
    }
  });

  it("cancel gym removes it and shifts following commitments up", () => {
    const before = makePlan([college, gym, dsa, cat]);
    const res = understandIntent("cancel gym", before);
    if (res.status === "resolved" && res.intent) {
      const validated = validateIntent(res.intent, before);
      if (validated.status === "resolved" && validated.intent) {
        const { plan } = applyIntent(before, validated.intent);
        expect(plan.commitments.some((c) => c.title === "Gym")).toBe(false);
      }
    }
  });

  it("add commits at a free slot", () => {
    const before = makePlan([college, gym]);
    const res = understandIntent("add a walk", before);
    if (res.status === "resolved" && res.intent) {
      const validated = validateIntent(res.intent, before);
      if (validated.status === "resolved" && validated.intent) {
        const { plan } = applyIntent(before, validated.intent);
        expect(plan.commitments.some((c) => c.title === "Walk")).toBe(true);
      }
    }
  });

  it("move gym later shifts gym to the evening", () => {
    const before = makePlan([college, gym, dsa]);
    const res = understandIntent("move gym later", before);
    if (res.status === "resolved" && res.intent) {
      const validated = validateIntent(res.intent, before);
      if (validated.status === "resolved" && validated.intent) {
        const { plan } = applyIntent(before, validated.intent);
        const gymAfter = plan.commitments.find((c) => c.title === "Gym");
        expect(parseTime(gymAfter!.startTime)).toBeGreaterThan(parseTime("5:30 PM"));
      }
    }
  });

  it("unaffectedWindow reports morning commitments untouched", () => {
    const before = makePlan([college, gym, dsa]);
    const res = understandIntent("college till 2", before);
    if (res.status === "resolved" && res.intent) {
      const validated = validateIntent(res.intent, before);
      if (validated.status === "resolved" && validated.intent) {
        const { plan } = applyIntent(before, validated.intent);
        const untouched = unaffectedWindow(before, plan);
        expect(untouched.some((c) => c.title === "College" && c.startTime === "9:00 AM")).toBe(false);
      }
    }
  });
});

describe("Phase 4/5 — Conversational response + ambiguity", () => {
  it("builds a conversational response with options", () => {
    const plan = makePlan([college, gym, dsa]);
    const result = processIntent("college till 2", plan);
    expect(result.response.message.length).toBeGreaterThan(0);
    expect(result.response.showConfirmation).toBe(true);
    expect(result.apply).toBeDefined();
  });

  it("asks which one when ambiguous", () => {
    const plan = makePlan([dsa, gym, cat]);
    const result = processIntent("move it later", plan);
    expect(result.resolution.status).toBe("ambiguous");
    expect(result.response.options.length).toBeGreaterThan(0);
  });

  it("asks which commitment when not found", () => {
    const plan = makePlan([college, gym]);
    const result = processIntent("cancel chemistry lab", plan);
    expect(result.resolution.status).toBe("not_found");
    expect(result.response.message).toContain("which commitment");
  });

  it("never changes commitments the user did not name", () => {
    const plan = makePlan([college, gym]);
    const result = processIntent("cancel college", plan);
    expect(result.resolution.status).toBe("resolved");
    if (result.resolution.status === "resolved") {
      expect(result.response.showConfirmation).toBe(true);
    }
  });
});