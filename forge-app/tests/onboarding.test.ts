import { describe, it, expect, beforeEach, vi } from "vitest";
import { StorageEngine } from "../src/storage/StorageEngine";
import type { UserProfile } from "../src/onboarding/OnboardingTypes";
import { getKeywordsForKey } from "../src/brain/PriorityKeywords";
import { prioritizeIntents } from "../src/brain/Prioritizer";
import { getPersonalizedGreeting } from "../src/utils/greeting";
import type { ConversationAnalysis } from "../src/brain/types";

let mockProfile: UserProfile | null = null;
let mockOnboardingComplete = false;
let mockUserNames: string[] = [];

vi.mock("../src/storage/StorageEngine", () => ({
  StorageEngine: {
    loadUserProfile: async () => mockProfile,
    saveUserProfile: async (p: UserProfile) => {
      mockProfile = p;
    },
    isOnboardingComplete: async () => mockOnboardingComplete,
    setOnboardingComplete: async () => {
      mockOnboardingComplete = true;
    },
    clearOnboardingComplete: async () => {
      mockOnboardingComplete = false;
    },
    saveUserName: async (n: string) => {
      mockUserNames.push(n);
    },
    loadUserName: async () => mockUserNames[mockUserNames.length - 1] ?? null,
    savePriorities: async () => {},
    loadPriorities: async () => mockProfile?.priorities ?? [],
  },
}));

describe("Onboarding", () => {
  beforeEach(() => {
    mockProfile = null;
    mockOnboardingComplete = false;
    mockUserNames = [];
  });

  describe("StorageEngine", () => {
    it("returns false when onboarding not complete", async () => {
      const result = await StorageEngine.isOnboardingComplete();
      expect(result).toBe(false);
    });

    it("returns true after onboarding complete", async () => {
      await StorageEngine.setOnboardingComplete();
      const result = await StorageEngine.isOnboardingComplete();
      expect(result).toBe(true);
    });

    it("clears onboarding complete flag", async () => {
      await StorageEngine.setOnboardingComplete();
      await StorageEngine.clearOnboardingComplete();
      const result = await StorageEngine.isOnboardingComplete();
      expect(result).toBe(false);
    });
  });

  describe("User Profile", () => {
    it("saves and loads user profile with priorities", async () => {
      const profile: UserProfile = {
        name: "anirudh",
        preferredName: "anirudh",
        lifeSeason: "student",
        priorities: ["health", "studies"],
        lifeDirectionId: null,
        onboardingCompleted: true,
        personality: "supportive",
      };

      await StorageEngine.saveUserProfile(profile);
      const loaded = await StorageEngine.loadUserProfile();

      expect(loaded).toBeDefined();
      expect(loaded?.name).toBe("anirudh");
      expect(loaded?.priorities).toEqual(["health", "studies"]);
      expect(loaded?.lifeDirectionId).toBeNull();
    });

    it("persists profile on completion", async () => {
      await StorageEngine.saveUserProfile({
        name: "test",
        preferredName: "test",
        lifeSeason: "other",
        priorities: ["work"],
        lifeDirectionId: null,
        onboardingCompleted: true,
        personality: "mentor",
      });

      const profile = await StorageEngine.loadUserProfile();
      expect(profile?.onboardingCompleted).toBe(true);
      expect(profile?.priorities).toEqual(["work"]);
    });
  });

  describe("Priority Normalization", () => {
    it("maps priority key to keywords including itself", () => {
      const keywords = getKeywordsForKey("health");
      expect(keywords[0]).toBe("health");
      expect(keywords).toEqual(expect.arrayContaining(["gym", "run", "sleep"]));
    });

    it("matches a task title against priority keywords", () => {
      const analysis: ConversationAnalysis = {
        fixedEvents: [],
        flexibleTasks: [
          { title: "gym", estimatedMinutes: 60, constraints: [], confidence: 0.7 },
          { title: "review PR", estimatedMinutes: 30, constraints: [], confidence: 0.7 },
        ],
        constraints: [],
        preferences: [],
        emotion: { mood: "calm", confidence: 0.5 },
        rawConversation: "",
      };

      const { flexibleTasks } = prioritizeIntents(analysis, ["health"]);
      expect(flexibleTasks[0].confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("keeps unrelated tasks unboosted", () => {
      const analysis: ConversationAnalysis = {
        fixedEvents: [],
        flexibleTasks: [
          { title: "shop for groceries", estimatedMinutes: 30, constraints: [], confidence: 0.5 },
        ],
        constraints: [],
        preferences: [],
        emotion: { mood: "calm", confidence: 0.5 },
        rawConversation: "",
      };

      const { flexibleTasks } = prioritizeIntents(analysis, ["health"]);
      expect(flexibleTasks[0].confidence).toBe(0.5);
    });
  });

  describe("Greeting", () => {
    it("uses name in greeting", () => {
      const greeting = getPersonalizedGreeting("anirudh");
      expect(greeting).toContain("anirudh");
    });

    it("falls back when no name", () => {
      const greeting = getPersonalizedGreeting("    ");
      expect(greeting.toLowerCase()).toContain("good ");
    });
  });
});