import { describe, it, expect } from "vitest";
import { AIClient, createAIClient, createDefaultAIClient, GeminiProvider, OpenAIProvider } from "../src/ai/AIClient";
import type { AIProvider } from "../src/ai/providers/AIProvider";
import { extractJSON } from "../src/ai/providers/GeminiProvider";
import {
  AIProviderNotConfiguredError,
  AIJSONParseError,
} from "../src/ai/types/AIResponse";
import { buildIntentPrompt, INTENT_SYSTEM_PROMPT } from "../src/ai/prompts/IntentPrompt";
import { buildReflectionPrompt } from "../src/ai/prompts/ReflectionPrompt";
import { buildMentorPrompt } from "../src/ai/prompts/MentorPrompt";
import type { TodayPlan } from "../src/types/todayPlan";
import type { Commitment } from "../src/types/commitment";
import type { ReflectionContext } from "../src/mentor/MentorTypes";

function makePlan(): TodayPlan {
  const college: Commitment = {
    id: "college",
    title: "College",
    startTime: "9:00 AM",
    endTime: "5:00 PM",
    completed: false,
    locked: true,
    priority: "medium",
  };
  const gym: Commitment = {
    id: "gym",
    title: "Gym",
    startTime: "5:30 PM",
    endTime: "6:30 PM",
    completed: false,
    locked: false,
    priority: "medium",
  };
  return {
    greeting: "test",
    summary: [],
    commitments: [college, gym],
    timeline: [],
    unscheduled: [],
    warnings: [],
    recommendation: "",
    status: "active",
  };
}

describe("AIProvider interface", () => {
  it("all providers implement the same shape", () => {
    const providers: AIProvider[] = [new GeminiProvider(), new OpenAIProvider()];
    for (const provider of providers) {
      expect(typeof provider.chat).toBe("function");
      expect(typeof provider.json).toBe("function");
      expect(typeof provider.status).toBe("function");
      expect(typeof provider.isConfigured).toBe("function");
      expect(["gemini", "openai", "claude", "deterministic"]).toContain(provider.name);
    }
  });

  it("reports not configured without an api key", () => {
    const provider = new GeminiProvider();
    expect(provider.isConfigured()).toBe(false);
    expect(provider.status().configured).toBe(false);
    expect(provider.status().model).toBe("gemini-flash-latest");
  });

  it("is configured when an api key is present", () => {
    const provider = new GeminiProvider({ apiKey: "test-key" });
    expect(provider.isConfigured()).toBe(true);
    expect(provider.status().configured).toBe(true);
  });
});

describe("extractJSON", () => {
  it("parses plain JSON", () => {
    const out = extractJSON<{ a: number }>('{"a": 1}', "openai");
    expect(out.a).toBe(1);
  });

  it("strips markdown fences", () => {
    const out = extractJSON<{ a: number }>('```json\n{"a": 2}\n```', "gemini");
    expect(out.a).toBe(2);
  });

  it("finds JSON inside prose", () => {
    const out = extractJSON<{ ok: boolean }>(
      'sure, here you go: {"ok": true} hope that helps',
      "openai"
    );
    expect(out.ok).toBe(true);
  });

  it("throws a parse error for non-json", () => {
    expect(() => extractJSON("not json at all", "gemini")).toThrow(AIJSONParseError);
  });
});

describe("AIClient", () => {
  it("throws NotConfigured when calling an unconfigured provider without fallback", async () => {
    const client = createDefaultAIClient();
    await expect(
      client.chat({ messages: [{ role: "user", content: "hi" }] })
    ).rejects.toThrow(AIProviderNotConfiguredError);
  });

  it("falls back to the deterministic provider when active provider is unconfigured", async () => {
    const fallback: AIProvider = {
      name: "deterministic",
      isConfigured: () => true,
      status: () => ({ name: "deterministic", model: "rules", configured: true }),
      async chat() {
        return { content: "deterministic reply", model: "rules" };
      },
      async json<T>() {
        return { data: {} as T, model: "rules" };
      },
    };

    const client = createDefaultAIClient();
    client.setFallback(fallback);

    const result = await client.chat({ messages: [{ role: "user", content: "hi" }] });
    expect(result.content).toBe("deterministic reply");
  });

  it("does not fall back when the active provider is configured but errors", async () => {
    const flaky: AIProvider = {
      name: "openai",
      isConfigured: () => true,
      status: () => ({ name: "openai", model: "x", configured: true }),
      async chat() {
        throw new Error("network down");
      },
      async json() {
        throw new Error("network down");
      },
    };
    const fallback: AIProvider = {
      name: "deterministic",
      isConfigured: () => true,
      status: () => ({ name: "deterministic", model: "rules", configured: true }),
      async chat() {
        return { content: "fallback", model: "rules" };
      },
      async json<T>() {
        return { data: {} as T, model: "rules" };
      },
    };

    const client = new AIClient(flaky);
    client.setFallback(fallback);
    await expect(client.chat({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      "network down"
    );
  });

  it("createAIClient picks the provider by name", () => {
    const gemini = createAIClient({ provider: "gemini", geminiApiKey: "k" });
    expect(gemini.name).toBe("gemini");
    expect(gemini.isConfigured()).toBe(true);

    const openai = createAIClient({ provider: "openai", openaiApiKey: "k" });
    expect(openai.name).toBe("openai");
  });
});

describe("Prompts", () => {
  it("buildIntentPrompt embeds the current plan", () => {
    const prompt = buildIntentPrompt("college till 2", makePlan());
    expect(prompt).toContain("College (9:00 AM to 5:00 PM)");
    expect(prompt).toContain("college till 2");
    expect(prompt).toContain("modify_commitment");
  });

  it("intent prompt system rules exist", () => {
    expect(INTENT_SYSTEM_PROMPT).toContain("You are NOT a scheduler");
    expect(INTENT_SYSTEM_PROMPT).toContain("Return ONLY valid JSON");
  });

  it("buildReflectionPrompt returns system + user", () => {
    const ctx: ReflectionContext = {
      insights: { generatedAt: "x", windowDays: 7, insights: [] },
    };
    const prompt = buildReflectionPrompt(ctx);
    expect(prompt.system).toContain("Never guilt");
    expect(prompt.user).toContain("Time window: 7 days");
    expect(prompt.user).toContain("observation, hypothesis, experiment, encouragement");
  });

  it("buildMentorPrompt connects to identity", () => {
    const ctx = {
      identity: {
        lifeDirectionTitle: "Consistent engineer",
        values: ["learning"],
        priorities: ["Learning"],
      },
      context: {
        currentSession: null,
        upcomingCommitments: ["Gym"],
        todayProgress: "2 of 5 done",
      },
      memory: {
        insights: { generatedAt: "x", windowDays: 7, insights: [] },
      },
      opportunities: [
        { headline: "Protect morning", question: "Want to try it?", identityLink: "moves you closer" },
      ],
    };
    const prompt = buildMentorPrompt(ctx);
    expect(prompt.system).toContain("Always connect suggestions to identity");
    expect(prompt.user).toContain("Consistent engineer");
    expect(prompt.user).toContain("Protect morning");
  });
});