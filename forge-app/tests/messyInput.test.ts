import { describe, it, expect } from "vitest";
import { extractEntities, extractNegatedEntities } from "../src/brain/pipeline/EntityExtractor";

// ── Real-world messy input test ────────────────────────────────
// Tests how Forge handles typos, broken English, and negations

describe("Real-world Messy Input", () => {
  it('handles: "no college today and jusr and assigs move to the nxt stepnment"', () => {
    const input = "no college today and jusr and assigs move to the nxt stepnment";

    // Negation detection should catch "college"
    const negated = extractNegatedEntities(input);
    expect(negated).toContain("College");

    // Entity extraction should catch "assignments" from "assigs"
    const entities = extractEntities(input);
    const entityNames = entities.map(e => e.normalized);

    // "assigs" might not match exactly, but let's see what the system extracts
    console.log("Input:", input);
    console.log("Negated:", negated);
    console.log("Entities:", entityNames);

    // The key assertion: college should be negated
    expect(negated.length).toBeGreaterThan(0);
  });

  it('handles: "no gym today"', () => {
    const input = "no gym today";
    const negated = extractNegatedEntities(input);
    expect(negated).toContain("Gym");
  });

  it('handles: "skip the gym"', () => {
    const input = "skip the gym";
    const negated = extractNegatedEntities(input);
    expect(negated).toContain("Gym");
  });

  it('handles: "no college but yes to gym"', () => {
    const input = "no college but yes to gym";
    const negated = extractNegatedEntities(input);
    expect(negated).toContain("College");
    // Gym should NOT be negated
    expect(negated).not.toContain("Gym");
  });

  it('handles: "dont need college today"', () => {
    const input = "dont need college today";
    const negated = extractNegatedEntities(input);
    expect(negated).toContain("College");
  });

  it('handles: "no dsa practice today"', () => {
    const input = "no dsa practice today";
    const negated = extractNegatedEntities(input);
    expect(negated).toContain("DSA Practice");
  });

  it('handles: "skip assignment"', () => {
    const input = "skip assignment";
    const negated = extractNegatedEntities(input);
    expect(negated).toContain("Assignment");
  });

  it('handles: "without gym"', () => {
    const input = "without gym";
    const negated = extractNegatedEntities(input);
    expect(negated).toContain("Gym");
  });
});
