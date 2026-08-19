import { describe, it, expect } from "vitest";
import { AIClient } from "../src/ai/AIClient";
import { JSON_MODE_INSTRUCTION, withJSONInstruction, asJSONMessages, toJSONChatParams } from "../src/ai/JSONMode";
import { jsonWithRetry, type JSONCapable } from "../src/ai/RetryEngine";
import { getAIConfig, isAIConfigured } from "../src/ai/config/env";
import { createForgeAI } from "../src/ai/services";
import { createIntentService } from "../src/ai/services/IntentService";
import { AIJSONParseError } from "../src/ai/types/AIResponse";
import type { AIProvider } from "../src/ai/providers/AIProvider";
import type { Intent } from "../src/ai/IntentTypes";
import type { TodayPlan } from "../src/types/todayPlan";
import type { Commitment } from "../src/types/commitment";

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
  return {
    greeting: "test",
    summary: [],
    commitments: [college],
    timeline: [],
    unscheduled: [],
    warnings: [],
    recommendation: "",
    status: "active",
  };
}

describe("JSONMode", () => {
  it("exports the strict JSON instruction", () => {
    expect(JSON_MODE_INSTRUCTION).toContain("ONLY valid JSON");
    expect(JSON_MODE_INSTRUCTION).toContain("No markdown");
    expect(JSON_MODE_INSTRUCTION).toContain("no explanation");
  });

  it("withJSONInstruction appends to a system prompt", () => {
    const out = withJSONInstruction("You are the intent engine.");
    expect(out).toContain("You are the intent engine.");
    expect(out).toContain(JSON_MODE_INSTRUCTION);
  });

  it("asJSONMessages builds system + user messages", () => {
    const msgs = asJSONMessages("sys", "user text");
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatchObject({ role: "system", content: expect.stringContaining("ONLY valid JSON") });
    expect(msgs[1]).toMatchObject({ role: "user", content: "user text" });
  });

  it("toJSONChatParams sets low temperature for machines", () => {
    const params = toJSONChatParams("sys", "user");
    expect(params.temperature).toBe(0.2);
    expect(params.maxTokens).toBe(2048);
    expect(params.messages[0].content).toContain(JSON_MODE_INSTRUCTION);
  });
});

describe("RetryEngine", () => {
  it("succeeds on the first attempt", async () => {
    const provider: JSONCapable = {
      async json<T>() {
        return { data: { ok: true } as T, model: "m" };
      },
    };
    const out = await jsonWithRetry<{ ok: boolean }>(provider, {
      messages: [{ role: "user", content: "hi" }],
    });
    expect(out.data.ok).toBe(true);
  });

  it("retries and succeeds when the first response is bad json", async () => {
    let calls = 0;
    const provider: JSONCapable = {
      async json<T>() {
        calls++;
        if (calls === 1) throw new AIJSONParseError("gemini", "sure! here: not-json");
        return { data: { ok: true } as T, model: "m" };
      },
    };

    const out = await jsonWithRetry<{ ok: boolean }>(provider, {
      messages: [{ role: "user", content: "hi" }],
    });
    expect(calls).toBe(2);
    expect(out.data.ok).toBe(true);
  });

  it("adds corrective feedback to the follow-up request", async () => {
    let calls = 0;
    const provider: JSONCapable = {
      async json<T>(params: { messages: { role: "system" | "user" | "assistant"; content: string }[]; temperature?: number; maxTokens?: number }) {
        calls++;
        if (calls === 1) throw new AIJSONParseError("gemini", "nope");
        expect(params.messages.length).toBe(3);
        expect(params.messages[2].content).toContain("ONLY valid JSON");
        return { data: { ok: true } as T, model: "m" };
      },
    };

    await jsonWithRetry<{ ok: boolean }>(provider, {
      messages: [{ role: "user", content: "hi" }],
    });
    expect(calls).toBe(2);
  });

  it("gives up and rethrows after maxAttempts", async () => {
    let calls = 0;
    const provider: JSONCapable = {
      async json() {
        calls++;
        throw new AIJSONParseError("gemini", "nope");
      },
    };

    await expect(
      jsonWithRetry(provider, { messages: [{ role: "user", content: "hi" }] }, { maxAttempts: 2 })
    ).rejects.toThrow(AIJSONParseError);
    expect(calls).toBe(2);
  });

  it("does not retry on a non-parse error", async () => {
    let calls = 0;
    const provider: JSONCapable = {
      async json() {
        calls++;
        throw new Error("network down");
      },
    };

    await expect(
      jsonWithRetry(provider, { messages: [{ role: "user", content: "hi" }] })
    ).rejects.toThrow("network down");
    expect(calls).toBe(1);
  });
});

