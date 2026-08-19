/**
 * Brain.ts
 *
 * Conversation
 *       │
 *       ▼
 *    Preprocessor
 *       │
 *       ▼
 *    Analyzer
 *       │
 *       ▼
 *    Validator
 *       │
 *       ▼
 *    Prioritizer
 *       │
 *       ▼
 *    Scheduler
 *       │
 *       ▼
 *    Evaluator
 *       │
 *       ▼
 *    TodayPlan
 */

import type { BrainInput, BrainOutput, LogEntry, FixedEvent } from "./types";
import { preprocessConversation } from "./Preprocessor";
import { analyzeConversation } from "./Analyzer";
import { validateAnalysis } from "./Validator";
import { prioritizeIntents } from "./Prioritizer";
import { scheduleDay } from "./Scheduler";
import { evaluatePlan } from "./Evaluator";
import { mapToCommitment } from "../engine/CalendarEngine";

function formatTimeFromDate(date: Date): string {
  let h = date.getHours();
  const m = date.getMinutes();
  const period = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return m > 0 ? `${h}:${String(m).padStart(2, "0")} ${period}` : `${h}:00 ${period}`;
}

export async function generatePlan(input: BrainInput): Promise<BrainOutput> {
  const allLogs: LogEntry[] = [];

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

  const { fixedEvents, flexibleTasks, logs: prioritizerLogs } = prioritizeIntents(
    analysis,
    input.priorities
  );
  allLogs.push(...prioritizerLogs);

  const calendarFixed: FixedEvent[] = (input.calendarEvents ?? []).map((e) => ({
    title: e.title,
    startTime: e.allDay ? undefined : formatTimeFromDate(e.startDate),
    endTime: e.allDay ? undefined : formatTimeFromDate(e.endDate),
    confidence: 1.0,
  }));

  const allFixed = [...calendarFixed, ...fixedEvents];

  const { plan, logs: schedulerLogs } = scheduleDay(
    allFixed,
    flexibleTasks,
    analysis.constraints,
    analysis.preferences
  );
  allLogs.push(...schedulerLogs);

  if (input.calendarEvents && input.calendarEvents.length > 0) {
    plan.calendarEvents = input.calendarEvents;
  }

  const evaluation = evaluatePlan(plan);
  allLogs.push(...evaluation.logs);

  return {
    todayPlan: plan,
    confidence: evaluation.confidence,
    reasoning: evaluation.reasoning,
    logs: allLogs,
  };
}
