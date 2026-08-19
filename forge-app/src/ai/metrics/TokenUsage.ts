import { aiAnalytics } from "../AIAnalytics";
import type { AIOperation, TokenRecord } from "./types";

/**
 * Pricing per 1M tokens (USD). Defaults target Gemini Flash-class
 * models. Override via createTokenUsage if your provider differs.
 */
export interface TokenPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

export const DEFAULT_TOKEN_PRICING: TokenPricing = {
  inputPerMillion: 0.10,
  outputPerMillion: 0.40,
};

export interface TokenTotals {
  input: number;
  output: number;
  total: number;
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

/**
 * Phase 6 — Token usage.
 *
 * Gemini returns usage metadata per response (input/output/total
 * tokens). Forge records it so you always know:
 *  - today's cost, this week's cost
 *  - average cost per operation (planning / adjustment / reflection)
 *
 * When thousands of users arrive, this is your cost radar.
 */
export function createTokenUsage(pricing: TokenPricing = DEFAULT_TOKEN_PRICING) {
  function record(inputTokens: number, outputTokens: number, operation: AIOperation): void {
    aiAnalytics.recordTokens({ inputTokens, outputTokens, operation, at: Date.now() });
  }

  function totals(records: TokenRecord[]): TokenTotals {
    const input = records.reduce((sum, r) => sum + r.inputTokens, 0);
    const output = records.reduce((sum, r) => sum + r.outputTokens, 0);
    return { input, output, total: input + output };
  }

  function costOf(records: TokenRecord[]): number {
    const t = totals(records);
    return round6(
      (t.input / 1_000_000) * pricing.inputPerMillion +
        (t.output / 1_000_000) * pricing.outputPerMillion
    );
  }

  function allRecords(): TokenRecord[] {
    return aiAnalytics.tokenRecords;
  }

  function todayRecords(): TokenRecord[] {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return allRecords().filter((r) => r.at >= startOfDay.getTime());
  }

  function weekRecords(): TokenRecord[] {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return allRecords().filter((r) => r.at >= weekAgo);
  }

  function operationRecords(operation: AIOperation): TokenRecord[] {
    return allRecords().filter((r) => r.operation === operation);
  }

  return {
    record,
    totals,
    costOf,
    todayTokens: (): TokenTotals => totals(todayRecords()),
    todayCost: (): number => costOf(todayRecords()),
    weekTokens: (): TokenTotals => totals(weekRecords()),
    weekCost: (): number => costOf(weekRecords()),
    operationCost: (operation: AIOperation): number => costOf(operationRecords(operation)),
    operationTokens: (operation: AIOperation): TokenTotals => totals(operationRecords(operation)),
    averageOperationCost: (operation: AIOperation): number => {
      const records = operationRecords(operation);
      if (records.length === 0) return 0;
      return round6(costOf(records) / records.length);
    },
  };
}

export const tokenUsage = createTokenUsage();
export type TokenUsage = ReturnType<typeof createTokenUsage>;