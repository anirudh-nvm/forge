import { describe, it, expect } from "vitest";
import { extractEntities, resolveEntity, entityCount } from "../src/brain/pipeline/EntityExtractor";

describe("Entity Expansion", () => {
  describe("entityCount", () => {
    it("expands beyond 22 distinct entities", () => {
      expect(entityCount()).toBeGreaterThan(50);
    });
  });

  describe("Study category", () => {
    it.each([
      ["cat prep", "CAT Prep"],
      ["prepare for jee", "Competitive Exam"],
      ["gre study", "Competitive Exam"],
      ["upsc revision", "Competitive Exam"],
      ["gate exam", "Competitive Exam"],
    ])("maps '%s' to %s", (text, expected) => {
      expect(resolveEntity(text)).toBe(expected);
    });

    it.each([
      ["mock test practice", "Mock Test"],
      ["answer writing", "Answer Writing"],
      ["solve pyqs", "PYQs"],
      ["research for thesis", "Research"],
      ["current affairs", "Current Affairs"],
      ["revise chapter 3", "Revision"],
    ])("maps '%s' to %s", (text, expected) => {
      expect(resolveEntity(text)).toBe(expected);
    });

    it("maps interview and lecture", () => {
      expect(resolveEntity("interview prep")).toBe("Interview");
      expect(resolveEntity("attend lecture")).toBe("College");
      expect(resolveEntity("do assignments")).toBe("Assignment");
    });
  });

  describe("Health category", () => {
    it.each([
      ["morning walk", "Walk"],
      ["jog in the park", "Run"],
      ["yoga session", "Yoga"],
      ["stretching", "Stretch"],
      ["meditation", "Meditation"],
      ["physio appointment", "Physio"],
      ["swimming", "Swim"],
      ["play tennis", "Sport"],
    ])("maps '%s' to %s", (text, expected) => {
      expect(resolveEntity(text)).toBe(expected);
    });
  });

  describe("Work category", () => {
    it.each([
      ["reply to emails", "Email"],
      ["daily standup", "Standup"],
      ["code review", "Coding"],
      ["ui design", "Design"],
      ["prepare presentation", "Presentation"],
      ["deep work block", "Deep Work"],
      ["paperwork", "Admin"],
      ["side project", "Project"],
      ["client work", "Client Work"],
    ])("maps '%s' to %s", (text, expected) => {
      expect(resolveEntity(text)).toBe(expected);
    });
  });

  describe("Home category", () => {
    it.each([
      ["laundry", "Laundry"],
      ["meal prep", "Cooking"],
      ["buy groceries", "Groceries"],
      ["clean the kitchen", "Cleaning"],
      ["pay bills", "Bills"],
      ["home repair", "Home Repair"],
    ])("maps '%s' to %s", (text, expected) => {
      expect(resolveEntity(text)).toBe(expected);
    });
  });

  describe("Personal category", () => {
    it.each([
      ["journal before sleeping", "Journal"],
      ["read for an hour", "Reading"],
      ["call parents", "Call Parents"],
      ["hang out with friends", "Friends"],
      ["family call", "Family"],
      ["grab coffee", "Coffee"],
    ])("maps '%s' to %s", (text, expected) => {
      expect(resolveEntity(text)).toBe(expected);
    });

    it("maps movie and gaming", () => {
      expect(resolveEntity("watch movie")).toBe("Movie");
      expect(resolveEntity("gaming")).toBe("Gaming");
    });
  });

  describe("existing behavior preserved", () => {
    it("keeps original entities stable", () => {
      expect(resolveEntity("college at 9")).toBe("College");
      expect(resolveEntity("gym after work")).toBe("Gym");
      expect(resolveEntity("meeting")).toBe("Meeting");
      expect(resolveEntity("study")).toBe("Study");
      expect(resolveEntity("call")).toBe("Call");
    });

    it("handles plural forms", () => {
      expect(resolveEntity("send emails")).toBe("Email");
      expect(resolveEntity("attend meetings")).toBe("Meeting");
      expect(resolveEntity("pay bills")).toBe("Bills");
    });

    it("handles capitalization", () => {
      expect(resolveEntity("UPSC preparation")).toBe("Competitive Exam");
      expect(resolveEntity("Gym")).toBe("Gym");
    });

    it("prioritizes the first entity in text", () => {
      expect(resolveEntity("do pyqs and mock tests")).toBe("PYQs");
    });

    it("returns null when no entity is present", () => {
      expect(resolveEntity("wake up early")).toBeNull();
    });
  });
});