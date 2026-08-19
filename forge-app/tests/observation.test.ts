import { describe, it, expect } from "vitest";
import {
  generateObservations,
  updateObservationStatus,
  markObservationDiscussed,
  filterObservationsByCategory,
  getHighestConfidenceObservation,
} from "../src/observation/ObservationEngine";
import type {
  ObservationEngineInput,
  AnyPattern,
  CompletionRatePattern,
  TimePreferencePattern,
  AdjustmentFrequencyPattern,
  TrustTrendPattern,
  CommitmentConsistencyPattern,
  TimelineEvent,
  TrustSnapshot,
} from "../src/observation/ObservationTypes";

// ─── Helpers ──────────────────────────────────────────────

function makeInput(overrides: Partial<ObservationEngineInput> = {}): ObservationEngineInput {
  return {
    patterns: [],
    timelineEvents: [],
    trustHistory: [],
    ...overrides,
  };
}

function completionPattern(overrides: Partial<CompletionRatePattern> = {}): CompletionRatePattern {
  return {
    id: "cp1",
    type: "completion_rate",
    commitment: "DSA",
    completed: 0,
    total: 0,
    rate: 0,
    confidence: 0.5,
    ...overrides,
  };
}

function timePreferencePattern(overrides: Partial<TimePreferencePattern> = {}): TimePreferencePattern {
  return {
    id: "tp1",
    type: "time_preference",
    preferred: "morning",
    counts: { morning: 0, afternoon: 0, evening: 0 },
    confidence: 0.5,
    ...overrides,
  };
}

function adjustmentPattern(overrides: Partial<AdjustmentFrequencyPattern> = {}): AdjustmentFrequencyPattern {
  return {
    id: "af1",
    type: "adjustment_frequency",
    adjustments: 0,
    totalSessions: 0,
    ratio: 0,
    confidence: 0.5,
    ...overrides,
  };
}

function trustTrendPattern(overrides: Partial<TrustTrendPattern> = {}): TrustTrendPattern {
  return {
    id: "tt1",
    type: "trust_trend",
    direction: "stable",
    startScore: 50,
    endScore: 50,
    confidence: 0.5,
    ...overrides,
  };
}

function consistencyPattern(overrides: Partial<CommitmentConsistencyPattern> = {}): CommitmentConsistencyPattern {
  return {
    id: "cc1",
    type: "commitment_consistency",
    commitments: [],
    confidence: 0.5,
    ...overrides,
  };
}

function event(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: "ev1",
    timestamp: "2026-08-10T09:00:00Z",
    type: "completed",
    title: "DSA",
    ...overrides,
  };
}

function trustSnapshot(overrides: Partial<TrustSnapshot> = {}): TrustSnapshot {
  return { date: "2026-08-10", score: 50, ...overrides };
}

// ─── Tests ────────────────────────────────────────────────

