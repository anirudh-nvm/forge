/**
 * Brain.ts
 *
 * Dual-track understanding:
 *   1. LLM understanding (via ConversationEngine) — handles natural language
 *   2. Deterministic pipeline — regex + dictionary fallback
 *
 * Pipeline:
 *   Input → LLM? → Preprocessor → Analyzer → Validator → Prioritizer → Scheduler → Evaluator → TodayPlan
 */

import type { BrainInput, BrainOutput, BrainDeps, LogEntry, FixedEvent, FlexibleTask, StructuredConstraint } from "./types";
import { preprocessConversation } from "./Preprocessor";
import { analyzeConversation } from "./Analyzer";
import { validateAnalysis } from "./Validator";
import { prioritizeIntents } from "./Prioritizer";
import { scheduleDay } from "./Scheduler";
import { evaluatePlan } from "./Evaluator";
import { ConversationEngine, type ConversationEngineDeps } from "../ai/ConversationEngine";
import type { ValidatedAnalysis } from "../ai/Validation";
import { ClarificationEngine } from "../ai/ClarificationEngine";
import type { ConversationContract } from "../ai/ConversationContract";
import { buildMemoryContext } from "../ai/MemoryContext";
import { extractEntities, extractNegatedEntities } from "./pipeline/EntityExtractor";
import { generatePredictions, formatPredictions } from "../memory/PredictionEngine";
import { analyzePlan } from "./PlanningAnalyzer";
import { explainAnalysis } from "./PlanExplainer";
import { negotiatePlan } from "./NegotiationEngine";

export type { BrainDeps } from "./types";

function extractMentionedEntities(text: string): Set<string> {
  const entities = extractEntities(text);
  const result = new Set<string>();
  for (const e of entities) {
    result.add(e.normalized.toLowerCase());
    result.add(e.original.toLowerCase());
  }
  return result;
}

function filterHallucinatedEvents(
  fixedEvents: ValidatedAnalysis["fixedEvents"],
  flexibleTasks: ValidatedAnalysis["flexibleTasks"],
  userText: string
): { filteredFixed: ValidatedAnalysis["fixedEvents"]; filteredFlexible: ValidatedAnalysis["flexibleTasks"]; stripped: string[] } {
  const mentioned = extractMentionedEntities(userText);
  const negated = extractNegatedEntities(userText);
  const stripped: string[] = [];

  const filteredFixed = fixedEvents.filter((e) => {
    const titleLower = e.title.toLowerCase();
    // Filter out negated entities
    if (negated.some(n => titleLower.includes(n.toLowerCase()) || n.toLowerCase().includes(titleLower))) {
      stripped.push(e.title);
      return false;
    }
    const match = [...mentioned].some(
      (m) => titleLower.includes(m) || m.includes(titleLower)
    );
    if (!match) {
      stripped.push(e.title);
      return false;
    }
    return true;
  });

  const filteredFlexible = flexibleTasks.filter((t) => {
    const titleLower = t.title.toLowerCase();
    // Filter out negated entities
    if (negated.some(n => titleLower.includes(n.toLowerCase()) || n.toLowerCase().includes(titleLower))) {
      stripped.push(t.title);
      return false;
    }
    const match = [...mentioned].some(
      (m) => titleLower.includes(m) || m.includes(titleLower)
    );
    if (!match) {
      stripped.push(t.title);
      return false;
    }
    return true;
  });

  return { filteredFixed, filteredFlexible, stripped };
}

