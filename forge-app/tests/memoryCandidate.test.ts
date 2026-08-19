import { describe, it, expect } from "vitest";
import {
  findMemoryCandidates,
  approveCandidate,
  rejectCandidate,
} from "../src/memory/MemoryCandidate";
import type { MemoryCandidateContext } from "../src/memory/MemoryCandidate";
import type { StableMemory } from "../src/memory/MemoryProfile";
import type { Observation } from "../src/observation/ObservationTypes";

function makeStable(overrides: Partial<StableMemory> = {}): StableMemory {
  return {
    lifeSeason: "student",
    priorities: [],
    values: [],
    rhythm: { preferredWakeTime: "7:00 AM", preferredSleepTime: "11:00 PM", studyPreference: "morning" },
    constraints: [],
    lastUpdated: "2026-08-14T00:00:00Z",
    ...overrides,
  };
}

function makeObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    id: "obs-1",
    category: "rhythm",
    text: "User studies better in mornings",
    confidence: 0.8,
    supportingEvents: [],
    firstSeen: "2026-08-01T00:00:00Z",
    lastSeen: "2026-08-13T00:00:00Z",
    status: "new",
    ...overrides,
  };
}

describe("MemoryCandidate", () => {
  describe("findMemoryCandidates", () => {
    it("returns empty when no notable observations", () => {
      const ctx: MemoryCandidateContext = {
        stableMemory: makeStable(),
        observations: [],
      };
      expect(findMemoryCandidates(ctx)).toHaveLength(0);
    });

    it("detects rhythm change candidate", () => {
      const obs = makeObservation({
        category: "rhythm",
        confidence: 0.8,
        text: "User prefers evening study",
      });

      const ctx: MemoryCandidateContext = {
        stableMemory: makeStable(),
        observations: [obs],
      };

      const candidates = findMemoryCandidates(ctx);
      const rhythm = candidates.find((c) => c.field === "rhythm");
      expect(rhythm).toBeDefined();
      expect(rhythm!.reason).toContain("evening");
    });

    it("detects constraint candidate for college hours", () => {
      const obs = makeObservation({
        category: "identity",
        confidence: 0.85,
        text: "College usually ends at 2 PM",
        status: "confirmed",
      });

      const ctx: MemoryCandidateContext = {
        stableMemory: makeStable(),
        observations: [obs],
      };

      const candidates = findMemoryCandidates(ctx);
      const constraint = candidates.find((c) => c.field === "constraints");
      expect(constraint).toBeDefined();
      expect(constraint!.proposedValue).toContain("College");
    });

    it("does not duplicate known constraints", () => {
      const obs = makeObservation({
        category: "identity",
        confidence: 0.85,
        text: "College ends at 2 PM",
        status: "confirmed",
      });

      const ctx: MemoryCandidateContext = {
        stableMemory: makeStable({
          constraints: ["College typically ends at 2 PM"],
        }),
        observations: [obs],
      };

      const candidates = findMemoryCandidates(ctx);
      const constraint = candidates.find((c) => c.field === "constraints");
      expect(constraint).toBeUndefined();
    });

    it("all candidates have status pending", () => {
      const obs = makeObservation({
        category: "rhythm",
        confidence: 0.8,
        text: "Evening study works",
      });

      const ctx: MemoryCandidateContext = {
        stableMemory: makeStable(),
        observations: [obs],
      };

      const candidates = findMemoryCandidates(ctx);
      for (const c of candidates) {
        expect(c.status).toBe("pending");
      }
    });
  });

  describe("approveCandidate", () => {
    it("updates stable memory and marks approved", () => {
      const candidate = {
        id: "mc-1",
        field: "constraints" as const,
        currentValue: "",
        proposedValue: "College ends at 2 PM",
        reason: "obs",
        observationIds: ["obs-1"],
        status: "pending" as const,
        createdAt: "2026-08-14T00:00:00Z",
      };

      const stable = makeStable();
      const result = approveCandidate(candidate, stable);

      expect(result.updated.constraints).toContain("College ends at 2 PM");
      expect(result.candidate.status).toBe("approved");
      expect(result.candidate.resolvedAt).toBeDefined();
    });
  });

  describe("rejectCandidate", () => {
    it("marks rejected with resolvedAt", () => {
      const candidate = {
        id: "mc-1",
        field: "values" as const,
        currentValue: "",
        proposedValue: "discipline",
        reason: "obs",
        observationIds: ["obs-1"],
        status: "pending" as const,
        createdAt: "2026-08-14T00:00:00Z",
      };

      const result = rejectCandidate(candidate);
      expect(result.status).toBe("rejected");
      expect(result.resolvedAt).toBeDefined();
    });
  });
});
