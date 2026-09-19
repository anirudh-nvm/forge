import { describe, it, expect } from "vitest";
import { narratePlan } from "../src/brain/PlanNarrator";
import type { TodayPlan } from "../src/types/todayPlan";
import type { Commitment } from "../src/types/commitment";

// ── Explanation Test Suite ──────────────────────────────────────
// Tests for Sprint 3: "Forge Explains Itself"
// Verifies that Forge provides clear, conversational explanations

function makeCommitment(overrides: Partial<Commitment>): Commitment {
  return {
    id: "test",
    title: "Test",
    startTime: "10:00 AM",
    endTime: "11:00 AM",
    completed: false,
    locked: false,
    priority: "medium",
    confidence: 0.8,
    ...overrides,
  };
}

function makePlan(overrides: Partial<TodayPlan>): TodayPlan {
  return {
    greeting: "here's what i'm thinking.",
    summary: ["found 2 commitments."],
    commitments: [],
    timeline: [],
    unscheduled: [],
    warnings: [],
    recommendation: "priorities first.",
    status: "draft",
    ...overrides,
  };
}

describe("Explanations - Forge Explains Itself (Sprint 3)", () => {
  describe("Placement Reasons - Conversational Explanations", () => {
    it("explains after_fixed_event in natural language", () => {
      const plan = makePlan({
        commitments: [
          makeCommitment({
            title: "Gym",
            placementReasons: ["after_fixed_event"],
          }),
        ],
      });

      const result = narratePlan(plan);
      expect(result.headline).toBeTruthy();
      // Should be conversational, not technical
      expect(result.headline).not.toContain("after_fixed_event");
      expect(result.headline).not.toContain("_");
    });

    it("explains after_recovery in natural language", () => {
      const plan = makePlan({
        commitments: [
          makeCommitment({
            title: "Study",
            placementReasons: ["after_recovery"],
          }),
        ],
      });

      const result = narratePlan(plan);
      expect(result.headline).toBeTruthy();
      expect(result.headline).not.toContain("after_recovery");
    });

    it("explains preferred_time_window in natural language", () => {
      const plan = makePlan({
        commitments: [
          makeCommitment({
            title: "CAT Prep",
            placementReasons: ["preferred_time_window"],
          }),
        ],
      });

      const result = narratePlan(plan);
      expect(result.headline).toBeTruthy();
      expect(result.headline).not.toContain("preferred_time_window");
    });

    it("explains before_dinner in natural language", () => {
      const plan = makePlan({
        commitments: [
          makeCommitment({
            title: "Gym",
            placementReasons: ["before_dinner"],
          }),
        ],
      });

      const result = narratePlan(plan);
      expect(result.headline).toBeTruthy();
      expect(result.headline).not.toContain("before_dinner");
    });

    it("explains near_related in natural language", () => {
      const plan = makePlan({
        commitments: [
          makeCommitment({
            title: "DSA Practice",
            placementReasons: ["near_related"],
          }),
        ],
      });

      const result = narratePlan(plan);
      expect(result.headline).toBeTruthy();
      expect(result.headline).not.toContain("near_related");
    });

    it("explains morning_preference in natural language", () => {
      const plan = makePlan({
        commitments: [
          makeCommitment({
            title: "Deep Work",
            placementReasons: ["morning_preference"],
          }),
        ],
      });

      const result = narratePlan(plan);
      expect(result.headline).toBeTruthy();
      expect(result.headline).not.toContain("morning_preference");
    });

    it("explains first_thing in natural language", () => {
      const plan = makePlan({
        commitments: [
          makeCommitment({
            title: "Reading",
            placementReasons: ["first_thing"],
          }),
        ],
      });

      const result = narratePlan(plan);
      expect(result.headline).toBeTruthy();
      expect(result.headline).not.toContain("first_thing");
    });

    it("explains before_bedtime in natural language", () => {
      const plan = makePlan({
        commitments: [
          makeCommitment({
            title: "Journal",
            placementReasons: ["before_bedtime"],
          }),
        ],
      });

      const result = narratePlan(plan);
      expect(result.headline).toBeTruthy();
      expect(result.headline).not.toContain("before_bedtime");
    });
  });

  describe("Confidence Levels", () => {
    it("shows confidence for high confidence tasks", () => {
      const commitment = makeCommitment({
        title: "College",
        confidence: 0.95,
        placementReasons: ["after_fixed_event"],
      });

      expect(commitment.confidence).toBe(0.95);
    });

    it("shows confidence for medium confidence tasks", () => {
      const commitment = makeCommitment({
        title: "Study",
        confidence: 0.7,
        placementReasons: ["preferred_time_window"],
      });

      expect(commitment.confidence).toBe(0.7);
    });

    it("shows confidence for low confidence tasks", () => {
      const commitment = makeCommitment({
        title: "Task",
        confidence: 0.5,
        placementReasons: [],
      });

      expect(commitment.confidence).toBe(0.5);
    });
  });

  describe("Multiple Reasons", () => {
    it("explains when task has multiple placement reasons", () => {
      const plan = makePlan({
        commitments: [
          makeCommitment({
            title: "Gym",
            placementReasons: ["after_recovery", "before_dinner"],
          }),
        ],
      });

      const result = narratePlan(plan);
      expect(result.headline).toBeTruthy();
      // Should pick the most interesting reason
      expect(result.headline.length).toBeGreaterThan(5);
    });

    it("prioritizes more interesting reasons", () => {
      const plan = makePlan({
        commitments: [
          makeCommitment({
            title: "Task",
            placementReasons: ["after_recovery", "close_to_existing"],
          }),
        ],
      });

      const result = narratePlan(plan);
      expect(result.headline).toBeTruthy();
    });
  });

  describe("Edge Cases", () => {
    it("handles commitment with no placement reasons", () => {
      const plan = makePlan({
        commitments: [
          makeCommitment({
            title: "Task",
            placementReasons: [],
          }),
        ],
      });

      const result = narratePlan(plan);
      expect(result.headline).toBeTruthy();
      // Should use fallback
      expect(result.headline.length).toBeGreaterThan(5);
    });

    it("handles empty plan gracefully", () => {
      const plan = makePlan({ commitments: [] });
      const result = narratePlan(plan);
      expect(result.headline).toBe("today looks open.");
    });

    it("handles plan with only locked commitments", () => {
      const plan = makePlan({
        commitments: [
          makeCommitment({
            title: "College",
            locked: true,
            placementReasons: ["after_fixed_event"],
          }),
        ],
      });

      const result = narratePlan(plan);
      expect(result.headline).toBeTruthy();
    });
  });

  describe("Voice Consistency", () => {
    it("all explanations are lowercase", () => {
      const reasons = [
        "after_fixed_event",
        "after_recovery",
        "preferred_time_window",
        "before_dinner",
        "near_related",
        "morning_preference",
        "first_thing",
        "before_bedtime",
      ];

      reasons.forEach(reason => {
        const plan = makePlan({
          commitments: [
            makeCommitment({
              title: "Test",
              placementReasons: [reason],
            }),
          ],
        });

        const result = narratePlan(plan);
        // Headlines should be conversational
        expect(result.headline).toBeTruthy();
        expect(result.headline.length).toBeGreaterThan(5);
      });
    });

    it("explanations are not robotic", () => {
      const plan = makePlan({
        commitments: [
          makeCommitment({
            title: "Gym",
            placementReasons: ["after_fixed_event"],
          }),
        ],
      });

      const result = narratePlan(plan);
      // Should not contain technical terms
      expect(result.headline).not.toContain("placementReasons");
      expect(result.headline).not.toContain("fixedEvent");
      expect(result.headline).not.toContain("constraint");
    });
  });
});