function splitMergedEvents(
  fixedEvents: ValidatedAnalysis["fixedEvents"],
  userText: string
): ValidatedAnalysis["fixedEvents"] {
  const result: ValidatedAnalysis["fixedEvents"] = [];

  for (const event of fixedEvents) {
    const titleLower = event.title.toLowerCase();

    // Find all time ranges in the user text near this entity
    // Look for the entity name followed by time ranges
    const entityIndex = userText.toLowerCase().indexOf(titleLower);
    if (entityIndex === -1 || !event.startTime || !event.endTime) {
      result.push(event);
      continue;
    }

    // Extract the clause containing this entity (up to next comma or period)
    const afterEntity = userText.substring(entityIndex);
    const clauseEnd = afterEntity.search(/[.,]/);
    const clause = clauseEnd === -1 ? afterEntity : afterEntity.substring(0, clauseEnd);

    // Find all time ranges in this clause
    const timeRangePattern = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to|till|until)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi;
    const timeSlots: { start: string; end: string }[] = [];
    let slotMatch;

    while ((slotMatch = timeRangePattern.exec(clause)) !== null) {
      timeSlots.push({
        start: slotMatch[1].trim(),
        end: slotMatch[2].trim(),
      });
    }

    if (timeSlots.length > 1) {
      // User mentioned multiple time slots - create separate events
      for (const slot of timeSlots) {
        result.push({
          ...event,
          startTime: slot.start,
          endTime: slot.end,
        });
      }
    } else {
      result.push(event);
    }
  }

  return result;
}

function formatTimeFromDate(date: Date): string {
  let h = date.getHours();
  const m = date.getMinutes();
  const period = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return m > 0 ? `${h}:${String(m).padStart(2, "0")} ${period}` : `${h}:00 ${period}`;
}

function convertLLMToFixedEvents(analysis: ValidatedAnalysis): FixedEvent[] {
  return analysis.fixedEvents.map((e) => ({
    title: e.title,
    startTime: e.startTime,
    endTime: e.endTime,
    confidence: 0.9,
  }));
}

function convertLLMToFlexibleTasks(analysis: ValidatedAnalysis): FlexibleTask[] {
  return analysis.flexibleTasks.map((t) => ({
    title: t.title,
    estimatedMinutes: t.estimatedMinutes,
    sessionCount: t.sessionCount,
    constraints: t.constraints.map((c) => ({
      type: c.type as StructuredConstraint["type"],
      target: c.target,
      tight: c.tight,
    })),
    confidence: 0.85,
  }));
}

function convertLLMToConstraints(analysis: ValidatedAnalysis): { description: string; confidence: number }[] {
  return analysis.constraints.map((c) => ({
    description: `${c.type}${c.target ? ` ${c.target}` : ""}`,
    confidence: 0.8,
  }));
}

function buildClarificationResponse(contract: ConversationContract): string | null {
  if (contract.confidence < 0.6 && contract.missing.length > 0) {
    const missing = contract.missing[0];
    const target = missing.commitment ?? "that";
    switch (missing.field) {
      case "duration":
        return `how long do you want to spend on ${target}?`;
      case "time":
        return `when do you want to do ${target}?`;
      case "day":
        return `which day are you thinking for ${target}?`;
      default:
        return ClarificationEngine.formatQuestion({
          question: `can you tell me more about ${target}?`,
          context: missing.reason,
          expects: "time",
        });
    }
  }
  if (!ClarificationEngine.needsClarification(contract)) return null;
  const question = ClarificationEngine.pickMostImportant(contract);
  if (!question) return null;
  return ClarificationEngine.formatQuestion(question);
}

