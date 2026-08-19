import { describe, it, expect, beforeEach } from "vitest";
import { aiAnalytics } from "../src/ai/AIAnalytics";
import { aiStats } from "../src/ai/metrics/AIStats";
import { createTokenUsage, DEFAULT_TOKEN_PRICING } from "../src/ai/metrics/TokenUsage";
import { healthScore, DEFAULT_HEALTH_THRESHOLDS } from "../src/ai/metrics/HealthScore";
import { redactPrompt } from "../src/ai/metrics/types";
import { AIClient } from "../src/ai/AIClient";
import { AIJSONParseError } from "../src/ai/types/AIResponse";
import { jsonWithRetry } from "../src/ai/RetryEngine";
import type { AIProvider } from "../src/ai/providers/AIProvider";

beforeEach(() => {
  aiAnalytics.reset();
});

function stubProvider(opts?: {
  fail?: boolean;
  latencyMs?: number;
  usage?: { input: number; output: number };
}): AIProvider {
  return {
    name: "gemini",
    isConfigured: () => true,
    status: () => ({ name: "gemini", model: "m", configured: true }),
    async chat() {
      await new Promise((r) => setTimeout(r, opts?.latencyMs ?? 1));
      if (opts?.fail) throw new Error("boom");
      return {
        content: "reply",
        model: "m",
        usage: opts?.usage
          ? {
              inputTokens: opts.usage.input,
              outputTokens: opts.usage.output,
              totalTokens: opts.usage.input + opts.usage.output,
            }
          : undefined,
      };
    },
    async json<T>() {
      await new Promise((r) => setTimeout(r, opts?.latencyMs ?? 1));
      if (opts?.fail) throw new Error("boom");
      return {
        data: { ok: true } as T,
        model: "m",
        usage: opts?.usage
          ? {
              inputTokens: opts.usage.input,
              outputTokens: opts.usage.output,
              totalTokens: opts.usage.input + opts.usage.output,
            }
          : undefined,
      };
    },
  };
}

