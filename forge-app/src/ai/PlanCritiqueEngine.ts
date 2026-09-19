import type { TodayPlan } from "../types/todayPlan";
import type { Commitment } from "../types/commitment";
import type { AIClient } from "./AIClient";
import type { PlanCritique, CritiqueIssue } from "./prompts/PlanCritiquePrompt";
import { buildPlanCritiquePrompt } from "./prompts/PlanCritiquePrompt";
import { jsonWithRetry } from "./RetryEngine";
import { parseTimeToMinutes as toMinutes, formatTime } from "../utils/timeUtils";
import { Logger } from "./debug/Logger";

export type CritiqueResult = {
  plan: TodayPlan;
  critique: PlanCritique;
  changed: boolean;
  explanation: string;
};

function planToText(plan: TodayPlan): string {
  return plan.commitments
    .map((c) => {
      const lock = c.locked ? " [locked]" : "";
      return `- ${c.title} (${c.startTime} – ${c.endTime})${lock}`;
    })
    .join("\n");
}

function applyCritiqueFixes(plan: TodayPlan, issues: CritiqueIssue[]): TodayPlan {
  const newPlan = structuredClone(plan);
  let changed = false;

  for (const issue of issues) {
    if (issue.severity !== "high") continue;

    if (issue.type === "recovery" && issue.affectedCommitments.length > 0) {
      const target = issue.affectedCommitments[0];
      const commitment = newPlan.commitments.find(
        (c) => c.title.toLowerCase() === target.toLowerCase()
      );
      if (commitment && !commitment.locked) {
        const start = toMinutes(commitment.startTime);
        const duration = toMinutes(commitment.endTime) - start;
        if (duration > 45) {
          commitment.endTime = formatTime((start + duration - 15) / 60);
          changed = true;
        }
      }
    }

    if (issue.type === "energy" && issue.affectedCommitments.length > 0) {
      const last = issue.affectedCommitments[issue.affectedCommitments.length - 1];
      const commitment = newPlan.commitments.find(
        (c) => c.title.toLowerCase() === last.toLowerCase()
      );
      if (commitment && !commitment.locked) {
        const start = toMinutes(commitment.startTime);
        const duration = toMinutes(commitment.endTime) - start;
        if (duration > 60) {
          commitment.endTime = formatTime((start + 45) / 60);
          changed = true;
        }
      }
    }

    if (issue.type === "pacing" && issue.affectedCommitments.length > 0) {
      const target = issue.affectedCommitments[0];
      const commitment = newPlan.commitments.find(
        (c) => c.title.toLowerCase() === target.toLowerCase()
      );
      if (commitment && !commitment.locked) {
        const start = toMinutes(commitment.startTime);
        const duration = toMinutes(commitment.endTime) - start;
        if (start >= 21 * 60) {
          commitment.endTime = formatTime((start + Math.min(duration, 45)) / 60);
          changed = true;
        }
      }
    }
  }

  if (changed) {
    newPlan.commitments.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  }

  return newPlan;
}

function buildExplanation(critique: PlanCritique, changed: boolean): string {
  const highIssues = critique.issues.filter((i) => i.severity === "high");
  const mediumIssues = critique.issues.filter((i) => i.severity === "medium");

  if (highIssues.length === 0 && mediumIssues.length === 0) {
    return "plan looks solid — no issues found.";
  }

  const parts: string[] = [];
  if (changed) {
    parts.push(`fixed ${highIssues.length} high-severity issue(s):`);
    for (const issue of highIssues) {
      parts.push(`  - ${issue.suggestion}`);
    }
  } else {
    parts.push(critique.summary);
  }

  if (mediumIssues.length > 0) {
    parts.push("things to watch:");
    for (const issue of mediumIssues) {
      parts.push(`  - ${issue.description}`);
    }
  }

  return parts.join("\n");
}

export async function critiquePlan(
  plan: TodayPlan,
  client: AIClient,
  context?: { lifeSeason?: string; priorities?: string[]; identity?: string; goals?: string[]; timePreferences?: string; behavioralPatterns?: string }
): Promise<CritiqueResult> {
  if (!client.isConfigured() || plan.commitments.length === 0) {
    return {
      plan,
      critique: { issues: [], overallScore: 0.85, summary: "AI not configured — skipping critique" },
      changed: false,
      explanation: "AI critique skipped.",
    };
  }

  const planText = planToText(plan);
  const prompt = buildPlanCritiquePrompt(planText, context);

  try {
    const result = await jsonWithRetry<PlanCritique>(
      client,
      {
        messages: [
          { role: "system", content: "You are Forge's Plan Critique Engine." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        maxTokens: 1000,
        operation: "critique",
      },
      { maxAttempts: 2 }
    );

    const critique = result.data;
    const newPlan = applyCritiqueFixes(plan, critique.issues);
    const changed = JSON.stringify(newPlan.commitments) !== JSON.stringify(plan.commitments);
    const explanation = buildExplanation(critique, changed);

    Logger.log(`[critique] score: ${critique.overallScore}, issues: ${critique.issues.length}, changed: ${changed}`);

    return { plan: newPlan, critique, changed, explanation };
  } catch (e) {
    Logger.warn(`[critique] failed: ${e instanceof Error ? e.message : "unknown"}`);
    return {
      plan,
      critique: { issues: [], overallScore: 0.7, summary: "critique unavailable" },
      changed: false,
      explanation: "critique unavailable — keeping original plan.",
    };
  }
}