describe("ObservationEngine", () => {
  // ── Empty / null ──

  it("returns empty observations for empty input", () => {
    const output = generateObservations(makeInput());
    expect(output.observations).toHaveLength(0);
    expect(output.groups).toHaveLength(0);
    expect(output.triggeredForReflection).toHaveLength(0);
  });

  it("returns empty observations when patterns have no actionable data", () => {
    const output = generateObservations(
      makeInput({
        patterns: [
          completionPattern({ commitment: "DSA", completed: 1, total: 2, rate: 0.5 }),
        ],
      })
    );
    expect(output.observations).toHaveLength(0);
  });

  // ── Consistency (completion_rate) ──

  it("observes low completion rate (≤40%, ≥3 sessions)", () => {
    const output = generateObservations(
      makeInput({
        patterns: [completionPattern({ commitment: "DSA", completed: 1, total: 5, rate: 0.2 })],
        timelineEvents: [
          event({ id: "e1", type: "completed", title: "DSA", timestamp: "2026-08-10T09:00:00Z" }),
          event({ id: "e2", type: "skipped", title: "DSA", timestamp: "2026-08-11T09:00:00Z" }),
          event({ id: "e3", type: "skipped", title: "DSA", timestamp: "2026-08-12T09:00:00Z" }),
          event({ id: "e4", type: "skipped", title: "DSA", timestamp: "2026-08-13T09:00:00Z" }),
          event({ id: "e5", type: "skipped", title: "DSA", timestamp: "2026-08-14T09:00:00Z" }),
        ],
      })
    );
    expect(output.observations.length).toBeGreaterThanOrEqual(1);
    const obs = output.observations[0];
    expect(obs.category).toBe("consistency");
    expect(obs.text).toContain("skipped");
    expect(obs.confidence).toBeGreaterThan(0);
  });

  it("observes high completion rate (≥80%, ≥5 sessions)", () => {
    const output = generateObservations(
      makeInput({
        patterns: [completionPattern({ commitment: "DSA", completed: 9, total: 10, rate: 0.9 })],
        timelineEvents: Array.from({ length: 10 }, (_, i) =>
          event({
            id: `e${i}`,
            type: i < 9 ? "completed" : "skipped",
            title: "DSA",
            timestamp: `2026-08-${10 + i}T09:00:00Z`,
          })
        ),
      })
    );
    const consistencyObs = output.observations.filter((o) => o.category === "consistency");
    expect(consistencyObs.length).toBeGreaterThanOrEqual(1);
    expect(consistencyObs[0].text).toContain("completed");
  });

  it("observes stable completion rate (60-79%, ≥4 sessions)", () => {
    const output = generateObservations(
      makeInput({
        patterns: [completionPattern({ commitment: "DSA", completed: 3, total: 5, rate: 0.6 })],
        timelineEvents: [
          event({ id: "e1", type: "completed", title: "DSA", timestamp: "2026-08-10T09:00:00Z" }),
          event({ id: "e2", type: "completed", title: "DSA", timestamp: "2026-08-11T09:00:00Z" }),
          event({ id: "e3", type: "completed", title: "DSA", timestamp: "2026-08-12T09:00:00Z" }),
          event({ id: "e4", type: "skipped", title: "DSA", timestamp: "2026-08-13T09:00:00Z" }),
          event({ id: "e5", type: "skipped", title: "DSA", timestamp: "2026-08-14T09:00:00Z" }),
        ],
      })
    );
    const consistencyObs = output.observations.filter((o) => o.category === "consistency");
    expect(consistencyObs.length).toBeGreaterThanOrEqual(1);
    expect(consistencyObs[0].text).toContain("60%");
  });

  // ── Commitment consistency (multiple low) ──

  it("observes multiple struggling commitments", () => {
    const output = generateObservations(
      makeInput({
        patterns: [
          consistencyPattern({
            commitments: [
              { title: "DSA", rate: 0.2, total: 5 },
              { title: "CAT", rate: 0.3, total: 5 },
            ],
            confidence: 0.5,
          }),
        ],
      })
    );
    const obs = output.observations.filter((o) => o.category === "consistency");
    expect(obs.length).toBeGreaterThanOrEqual(1);
    expect(obs[0].text).toContain("DSA");
    expect(obs[0].text).toContain("CAT");
  });

  // ── Timing ──

  it("observes time preference when total ≥5", () => {
    const output = generateObservations(
      makeInput({
        patterns: [
          timePreferencePattern({
            preferred: "morning",
            counts: { morning: 8, afternoon: 1, evening: 1 },
          }),
        ],
        timelineEvents: Array.from({ length: 10 }, (_, i) =>
          event({
            id: `e${i}`,
            type: "completed",
            title: `Task ${i}`,
            timestamp: `2026-08-${10 + i}T09:00:00Z`,
          })
        ),
      })
    );
    const timingObs = output.observations.filter((o) => o.category === "timing");
    expect(timingObs.length).toBeGreaterThanOrEqual(1);
    expect(timingObs[0].text).toContain("morning");
  });

  it("does not observe time preference when total <5", () => {
    const output = generateObservations(
      makeInput({
        patterns: [
          timePreferencePattern({
            preferred: "morning",
            counts: { morning: 2, afternoon: 1, evening: 0 },
          }),
        ],
      })
    );
    const timingObs = output.observations.filter((o) => o.category === "timing");
    expect(timingObs).toHaveLength(0);
  });

  it("observes high adjustment frequency (ratio >0.3, ≥5 sessions)", () => {
    const output = generateObservations(
      makeInput({
        patterns: [adjustmentPattern({ adjustments: 4, totalSessions: 10, ratio: 0.4 })],
        timelineEvents: Array.from({ length: 4 }, (_, i) =>
          event({ id: `e${i}`, type: "movedLater", title: "DSA", timestamp: `2026-08-${10 + i}T09:00:00Z` })
        ),
      })
    );
    const timingObs = output.observations.filter((o) => o.category === "timing");
    expect(timingObs.length).toBeGreaterThanOrEqual(1);
    expect(timingObs[0].text).toContain("adjusted");
  });

  // ── Energy (trust trend) ──

  it("observes trust decline (≥10 point drop)", () => {
    const output = generateObservations(
      makeInput({
        patterns: [trustTrendPattern({ direction: "down", startScore: 70, endScore: 55 })],
        trustHistory: [
          trustSnapshot({ date: "2026-08-08", score: 70 }),
          trustSnapshot({ date: "2026-08-09", score: 65 }),
          trustSnapshot({ date: "2026-08-10", score: 55 }),
        ],
      })
    );
    const energyObs = output.observations.filter((o) => o.category === "energy");
    expect(energyObs.length).toBeGreaterThanOrEqual(1);
    expect(energyObs[0].text).toContain("declined");
    expect(energyObs[0].text).toContain("70");
    expect(energyObs[0].text).toContain("55");
  });

  it("observes trust improvement (≥10 point gain)", () => {
    const output = generateObservations(
      makeInput({
        patterns: [trustTrendPattern({ direction: "up", startScore: 40, endScore: 55 })],
        trustHistory: [
          trustSnapshot({ date: "2026-08-08", score: 40 }),
          trustSnapshot({ date: "2026-08-09", score: 48 }),
          trustSnapshot({ date: "2026-08-10", score: 55 }),
        ],
      })
    );
    const energyObs = output.observations.filter((o) => o.category === "energy");
    expect(energyObs.length).toBeGreaterThanOrEqual(1);
    expect(energyObs[0].text).toContain("improved");
  });

  it("observes repeated skips for single commitment (≥3 in last week)", () => {
    const output = generateObservations(
      makeInput({
        timelineEvents: [
          event({ id: "e1", type: "skipped", title: "DSA", timestamp: "2026-08-08T09:00:00Z" }),
          event({ id: "e2", type: "skipped", title: "DSA", timestamp: "2026-08-09T09:00:00Z" }),
          event({ id: "e3", type: "skipped", title: "DSA", timestamp: "2026-08-10T09:00:00Z" }),
        ],
      })
    );
    const energyObs = output.observations.filter((o) => o.category === "energy");
    expect(energyObs.length).toBeGreaterThanOrEqual(1);
    expect(energyObs[0].text).toContain("skipped 3 times");
  });

  // ── Capacity ──

  it("observes capacity drop when daily completions decline (≥7 days)", () => {
    const events: TimelineEvent[] = [];
    // Days 1-7: ~4 completions/day
    for (let d = 1; d <= 7; d++) {
      for (let j = 0; j < 4; j++) {
        events.push(event({ id: `e${d}_${j}`, type: "completed", title: `T${j}`, timestamp: `2026-07-${String(d).padStart(2, "0")}T09:00:00Z` }));
      }
    }
    // Days 8-14: ~1 completion/day
    for (let d = 8; d <= 14; d++) {
      events.push(event({ id: `e${d}`, type: "completed", title: "T0", timestamp: `2026-07-${String(d).padStart(2, "0")}T09:00:00Z` }));
    }

    const output = generateObservations(makeInput({ timelineEvents: events }));
    const capacityObs = output.observations.filter((o) => o.category === "capacity");
    expect(capacityObs.length).toBeGreaterThanOrEqual(1);
    expect(capacityObs[0].text).toContain("dropped");
  });

  // ── Rhythm ──

  it("observes current streak (≥7 days)", () => {
    const events: TimelineEvent[] = [];
    for (let d = 1; d <= 8; d++) {
      events.push(event({ id: `e${d}`, type: "completed", title: "DSA", timestamp: `2026-08-${String(d).padStart(2, "0")}T09:00:00Z` }));
    }

    const output = generateObservations(makeInput({ timelineEvents: events }));
    const rhythmObs = output.observations.filter((o) => o.category === "rhythm");
    expect(rhythmObs.length).toBeGreaterThanOrEqual(1);
    expect(rhythmObs[0].text).toContain("streak");
    expect(rhythmObs[0].text).toContain("8-day");
  });

  it("observes broken streak (≥14 day max, currently 0)", () => {
    const events: TimelineEvent[] = [];
    // 14-day streak, then a skip
    for (let d = 1; d <= 14; d++) {
      events.push(event({ id: `e${d}`, type: "completed", title: "DSA", timestamp: `2026-07-${String(d).padStart(2, "0")}T09:00:00Z` }));
    }
    events.push(event({ id: "e15", type: "skipped", title: "DSA", timestamp: "2026-07-15T09:00:00Z" }));

    const output = generateObservations(makeInput({ timelineEvents: events }));
    const rhythmObs = output.observations.filter((o) => o.category === "rhythm");
    expect(rhythmObs.length).toBeGreaterThanOrEqual(1);
    expect(rhythmObs[0].text).toContain("streak that recently ended");
  });

  // ── Identity ──

  it("observes goal misalignment when goal-related tasks skipped often", () => {
    const output = generateObservations(
      makeInput({
        identityContext: { activeGoals: ["CAT"] },
        timelineEvents: [
          event({ id: "e1", type: "completed", title: "CAT Practice", timestamp: "2026-08-10T09:00:00Z" }),
          event({ id: "e2", type: "skipped", title: "CAT Practice", timestamp: "2026-08-11T09:00:00Z" }),
          event({ id: "e3", type: "skipped", title: "CAT Practice", timestamp: "2026-08-12T09:00:00Z" }),
          event({ id: "e4", type: "skipped", title: "CAT Practice", timestamp: "2026-08-13T09:00:00Z" }),
          event({ id: "e5", type: "skipped", title: "CAT Practice", timestamp: "2026-08-14T09:00:00Z" }),
        ],
      })
    );
    const identityObs = output.observations.filter((o) => o.category === "identity");
    expect(identityObs.length).toBeGreaterThanOrEqual(1);
    expect(identityObs[0].text).toContain("skipped");
  });

  it("observes strong goal alignment when goal-related tasks completed", () => {
    const output = generateObservations(
      makeInput({
        identityContext: { activeGoals: ["DSA"] },
        timelineEvents: Array.from({ length: 8 }, (_, i) =>
          event({ id: `e${i}`, type: "completed", title: "DSA Practice", timestamp: `2026-08-${10 + i}T09:00:00Z` })
        ),
      })
    );
    const identityObs = output.observations.filter((o) => o.category === "identity");
    expect(identityObs.length).toBeGreaterThanOrEqual(1);
    expect(identityObs[0].text).toContain("aligned");
  });

  // ── Confidence ──

  it("scales confidence with sample size", () => {
    const small = generateObservations(
      makeInput({
        patterns: [completionPattern({ commitment: "DSA", completed: 1, total: 3, rate: 0.33 })],
        timelineEvents: [
          event({ id: "e1", type: "completed", title: "DSA", timestamp: "2026-08-10T09:00:00Z" }),
          event({ id: "e2", type: "skipped", title: "DSA", timestamp: "2026-08-11T09:00:00Z" }),
          event({ id: "e3", type: "skipped", title: "DSA", timestamp: "2026-08-12T09:00:00Z" }),
        ],
      })
    );
    const large = generateObservations(
      makeInput({
        patterns: [completionPattern({ commitment: "DSA", completed: 4, total: 20, rate: 0.2 })],
        timelineEvents: Array.from({ length: 20 }, (_, i) =>
          event({ id: `e${i}`, type: i < 4 ? "completed" : "skipped", title: "DSA", timestamp: `2026-07-${10 + (i % 20)}T09:00:00Z` })
        ),
      })
    );
    if (small.observations.length > 0 && large.observations.length > 0) {
      expect(large.observations[0].confidence).toBeGreaterThan(small.observations[0].confidence);
    }
  });

  it("confidence never exceeds 0.95", () => {
    const output = generateObservations(
      makeInput({
        patterns: [completionPattern({ commitment: "DSA", completed: 50, total: 50, rate: 1.0 })],
        timelineEvents: Array.from({ length: 50 }, (_, i) =>
          event({ id: `e${i}`, type: "completed", title: "DSA", timestamp: `2026-06-${String((i % 28) + 1).padStart(2, "0")}T09:00:00Z` })
        ),
      })
    );
    for (const obs of output.observations) {
      expect(obs.confidence).toBeLessThanOrEqual(0.95);
    }
  });

  // ── Deterministic ordering ──

  it("returns observations sorted by confidence (highest first)", () => {
    const output = generateObservations(
      makeInput({
        patterns: [
          completionPattern({ commitment: "DSA", completed: 1, total: 5, rate: 0.2 }),
          trustTrendPattern({ direction: "down", startScore: 80, endScore: 60 }),
        ],
        trustHistory: [
          trustSnapshot({ date: "2026-08-08", score: 80 }),
          trustSnapshot({ date: "2026-08-09", score: 70 }),
          trustSnapshot({ date: "2026-08-10", score: 60 }),
        ],
        timelineEvents: Array.from({ length: 5 }, (_, i) =>
          event({ id: `e${i}`, type: i === 0 ? "completed" : "skipped", title: "DSA", timestamp: `2026-08-${10 + i}T09:00:00Z` })
        ),
      })
    );
    for (let i = 1; i < output.observations.length; i++) {
      expect(output.observations[i - 1].confidence).toBeGreaterThanOrEqual(output.observations[i].confidence);
    }
  });

  // ── Groups ──

  it("groups observations by category", () => {
    const output = generateObservations(
      makeInput({
        patterns: [
          completionPattern({ commitment: "DSA", completed: 1, total: 5, rate: 0.2 }),
          trustTrendPattern({ direction: "down", startScore: 80, endScore: 60 }),
        ],
        trustHistory: [
          trustSnapshot({ date: "2026-08-08", score: 80 }),
          trustSnapshot({ date: "2026-08-09", score: 70 }),
          trustSnapshot({ date: "2026-08-10", score: 60 }),
        ],
        timelineEvents: Array.from({ length: 5 }, (_, i) =>
          event({ id: `e${i}`, type: i === 0 ? "completed" : "skipped", title: "DSA", timestamp: `2026-08-${10 + i}T09:00:00Z` })
        ),
      })
    );
    expect(output.groups.length).toBeGreaterThanOrEqual(1);
    for (const group of output.groups) {
      expect(group.observations.every((o) => o.category === group.category)).toBe(true);
    }
  });

  // ── Triggered for reflection ──

  it("triggers reflection for observations with confidence > 0.8", () => {
    const output = generateObservations(
      makeInput({
        patterns: [completionPattern({ commitment: "DSA", completed: 1, total: 5, rate: 0.2 })],
        timelineEvents: Array.from({ length: 5 }, (_, i) =>
          event({ id: `e${i}`, type: i === 0 ? "completed" : "skipped", title: "DSA", timestamp: `2026-08-${10 + i}T09:00:00Z` })
        ),
      })
    );
    const triggered = output.triggeredForReflection;
    for (const obs of triggered) {
      expect(obs.confidence).toBeGreaterThan(0.8);
      expect(obs.status).toBe("new");
    }
  });

  it("does not trigger reflection for low-confidence observations", () => {
    const output = generateObservations(
      makeInput({
        patterns: [completionPattern({ commitment: "DSA", completed: 2, total: 3, rate: 0.67 })],
        timelineEvents: [
          event({ id: "e1", type: "completed", title: "DSA", timestamp: "2026-08-10T09:00:00Z" }),
          event({ id: "e2", type: "completed", title: "DSA", timestamp: "2026-08-11T09:00:00Z" }),
          event({ id: "e3", type: "skipped", title: "DSA", timestamp: "2026-08-12T09:00:00Z" }),
        ],
      })
    );
    for (const obs of output.triggeredForReflection) {
      expect(obs.confidence).toBeGreaterThan(0.8);
    }
  });

  // ── Supporting events ──

  it("attaches supporting events to observations", () => {
    const output = generateObservations(
      makeInput({
        patterns: [completionPattern({ commitment: "DSA", completed: 1, total: 5, rate: 0.2 })],
        timelineEvents: [
          event({ id: "e1", type: "completed", title: "DSA", timestamp: "2026-08-10T09:00:00Z" }),
          event({ id: "e2", type: "skipped", title: "DSA", timestamp: "2026-08-11T09:00:00Z" }),
          event({ id: "e3", type: "skipped", title: "DSA", timestamp: "2026-08-12T09:00:00Z" }),
          event({ id: "e4", type: "skipped", title: "DSA", timestamp: "2026-08-13T09:00:00Z" }),
          event({ id: "e5", type: "skipped", title: "DSA", timestamp: "2026-08-14T09:00:00Z" }),
        ],
      })
    );
    const obs = output.observations.find((o) => o.category === "consistency");
    expect(obs).toBeDefined();
    expect(obs!.supportingEvents.length).toBeGreaterThan(0);
  });

  // ── Status management ──

  it("updateObservationStatus sets status to dismissed with discussedAt", () => {
    const output = generateObservations(
      makeInput({
        patterns: [completionPattern({ commitment: "DSA", completed: 1, total: 5, rate: 0.2 })],
        timelineEvents: Array.from({ length: 5 }, (_, i) =>
          event({ id: `e${i}`, type: i === 0 ? "completed" : "skipped", title: "DSA", timestamp: `2026-08-${10 + i}T09:00:00Z` })
        ),
      })
    );
    const obs = output.observations[0];
    const updated = updateObservationStatus(output.observations, obs.id, "dismissed");
    const found = updated.find((o) => o.id === obs.id)!;
    expect(found.status).toBe("dismissed");
    expect(found.discussedAt).toBeDefined();
  });

  it("updateObservationStatus sets status to resolved with resolvedAt", () => {
    const output = generateObservations(
      makeInput({
        patterns: [completionPattern({ commitment: "DSA", completed: 1, total: 5, rate: 0.2 })],
        timelineEvents: Array.from({ length: 5 }, (_, i) =>
          event({ id: `e${i}`, type: i === 0 ? "completed" : "skipped", title: "DSA", timestamp: `2026-08-${10 + i}T09:00:00Z` })
        ),
      })
    );
    const obs = output.observations[0];
    const updated = updateObservationStatus(output.observations, obs.id, "resolved");
    const found = updated.find((o) => o.id === obs.id)!;
    expect(found.status).toBe("resolved");
    expect(found.resolvedAt).toBeDefined();
  });

  it("markObservationDiscussed sets status to confirmed with discussedAt", () => {
    const output = generateObservations(
      makeInput({
        patterns: [completionPattern({ commitment: "DSA", completed: 1, total: 5, rate: 0.2 })],
        timelineEvents: Array.from({ length: 5 }, (_, i) =>
          event({ id: `e${i}`, type: i === 0 ? "completed" : "skipped", title: "DSA", timestamp: `2026-08-${10 + i}T09:00:00Z` })
        ),
      })
    );
    const obs = output.observations[0];
    const updated = markObservationDiscussed(output.observations, obs.id);
    const found = updated.find((o) => o.id === obs.id)!;
    expect(found.status).toBe("confirmed");
    expect(found.discussedAt).toBeDefined();
  });

  // ── Filter by category ──

  it("filterObservationsByCategory returns only matching category", () => {
    const output = generateObservations(
      makeInput({
        patterns: [
          completionPattern({ commitment: "DSA", completed: 1, total: 5, rate: 0.2 }),
          trustTrendPattern({ direction: "down", startScore: 80, endScore: 60 }),
        ],
        trustHistory: [
          trustSnapshot({ date: "2026-08-08", score: 80 }),
          trustSnapshot({ date: "2026-08-09", score: 70 }),
          trustSnapshot({ date: "2026-08-10", score: 60 }),
        ],
        timelineEvents: Array.from({ length: 5 }, (_, i) =>
          event({ id: `e${i}`, type: i === 0 ? "completed" : "skipped", title: "DSA", timestamp: `2026-08-${10 + i}T09:00:00Z` })
        ),
      })
    );
    const consistencyOnly = filterObservationsByCategory(output.observations, "consistency");
    for (const obs of consistencyOnly) {
      expect(obs.category).toBe("consistency");
    }
  });

  // ── Highest confidence ──

  it("getHighestConfidenceObservation returns the observation with highest confidence", () => {
    const output = generateObservations(
      makeInput({
        patterns: [
          completionPattern({ commitment: "DSA", completed: 1, total: 5, rate: 0.2 }),
          trustTrendPattern({ direction: "down", startScore: 80, endScore: 60 }),
        ],
        trustHistory: [
          trustSnapshot({ date: "2026-08-08", score: 80 }),
          trustSnapshot({ date: "2026-08-09", score: 70 }),
          trustSnapshot({ date: "2026-08-10", score: 60 }),
        ],
        timelineEvents: Array.from({ length: 5 }, (_, i) =>
          event({ id: `e${i}`, type: i === 0 ? "completed" : "skipped", title: "DSA", timestamp: `2026-08-${10 + i}T09:00:00Z` })
        ),
      })
    );
    const highest = getHighestConfidenceObservation(output.observations);
    expect(highest).toBeDefined();
    for (const obs of output.observations) {
      expect(obs.confidence).toBeLessThanOrEqual(highest!.confidence);
    }
  });

  it("getHighestConfidenceObservation returns undefined for empty observations", () => {
    expect(getHighestConfidenceObservation([])).toBeUndefined();
  });

  // ── Metadata ──

  it("includes metadata with commitment title, pattern type, and sample size", () => {
    const output = generateObservations(
      makeInput({
        patterns: [completionPattern({ commitment: "DSA", completed: 1, total: 5, rate: 0.2 })],
        timelineEvents: Array.from({ length: 5 }, (_, i) =>
          event({ id: `e${i}`, type: i === 0 ? "completed" : "skipped", title: "DSA", timestamp: `2026-08-${10 + i}T09:00:00Z` })
        ),
      })
    );
    const obs = output.observations.find((o) => o.category === "consistency");
    expect(obs).toBeDefined();
    expect(obs!.metadata?.commitmentTitle).toBe("DSA");
    expect(obs!.metadata?.patternType).toBe("completion_rate");
    expect(obs!.metadata?.sampleSize).toBe(5);
  });
});
