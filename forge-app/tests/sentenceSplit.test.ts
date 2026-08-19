import { describe, it, expect } from "vitest";
import { splitSentences } from "../src/brain/pipeline/SentenceSplitter";
import { resolveEntity } from "../src/brain/pipeline/EntityExtractor";
import { preprocessConversation } from "../src/brain/Preprocessor";

describe("sentence splitting with comma lists", () => {
  it("keeps adjacent qualifier entities in one phrase", () => {
    const sentences = splitSentences("cat prep, gym");
    expect(sentences).toContain("cat prep");
    expect(sentences).toContain("gym");
  });

  it("resolves cat prep to a single Competitive Exam entity", () => {
    const { output } = preprocessConversation({
      conversation: "i have college till 12, dsa 3h, cat prep, gym, cat again",
      priorities: [],
      currentTime: new Date("2026-08-16T09:00:00"),
    });
    const titles = output.extractedItems.map((i) => i.name);
    expect(titles.filter((t) => t === "Competitive Exam")).toHaveLength(2);
    expect(titles).not.toContain("Exam Prep");
    expect(titles).toContain("Gym");
  });

  it("splits comma-separated commitments into distinct items", () => {
    const sentences = splitSentences("college, gym, dsa");
    expect(sentences).toEqual(["college", "gym", "dsa"]);
    expect(sentences.map((s) => resolveEntity(s))).toEqual(["College", "Gym", "DSA Practice"]);
  });
});