describe("AIAnalytics", () => {
  it("tracks requests, latency, and success rate", async () => {
    const client = new AIClient(stubProvider({ latencyMs: 20 }));
    await client.chat({ messages: [{ role: "user", content: "chat me" }] });
    await client.json({ messages: [{ role: "user", content: "json me" }] });

    const s = aiAnalytics.summary();
    expect(s.totalRequests).toBe(2);
    expect(s.successRate).toBe(100);
    expect(s.fastestMs).toBeGreaterThan(0);
    expect(s.slowestMs).toBeGreaterThanOrEqual(s.fastestMs);
    expect(s.averageLatencyMs).toBeGreaterThan(0);
    expect(s.cacheHits).toBe(0);
    expect(s.cacheMisses).toBe(2);
  });

  it("counts failures against success rate", async () => {
    const client = new AIClient(stubProvider({ fail: true }));
    await expect(client.chat({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow();
    await expect(client.json({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow();

    const s = aiAnalytics.summary();
    expect(s.totalRequests).toBe(2);
    expect(s.successRate).toBe(0);
  });

  it("counts cache hits and misses", async () => {
    const client = new AIClient(stubProvider());
    const params = { messages: [{ role: "user" as const, content: "same" }] };
    await client.chat(params);
    await client.chat(params);
    await client.chat(params);

    const s = aiAnalytics.summary();
    expect(s.cacheHits).toBe(2);
    expect(s.cacheMisses).toBe(1);
  });

  it("tracks AI vs deterministic operations", async () => {
    aiAnalytics.recordOperation("ai");
    aiAnalytics.recordOperation("ai");
    aiAnalytics.recordOperation("deterministic");

    const s = aiAnalytics.summary();
    expect(s.aiUsedPct).toBe(66.7);
    expect(s.deterministicPct).toBe(33.3);
  });

  it("tracks retries and parse failures", async () => {
    aiAnalytics.recordRetry();
    aiAnalytics.recordRetry();
    aiAnalytics.recordParseFailure();

    const s = aiAnalytics.summary();
    expect(s.retryCount).toBe(2);
    expect(s.parseFailures).toBe(1);
  });

  it("buckets latency by operation", async () => {
    const client = new AIClient(stubProvider());
    await client.json({ messages: [{ role: "user", content: "x" }], operation: "adjustment" });
    await client.json({ messages: [{ role: "user", content: "y" }], operation: "reflection" });

    const s = aiAnalytics.summary();
    expect(s.byOperation.adjustment.count).toBe(1);
    expect(s.byOperation.reflection.count).toBe(1);
    expect(s.byOperation.planning.count).toBe(0);
  });

  it("reset clears the ledger", () => {
    const client = new AIClient(stubProvider());
    client.chat({ messages: [{ role: "user", content: "hi" }] });
    aiAnalytics.reset();
    const s = aiAnalytics.summary();
    expect(s.totalRequests).toBe(0);
  });
});

describe("TokenUsage", () => {
  it("computes totals and cost with defaults", () => {
    const usage = createTokenUsage();
    usage.record(1_000_000, 250_000, "planning");
    usage.record(500_000, 250_000, "adjustment");

    expect(usage.totals(aiAnalytics.tokenRecords).input).toBe(1_500_000);
    expect(usage.totals(aiAnalytics.tokenRecords).output).toBe(500_000);
    expect(usage.totals(aiAnalytics.tokenRecords).total).toBe(2_000_000);

    const today = usage.todayCost();
    expect(today).toBeCloseTo(0.10 + 0.40 * 0.25 + 0.10 * 0.5 + 0.40 * 0.25, 5);
  });

  it("tracks per-operation cost", () => {
    const usage = createTokenUsage();
    usage.record(1_000_000, 0, "reflection");

    expect(usage.operationCost("reflection")).toBeCloseTo(0.10, 5);
    expect(usage.operationCost("mentor")).toBe(0);
  });

  it("averageOperationCost divides by record count", () => {
    const usage = createTokenUsage();
    usage.record(1_000_000, 0, "adjustment");
    usage.record(1_000_000, 0, "adjustment");
    expect(usage.averageOperationCost("adjustment")).toBeCloseTo(0.10, 5);
  });

  it("honors custom pricing", () => {
    const usage = createTokenUsage({ inputPerMillion: 1, outputPerMillion: 2 });
    usage.record(1_000_000, 1_000_000, "planning");
    expect(usage.todayCost()).toBe(3);
  });

  it("records tokens end-to-end through AIClient", async () => {
    const usage = createTokenUsage();
    const client = new AIClient(
      stubProvider({ usage: { input: 400, output: 100 } })
    );
    await client.chat({ messages: [{ role: "user", content: "hi" }], operation: "adjustment" });

    expect(usage.todayTokens().input).toBe(400);
    expect(usage.todayTokens().output).toBe(100);
    expect(usage.operationCost("adjustment")).toBe(
      (400 / 1_000_000) * DEFAULT_TOKEN_PRICING.inputPerMillion +
        (100 / 1_000_000) * DEFAULT_TOKEN_PRICING.outputPerMillion
    );
  });
});

describe("AIStats", () => {
  it("reports per-operation averages from the ledger", async () => {
    const client = new AIClient(stubProvider({ latencyMs: 5 }));
    await client.json({ messages: [{ role: "user", content: "a" }], operation: "planning" });
    await client.json({ messages: [{ role: "user", content: "b" }], operation: "planning" });
    await client.json({ messages: [{ role: "user", content: "c" }], operation: "mentor" });

    const stats = aiStats();
    expect(stats.byOperation.planning.count).toBe(2);
    expect(stats.byOperation.planning.avgMs).toBeGreaterThan(0);
    expect(stats.byOperation.mentor.count).toBe(1);
    expect(stats.totalCalls).toBe(3);
  });

  it("exposes recent timing entries", async () => {
    const client = new AIClient(stubProvider());
    await client.chat({ messages: [{ role: "user", content: "z" }], operation: "reflection" });

    const stats = aiStats();
    expect(stats.recent.length).toBeGreaterThan(0);
    expect(stats.recent[0].operation).toBe("reflection");
    expect(stats.recent[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(stats.recent[0].start).toBeLessThanOrEqual(stats.recent[0].end);
  });
});

describe("HealthScore", () => {
  it("reports all checks green after healthy usage", async () => {
    const client = new AIClient(stubProvider());
    const params = { messages: [{ role: "user" as const, content: "s" }] };
    await client.chat(params);
    await client.chat(params);
    await client.chat(params);

    const report = healthScore();
    expect(report.healthy).toBe(true);
    const labels = report.checks.map((c) => c.label);
    expect(labels).toEqual([
      "API Connected",
      "Cache Working",
      "Retry Active",
      "Average Latency",
      "Parse Success",
      "Cost Today",
    ]);
  });

  it("flips API Connected red when there are no requests", () => {
    const report = healthScore();
    expect(report.healthy).toBe(false);
    expect(report.checks[0].ok).toBe(false);
  });

  it("flags slow average latency", () => {
    const client = new AIClient(stubProvider({ latencyMs: 200 }));
    return client
      .chat({ messages: [{ role: "user", content: "hi" }] })
      .then(() => {
        const report = healthScore({ ...DEFAULT_HEALTH_THRESHOLDS, slowLatencyMs: 100 });
        expect(report.checks.find((c) => c.label === "Average Latency")?.ok).toBe(false);
      });
  });

  it("flags parse failures via retry engine", async () => {
    let calls = 0;
    const provider: AIProvider = {
      name: "gemini",
      isConfigured: () => true,
      status: () => ({ name: "gemini", model: "m", configured: true }),
      async chat() {
        return { content: "", model: "m" };
      },
      async json<T>() {
        calls++;
        if (calls === 1) throw new AIJSONParseError("gemini", "bad");
        return { data: {} as T, model: "m" };
      },
    };
    const client = new AIClient(provider);
    await jsonWithRetry(client, { messages: [{ role: "user", content: "x" }] });

    const report = healthScore();
    expect(aiAnalytics.summary().retryCount).toBe(1);
    expect(aiAnalytics.summary().parseFailures).toBe(1);
    expect(report.checks.find((c) => c.label === "Retry Active")?.detail).toContain("1 retries");
  });
});

describe("redactPrompt", () => {
  it("truncates long prompts", () => {
    const long = "x".repeat(1000);
    expect(redactPrompt(long, 100).length).toBeLessThan(200);
    expect(redactPrompt(long, 100)).toContain("…");
  });

  it("masks api keys and emails", () => {
    const fakeKey = "GEMINI_API_KEY_PLACEHOLDER_1234567890";

const out = redactPrompt(
  `my key ${fakeKey} is secret, contact dev@forge.app`
);

expect(out).not.toContain(fakeKey);
    expect(out).not.toContain("dev@forge.app");
    expect(out).toContain("[key]");
    expect(out).toContain("[email]");
  });

  it("passes through normal text", () => {
    expect(redactPrompt("college till 2")).toBe("college till 2");
  });
});

describe("debug tracking", () => {
  it("records prompt, response, and cache state", async () => {
    const client = new AIClient(stubProvider());
    const params = { messages: [{ role: "user" as const, content: "move gym to 6" }] };
    await client.chat(params);
    await client.chat(params);

    const log = aiAnalytics.debugLog;
    expect(log).toHaveLength(2);
    const last = log[log.length - 1];
    expect(last.prompt).toContain("move gym to 6");
    expect(last.response).toContain("reply");
    expect(last.cached).toBe(true);
    expect(last.kind).toBe("chat");
  });

  it("records fallback reason when the provider is unconfigured", async () => {
    const client = new AIClient();
    const fallback: AIProvider = {
      name: "deterministic",
      isConfigured: () => true,
      status: () => ({ name: "deterministic", model: "rules", configured: true }),
      async chat() {
        return { content: "fallback reply", model: "rules" };
      },
      async json<T>() {
        return { data: {} as T, model: "rules" };
      },
    };
    client.setFallback(fallback);

    await client.chat({ messages: [{ role: "user", content: "hi" }] });

    const log = aiAnalytics.debugLog;
    const last = log[log.length - 1];
    expect(last.source).toBe("deterministic");
    expect(last.fallbackReason).toContain("not configured");
    expect(aiAnalytics.fallbackReason).toContain("not configured");
  });

  it("records error messages on failure", async () => {
    const client = new AIClient(stubProvider({ fail: true }));
    await expect(
      client.chat({ messages: [{ role: "user", content: "hi" }] })
    ).rejects.toThrow();

    const last = aiAnalytics.debugLog[aiAnalytics.debugLog.length - 1];
    expect(last.success).toBe(false);
    expect(last.fallbackReason).toContain("boom");
  });
});

describe("metrics exports", () => {
  it("exposes analytics/tokens/health/stats from createForgeAI", async () => {
    const { createForgeAI } = await import("../src/ai/services");
    const ai = createForgeAI();
    expect(typeof ai.metrics.analytics.summary).toBe("function");
    expect(typeof ai.metrics.tokens.todayCost).toBe("function");
    expect(typeof ai.metrics.health).toBe("function");
    expect(typeof ai.metrics.stats).toBe("function");
  });
});