describe("env config", () => {
  it("defaults to gemini with no keys", () => {
    delete process.env.EXPO_PUBLIC_AI_PROVIDER;
    delete process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    const config = getAIConfig();
    expect(config.provider).toBe("gemini");
    expect(config.geminiApiKey).toBeUndefined();
    expect(isAIConfigured()).toBe(false);
  });

  it("reads the provider and keys from env", () => {
    process.env.EXPO_PUBLIC_AI_PROVIDER = "openai";
    process.env.EXPO_PUBLIC_OPENAI_API_KEY = "sk-test";
    const config = getAIConfig();
    expect(config.provider).toBe("openai");
    expect(config.openaiApiKey).toBe("sk-test");
    expect(isAIConfigured()).toBe(true);
    delete process.env.EXPO_PUBLIC_AI_PROVIDER;
    delete process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  });
});

describe("createForgeAI", () => {
  it("builds the full service stack and reports unconfigured without keys", () => {
    delete process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    const ai = createForgeAI();
    expect(ai.client.isConfigured()).toBe(false);
    expect(ai.configured).toBe(false);
    expect(typeof ai.intent.understand).toBe("function");
    expect(typeof ai.reflection.reflect).toBe("function");
    expect(typeof ai.mentor.advise).toBe("function");
  });
});

describe("IntentService", () => {
  it("falls back to deterministic when AI is unconfigured", async () => {
    delete process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    const client = new AIClient();
    const service = createIntentService(client);

    const result = await service.understand("college till 2", makePlan());
    expect(result.source).toBe("deterministic");
    expect(result.resolution.status).toBe("resolved");
    expect(result.intent?.type).toBe("modify_commitment");
    expect(
      result.intent?.type === "modify_commitment" ? result.intent.target.toLowerCase() : ""
    ).toBe("college");
    expect(result.apply?.changes.length).toBeGreaterThan(0);
  });

  it("uses the AI path when the client is configured", async () => {
    const stub: AIProvider = {
      name: "gemini",
      isConfigured: () => true,
      status: () => ({ name: "gemini", model: "m", configured: true }),
      async chat() {
        return { content: "", model: "m" };
      },
      async json<T>(params: { messages: { role: "system" | "user" | "assistant"; content: string }[]; temperature?: number; maxTokens?: number }) {
        const intent = {
          type: "modify_commitment",
          target: "College",
          changes: { endTime: "2:00 PM" },
          confidence: 0.97,
        } as T;
        return { data: intent, model: "m" };
      },
    };
    const client = new AIClient(stub);
    const service = createIntentService(client);

    const result = await service.understand("college till 2", makePlan());
    expect(result.source).toBe("ai");
    expect(result.intent?.type).toBe("modify_commitment");
    expect(result.apply?.changes.length).toBeGreaterThan(0);
  });

  it("falls back to deterministic when AI returns an invalid intent", async () => {
    const stub: AIProvider = {
      name: "gemini",
      isConfigured: () => true,
      status: () => ({ name: "gemini", model: "m", configured: true }),
      async chat() {
        return { content: "", model: "m" };
      },
      async json<T>() {
        return { data: { nonsense: true } as T, model: "m" };
      },
    };
    const client = new AIClient(stub);
    const service = createIntentService(client);

    const result = await service.understand("college till 2", makePlan());
    expect(result.source).toBe("deterministic");
    expect(result.resolution.status).toBe("resolved");
  });
});