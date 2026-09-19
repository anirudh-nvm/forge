import type { PlanningAnalysis, PlanningIssue } from "./PlanningAnalyzer";
import type { AIClient } from "../ai/AIClient";
import { jsonWithRetry } from "../ai/RetryEngine";
import { Logger } from "../ai/debug/Logger";

export type PlanExplanation = {
  summary: string;
  issueExplanations: { issue: string; why: string; suggestion: string }[];
  overloadNarrative: string;
};

function issueToText(issue: PlanningIssue): string {
  return `${issue.type}: ${issue.description} (severity: ${issue.severity}, metric: ${issue.metric})`;
}

function buildExplanationPrompt(analysis: PlanningAnalysis): string {
  const issueText = analysis.issues.map(issueToText).join("\n");

  return `You are Forge's Planning Explainer. A deterministic planning analyzer detected these issues in a day plan:

${issueText}

Overload score: ${analysis.overloadScore}/100
Total study: ${Math.round(analysis.totalStudyMinutes / 60)}h
Total deep work: ${Math.round(analysis.totalDeepWorkMinutes / 60)}h

Your job: explain WHY each issue matters and what the user can do about it.

Rules:
1. Be specific. Reference the actual commitments.
2. Explain the cognitive science briefly (e.g., "deep work depletes cognitive resources").
3. Give actionable suggestions ("shorten X by 15 min", "add a 10-min break").
4. Be warm and supportive, not preachy.
5. If overload score > 80, acknowledge the day is heavy.
6. If issues are low severity, keep it brief.
7. Output one JSON object. Nothing else.`;
}

export async function explainAnalysis(
  analysis: PlanningAnalysis,
  client?: AIClient
): Promise<PlanExplanation> {
  if (!client?.isConfigured() || analysis.issues.length === 0) {
    const fallbackExplanations = analysis.issues.map((issue) => ({
      issue: issue.description,
      why: getFallbackWhy(issue),
      suggestion: getFallbackSuggestion(issue),
    }));

    return {
      summary: analysis.overloadScore > 75
        ? `Day is ${analysis.overloadScore}% loaded.`
        : "Plan looks reasonable.",
      issueExplanations: fallbackExplanations,
      overloadNarrative: `${Math.round(analysis.totalStudyMinutes / 60)}h total, ${Math.round(analysis.totalDeepWorkMinutes / 60)}h deep work.`,
    };
  }

  const prompt = buildExplanationPrompt(analysis);

  try {
    const result = await jsonWithRetry<PlanExplanation>(
      client,
      {
        messages: [
          { role: "system", content: "You are Forge's Planning Explainer." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        maxTokens: 800,
        operation: "explain",
      },
      { maxAttempts: 2 }
    );

    Logger.log(`[explain] generated explanation for ${analysis.issues.length} issues`);
    return result.data;
  } catch (e) {
    Logger.warn(`[explain] failed: ${e instanceof Error ? e.message : "unknown"}`);
    return {
      summary: "Plan analyzed.",
      issueExplanations: analysis.issues.map((issue) => ({
        issue: issue.description,
        why: getFallbackWhy(issue),
        suggestion: getFallbackSuggestion(issue),
      })),
      overloadNarrative: `${Math.round(analysis.totalStudyMinutes / 60)}h total.`,
    };
  }
}

function getFallbackWhy(issue: PlanningIssue): string {
  switch (issue.type) {
    case "cognitive_load":
      return "Back-to-back deep work depletes cognitive resources without recovery time.";
    case "recovery_gap":
      return "Transitions between tasks need buffer time to reset focus.";
    case "meal_gap":
      return "Long gaps without meals cause energy crashes and reduced focus.";
    case "sleep_conflict":
      return "Late endings reduce sleep quality and next-day performance.";
    case "pacing":
      return "Task timing doesn't match your natural energy curve.";
    case "overload":
      return "Too many tasks compete for limited time and energy.";
    default:
      return "This scheduling pattern may reduce effectiveness.";
  }
}

function getFallbackSuggestion(issue: PlanningIssue): string {
  switch (issue.type) {
    case "cognitive_load":
      return "Add 10-15 minute breaks between deep work blocks.";
    case "recovery_gap":
      return "Extend transitions to at least 10 minutes.";
    case "meal_gap":
      return "Add a meal or snack break.";
    case "sleep_conflict":
      return "Move later tasks to tomorrow or shorten them.";
    case "pacing":
      return "Shift demanding tasks to your high-energy hours.";
    case "overload":
      return "Consider moving some tasks to tomorrow.";
    default:
      return "Adjust timing as needed.";
  }
}
