export interface ConversationContract {
  fixedEvents: ExtractedFixedEvent[];
  flexibleTasks: ExtractedFlexibleTask[];
  constraints: ExtractedConstraint[];
  clarifications: Clarification[];
  confidence: number;
  missing: MissingField[];
  assumptions: string[];
}

export interface ExtractedFixedEvent {
  title: string;
  startTime?: string;
  endTime?: string;
}

export interface ExtractedFlexibleTask {
  title: string;
  estimatedMinutes?: number;
  sessionCount?: number;
  constraints: ExtractedConstraint[];
}

export interface ExtractedConstraint {
  type: "before" | "after" | "between" | "morning" | "afternoon" | "evening" | "first_thing" | "late_afternoon" | "anytime";
  target?: string;
  tight?: boolean;
}

export interface Clarification {
  question: string;
  context: string;
  expects: "time" | "entity" | "confirmation" | "day";
}

export interface MissingField {
  field: "duration" | "time" | "entity" | "day" | "priority";
  commitment?: string;
  reason: string;
}