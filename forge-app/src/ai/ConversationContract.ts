export interface ConversationContract {
  fixedEvents: ExtractedFixedEvent[];
  flexibleTasks: ExtractedFlexibleTask[];
  constraints: ExtractedConstraint[];
  clarifications: Clarification[];
  confidence: number;
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