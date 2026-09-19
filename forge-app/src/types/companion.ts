export type EnergyLevel =
  | "low"
  | "tired"
  | "recovering"
  | "neutral"
  | "good"
  | "energized";

export type EnergySource = "self_report" | "observation" | "inferred";

export type EnergyState = {
  level: EnergyLevel;
  source: EnergySource;
  confidence: number;
};

export type TaskCheckInResponse =
  | "tiring"
  | "productive"
  | "need_break"
  | "fine"
  | "great";

export type TaskCheckIn = {
  commitmentId: string;
  response: TaskCheckInResponse;
  timestamp: string;
};

export type ThreadStatus = "morning" | "planning" | "active" | "finished";

export type ConversationThread = {
  id: string;
  date: string;
  energy: EnergyState;
  expectation?: string;
  focus?: string;
  taskCheckIns: TaskCheckIn[];
  status: ThreadStatus;
  isOpen: boolean;
  createdAt: string;
  closedAt?: string;
};

export type RelationshipStage = "new" | "familiar" | "trusted" | "partner";

export type RelationshipContext = {
  stage: RelationshipStage;
  trustScore: number;
  daysSinceFirstUse: number;
  consistency: number;
};

export type ReferenceContext = {
  shouldAskEnergy: boolean;
  question: string;
  shouldReferenceYesterday: boolean;
  yesterdayMessage: string | null;
};
