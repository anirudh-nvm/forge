import type { TodayPlan, Session } from "../types/todayPlan";
import type { CalendarEvent } from "../types/calendar";

export interface FixedEvent {
  title: string;
  startTime?: string;
  endTime?: string;
  confidence: number;
}

export type ConstraintType =
  | "before"
  | "after"
  | "between"
  | "morning"
  | "afternoon"
  | "evening"
  | "first_thing"
  | "late_afternoon"
  | "anytime";

export interface StructuredConstraint {
  type: ConstraintType;
  target?: string;
  tight?: boolean;
}

export interface FlexibleTask {
  title: string;
  estimatedMinutes?: number;
  sessionCount?: number;
  constraints: StructuredConstraint[];
  confidence: number;
}

export interface Constraint {
  description: string;
  confidence: number;
}

export interface Preference {
  description: string;
  confidence: number;
}

export interface Emotion {
  mood:
    | "calm"
    | "busy"
    | "stressed"
    | "excited"
    | "tired"
    | "unknown";
  confidence: number;
}

export interface ConversationAnalysis {
  fixedEvents: FixedEvent[];
  flexibleTasks: FlexibleTask[];
  constraints: Constraint[];
  preferences: Preference[];
  emotion: Emotion;
  rawConversation: string;
}

export type ExtractedEvent = {
  type: "fixed_event";
  name: string;
  startTime: string;
  endTime: string;
  confidence: number;
  daysFromNow?: number;
};

export type ExtractedTask = {
  type: "task";
  name: string;
  quantity?: number;
  unit?: string;
  constraints: StructuredConstraint[];
  confidence: number;
  daysFromNow?: number;
};

export type ExtractedItem = ExtractedEvent | ExtractedTask;

export interface PreprocessorOutput {
  extractedItems: ExtractedItem[];
  deferredItems: ExtractedItem[];
  detectedTimes: string[];
  detectedDate?: string;
  matchedPatterns: string[];
  removedFillers: string[];
  confidence: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface NormalizationResult {
  normalized: string;
  wasNormalized: boolean;
}

export interface EvaluatorRule {
  name: string;
  passed: boolean;
  reason: string;
}

export type LogEntry = {
  module: string;
  message: string;
};

export interface BrainInput {
  conversation: string;
  priorities: string[];
  currentTime: Date;
  calendarEvents?: CalendarEvent[];
}

export interface BrainDeps {
  ai?: {
    chat: <T>(params: import("../ai/types/AIResponse").ChatParams) => Promise<import("../ai/types/AIResponse").JSONResult<T>>;
    isConfigured: () => boolean;
  };
}

export interface BrainOutput {
  todayPlan: TodayPlan;
  confidence: number;
  reasoning: string[];
  logs: LogEntry[];
}