export async function generatePlan(input: BrainInput, deps?: BrainDeps): Promise<BrainOutput> {
  const allLogs: LogEntry[] = [];

  // ── Track LLM state for the response ──────────────────────────
  let llmAnalysis: ValidatedAnalysis | null = null;
  let llmContract: ConversationContract | null = null;
  let llmSource: "ai" | "deterministic" = "deterministic";

  // ── Try LLM understanding first ──────────────────────────────
  if (deps?.ai?.isConfigured()) {
    try {
      const context = {
        priorities: input.priorities,
        currentDate: input.currentTime.toISOString().split("T")[0],
      };

      llmContract = await ConversationEngine.understandConversation(input.conversation, context, deps.ai);
      const validation = await ConversationEngine.validateContract(llmContract);

      if (validation.valid) {
        const { validateContract } = await import("../ai/Validation");
        const result = await validateContract(llmContract);
        if (result.valid && result.analysis) {
          llmAnalysis = result.analysis;
          llmSource = "ai";
          allLogs.push({ module: "Brain", message: "✓ LLM understanding succeeded" });
        }
      } else {
        allLogs.push({ module: "Brain", message: `✗ LLM validation failed: ${validation.errors.join(", ")}` });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      allLogs.push({ module: "Brain", message: `○ LLM unavailable: ${msg} — using deterministic` });
    }
  } else {
    allLogs.push({ module: "Brain", message: "○ AI not configured — using deterministic" });
  }

  // ── If LLM produced clarifications, return them ──────────────
  if (llmContract && llmSource === "ai") {
    const clarificationMsg = buildClarificationResponse(llmContract);
    // Always return clarifications when LLM generates them — even alongside scheduled items
    if (clarificationMsg && llmContract.clarifications.length > 0 && llmContract.confidence < 0.7) {
      allLogs.push({ module: "Brain", message: `? Clarification: ${clarificationMsg}` });
      return {
        todayPlan: {
          greeting: clarificationMsg,
          summary: ["i need a bit more detail to build your plan."],
          commitments: [],
          timeline: [],
          unscheduled: [],
          warnings: [],
          recommendation: "for example: college 2–4 pm, gym, cat for 2 hours.",
          status: "draft",
        },
        confidence: llmContract.confidence,
        reasoning: llmContract.assumptions,
        logs: allLogs,
      };
    }
  }

  // ── Use LLM analysis if it has items, else fall back ──────────
  let fixedEvents: FixedEvent[];
  let flexibleTasks: FlexibleTask[];
  let constraints: { description: string; confidence: number }[];
  let analysisConfidence: number;

  if (llmAnalysis && (llmAnalysis.fixedEvents.length > 0 || llmAnalysis.flexibleTasks.length > 0)) {
    const { filteredFixed, filteredFlexible, stripped } = filterHallucinatedEvents(
      llmAnalysis.fixedEvents,
      llmAnalysis.flexibleTasks,
      input.conversation
    );

    if (stripped.length > 0) {
      allLogs.push({ module: "Brain", message: `○ Stripped hallucinated: ${stripped.join(", ")}` });
    }

    // Post-process: split merged events if user mentioned multiple time slots
    const splitFixed = splitMergedEvents(filteredFixed, input.conversation);
    if (splitFixed.length > filteredFixed.length) {
      allLogs.push({ module: "Brain", message: `○ Split ${filteredFixed.length} events into ${splitFixed.length} (user mentioned multiple time slots)` });
    }

    llmAnalysis.fixedEvents = splitFixed;
    llmAnalysis.flexibleTasks = filteredFlexible;

    fixedEvents = convertLLMToFixedEvents(llmAnalysis);
    flexibleTasks = convertLLMToFlexibleTasks(llmAnalysis);
    constraints = convertLLMToConstraints(llmAnalysis);
    analysisConfidence = llmContract?.confidence ?? 0.85;
    allLogs.push({ module: "Brain", message: `✓ Using LLM: ${fixedEvents.length} events, ${flexibleTasks.length} tasks` });
  } else {
    // ── Deterministic fallback ──────────────────────────────────
    allLogs.push({ module: "Brain", message: "○ Using deterministic pipeline" });

    const { output: preprocessed, logs: preprocessorLogs } = preprocessConversation(input);
    allLogs.push(...preprocessorLogs);

    const { analysis, logs: analyzerLogs } = analyzeConversation(preprocessed, input);
    allLogs.push(...analyzerLogs);

    const { isValid, errors, logs: validatorLogs } = validateAnalysis(analysis);
    allLogs.push(...validatorLogs);

    if (!isValid) {
      return {
        todayPlan: {
          greeting: "i couldn't understand your day.",
          summary: errors,
          commitments: [],
          timeline: [],
          unscheduled: [],
          warnings: errors,
          recommendation: "try telling me about your schedule and tasks.",
          status: "draft",
        },
        confidence: 0,
        reasoning: errors,
        logs: allLogs,
      };
    }

    const { fixedEvents: prioritized, flexibleTasks: prioritizedTasks, logs: prioritizerLogs } = prioritizeIntents(
      analysis,
      input.priorities
    );
    allLogs.push(...prioritizerLogs);

    fixedEvents = prioritized;
    flexibleTasks = prioritizedTasks;
    constraints = analysis.constraints.map((c) => ({ description: c.description, confidence: c.confidence }));
    analysisConfidence = analysis.fixedEvents.length > 0 || analysis.flexibleTasks.length > 0 ? 0.85 : 0.5;
  }

  // ── Graceful recovery: purely conversational input ─────────────
  if (fixedEvents.length === 0 && flexibleTasks.length === 0) {
    const hasWords = input.conversation.trim().length > 0;
    if (hasWords) {
      allLogs.push({ module: "Brain", message: "✓ Conversational input — no schedulable items" });
      return {
        todayPlan: {
          greeting: "glad to hear that.",
          summary: [
            "no schedule items detected from your message.",
            "tell me what you need to get done today so i can build your plan.",
          ],
          commitments: [],
          timeline: [],
          unscheduled: [],
          warnings: [],
          recommendation: "for example: college 2–4 pm, gym, cat for 2 hours.",
          status: "draft",
        },
        confidence: 0.5,
        reasoning: ["conversational input — guiding user to provide schedule"],
        logs: allLogs,
      };
    }
  }

  // ── Calendar events ──────────────────────────────────────────
  const calendarFixed: FixedEvent[] = (input.calendarEvents ?? []).map((e) => ({
    title: e.title,
    startTime: e.allDay ? undefined : formatTimeFromDate(e.startDate),
    endTime: e.allDay ? undefined : formatTimeFromDate(e.endDate),
    confidence: 1.0,
  }));

  const allFixed = [...calendarFixed, ...fixedEvents];

  // ── Schedule ─────────────────────────────────────────────────
  const { plan, logs: schedulerLogs } = scheduleDay(
    allFixed,
    flexibleTasks,
    constraints.map((c) => ({ description: c.description, confidence: c.confidence })),
    [],
    input.currentTime
  );
  allLogs.push(...schedulerLogs);

  if (input.calendarEvents && input.calendarEvents.length > 0) {
    plan.calendarEvents = input.calendarEvents;
  }

  // ── Deterministic Planning Analysis + AI Explanation ─────────
  const analysis = analyzePlan(plan.commitments);
  allLogs.push({ module: "Brain", message: `✓ Planning analysis: ${analysis.issues.length} issues, overload: ${analysis.overloadScore}%` });

  if (analysis.issues.length > 0 && deps?.ai?.isConfigured()) {
    try {
      const explanation = await explainAnalysis(analysis, { isConfigured: () => deps.ai!.isConfigured(), json: deps.ai!.chat } as any);
      plan.warnings.push(explanation.summary);
      for (const exp of explanation.issueExplanations) {
        plan.warnings.push(`${exp.why} — ${exp.suggestion}`);
      }
      allLogs.push({ module: "Brain", message: `✓ AI explanation generated` });
    } catch (e) {
      allLogs.push({ module: "Brain", message: `○ Explanation failed: ${e instanceof Error ? e.message : "unknown"}` });
      for (const issue of analysis.issues) {
        plan.warnings.push(`${issue.description} — severity: ${issue.severity}`);
      }
    }
  } else {
    for (const issue of analysis.issues) {
      plan.warnings.push(`${issue.description} — severity: ${issue.severity}`);
    }
  }

  // ── Negotiation ──────────────────────────────────────────────
  const negotiation = negotiatePlan(plan, analysis);
  if (negotiation.options.length > 1 && analysis.overloadScore > 70) {
    plan.negotiation = negotiation;
    allLogs.push({ module: "Brain", message: `✓ Negotiation: ${negotiation.options.length} options` });
  }

  // ── Predictions ─────────────────────────────────────────────
  const dayOfWeek = input.currentTime.toLocaleDateString("en-US", { weekday: "long" });
  const predictions = await generatePredictions(dayOfWeek);
  if (predictions.length > 0) {
    const predictionStrs = formatPredictions(predictions);
    plan.warnings.push(...predictionStrs);
    allLogs.push({ module: "Brain", message: `✓ ${predictions.length} prediction(s) generated` });
  }

  const evaluation = evaluatePlan(plan);
  allLogs.push(...evaluation.logs);

  return {
    todayPlan: plan,
    confidence: Math.min(analysisConfidence, evaluation.confidence),
    reasoning: [...evaluation.reasoning, `source: ${llmSource}`],
    logs: allLogs,
  };
}
