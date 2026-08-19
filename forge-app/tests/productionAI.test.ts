import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sha256 } from "../src/ai/debug/sha256";
import { Logger, AI_DEBUG } from "../src/ai/debug/Logger";
import { AIRequestLimiter } from "../src/ai/AIRequestLimiter";
import { AIRequestCache } from "../src/ai/AIRequestCache";
import {
  classifyError,
  graceful,
  AI_USER_MESSAGES,
} from "../src/ai/GracefulFailure";
import {
  AIProviderError,
  AIJSONParseError,
  AIProviderNotConfiguredError,
} from "../src/ai/types/AIResponse";
import { AIClient } from "../src/ai/AIClient";
import type { AIProvider } from "../src/ai/providers/AIProvider";

describe("sha256", () => {
  it("matches NIST test vectors", () => {
    expect(sha256("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("is deterministic", () => {
    expect(sha256("college till 2")).toBe(sha256("college till 2"));
  });

  it("differs for different inputs", () => {
    expect(sha256("college till 2")).not.toBe(sha256("move gym later"));
  });
});

describe("Logger", () => {
  const originalLog = console.log;
  const originalError = console.error;

  beforeEach(() => {
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    vi.restoreAllMocks();
  });

  it("exports a boolean flag", () => {
    expect(typeof AI_DEBUG).toBe("boolean");
  });

  it("exposes log/warn/error/info", () => {
    for (const fn of ["log", "warn", "error", "info"]) {
      expect(typeof (Logger as Record<string, unknown>)[fn]).toBe("function");
    }
  });
});

describe("AIRequestLimiter", () => {
  it("coalesces burst calls into one execution", async () => {
    const limiter = new AIRequestLimiter({ windowMs: 100 });
    let executions = 0;

    const work = async () => {
      executions++;
      await new Promise((r) => setTimeout(r, 20));
      return "result";
    };

    const [a, b, c] = await Promise.all([
      limiter.run("tap", work),
      limiter.run("tap", work),
      limiter.run("tap", work),
    ]);

    expect(a).toBe("result");
    expect(b).toBe("result");
    expect(c).toBe("result");
    expect(executions).toBe(1);
  });

  it("allows a new call after the window closes", async () => {
    const limiter = new AIRequestLimiter({ windowMs: 30 });
    let executions = 0;
    const work = async () => {
      executions++;
      return "result";
    };

    await limiter.run("tap", work);
    await new Promise((r) => setTimeout(r, 60));
    await limiter.run("tap", work);

    expect(executions).toBe(2);
  });

  it("tracks pending keys while busy", async () => {
    const limiter = new AIRequestLimiter({ windowMs: 50 });
    const work = async () => {
      await new Promise((r) => setTimeout(r, 10));
      return "ok";
    };

    const promise = limiter.run("tap", work);
    expect(limiter.pendingKeys).toContain("tap");
    expect(limiter.isBusy).toBe(true);
    await promise;
  });
});

describe("AIRequestCache", () => {
  it("returns null on a miss", () => {
    const cache = new AIRequestCache({ ttlMs: 5000 });
    expect(cache.get("nope")).toBeNull();
  });

  it("stores and returns within ttl", () => {
    const cache = new AIRequestCache({ ttlMs: 5000 });
    cache.set("k", { ok: true });
    expect(cache.get("k")).toEqual({ ok: true });
  });

  it("expires after ttl", async () => {
    const cache = new AIRequestCache({ ttlMs: 20 });
    cache.set("k", "v");
    await new Promise((r) => setTimeout(r, 40));
    expect(cache.get("k")).toBeNull();
  });

  it("getOrCompute hits the cache without recomputing", async () => {
    const cache = new AIRequestCache({ ttlMs: 5000 });
    let computes = 0;
    const compute = async () => {
      computes++;
      return "expensive";
    };

    const first = await cache.getOrCompute("k", compute);
    const second = await cache.getOrCompute("k", compute);

    expect(first).toBe("expensive");
    expect(second).toBe("expensive");
    expect(computes).toBe(1);
  });

  it("keys are SHA256 of the content", () => {
    const key = AIRequestCache.keyFor("college till 2", "0.2");
    expect(key).toBe(sha256("college till 2\u00000.2"));
  });
});

describe("classifyError", () => {
  it("classifies rate limits as rate_limited", () => {
    const err = new AIProviderError("gemini returned 429: too many", "gemini");
    const f = classifyError(err);
    expect(f.kind).toBe("rate_limited");
    expect(f.userMessage).toContain("AI limit");
    expect(f.fallback).toBe("deterministic");
  });

  it("classifies server errors", () => {
    const err = new AIProviderError("gemini returned 503: busy", "gemini");
    expect(classifyError(err).kind).toBe("server");
    expect(classifyError(err).retryable).toBe(true);
  });

  it("classifies parse failures", () => {
    const err = new AIJSONParseError("gemini", "not json");
    const f = classifyError(err);
    expect(f.kind).toBe("parse");
    expect(f.fallback).toBe("retry");
  });

  it("classifies offline", () => {
    const err = new Error("Network request failed");
    const f = classifyError(err);
    expect(f.kind).toBe("offline");
    expect(f.userMessage).toContain("offline");
  });

  it("classifies timeout", () => {
    const err = new Error("The request timed out");
    expect(classifyError(err).kind).toBe("timeout");
  });

  it("classifies unconfigured", () => {
    const err = new AIProviderNotConfiguredError("gemini");
    expect(classifyError(err).kind).toBe("unconfigured");
  });

  it("falls back to unknown", () => {
    expect(classifyError(new Error("weird thing")).kind).toBe("unknown");
  });
});

describe("graceful", () => {
  it("returns data when the work succeeds", async () => {
    const { data, failure } = await graceful(
      async () => 42,
      () => 0
    );
    expect(data).toBe(42);
    expect(failure).toBeNull();
  });

  it("calls the fallback and reports the failure", async () => {
    const { data, failure } = await graceful(
      async () => {
        throw new AIProviderError("gemini returned 429: nope", "gemini");
      },
      (f) => ({ fellBack: f.kind })
    );
    expect(data).toEqual({ fellBack: "rate_limited" });
    expect(failure?.kind).toBe("rate_limited");
  });

  it("exposes user messages for every kind", () => {
    for (const kind of ["offline", "rate_limited", "server", "parse", "timeout", "unknown"] as const) {
      expect(typeof AI_USER_MESSAGES[kind]).toBe("string");
      expect(AI_USER_MESSAGES[kind].length).toBeGreaterThan(0);
    }
  });
});

describe("AIClient production layer", () => {
  function countingProvider(executions: { count: number }): AIProvider {
    return {
      name: "gemini",
      isConfigured: () => true,
      status: () => ({ name: "gemini", model: "m", configured: true }),
      async chat() {
        executions.count++;
        return { content: "reply", model: "m" };
      },
      async json<T>() {
        executions.count++;
        return { data: { ok: true } as T, model: "m" };
      },
    };
  }

  it("caches identical chat calls", async () => {
    const executions = { count: 0 };
    const client = new AIClient(countingProvider(executions));
    const params = { messages: [{ role: "user" as const, content: "hello" }] };

    const a = await client.chat(params);
    const b = await client.chat(params);

    expect(a.content).toBe("reply");
    expect(b.content).toBe("reply");
    expect(executions.count).toBe(1);
  });

  it("coalesces concurrent identical json calls into one request", async () => {
    const executions = { count: 0 };
    const client = new AIClient(countingProvider(executions));
    const params = { messages: [{ role: "user" as const, content: "same prompt" }] };

    const results = await Promise.all([
      client.json(params),
      client.json(params),
      client.json(params),
    ]);

    expect(results.every((r) => r.data.ok)).toBe(true);
    expect(executions.count).toBe(1);
  });

  it("skips the production layer when disabled", async () => {
    const executions = { count: 0 };
    const client = new AIClient(countingProvider(executions), { production: false });
    const params = { messages: [{ role: "user" as const, content: "hello" }] };

    await client.chat(params);
    await client.chat(params);

    expect(executions.count).toBe(2);
  });

  it("does not cache failed calls", async () => {
    let shouldFail = true;
    const provider: AIProvider = {
      name: "gemini",
      isConfigured: () => true,
      status: () => ({ name: "gemini", model: "m", configured: true }),
      async chat() {
        if (shouldFail) throw new Error("boom");
        return { content: "ok", model: "m" };
      },
    };
    const client = new AIClient(provider);
    const params = { messages: [{ role: "user" as const, content: "flaky" }] };

    await expect(client.chat(params)).rejects.toThrow("boom");
    shouldFail = false;
    const result = await client.chat(params);
    expect(result.content).toBe("ok");
  });
});