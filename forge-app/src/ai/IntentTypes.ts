import type { StructuredConstraint } from "../brain/types";

export type IntentType =
  | "modify_commitment"
  | "cancel_commitment"
  | "add_commitment"
  | "move_commitment"
  | "delay_commitment"
  | "energy"
  | "general_conversation";

export interface ModifyCommitmentIntent {
  type: "modify_commitment";
  target: string;
  changes: {
    startTime?: string;
    endTime?: string;
    durationMinutes?: number;
  };
  confidence: number;
}

export interface CancelCommitmentIntent {
  type: "cancel_commitment";
  target: string | "all";
  confidence: number;
}

export interface AddCommitmentIntent {
  type: "add_commitment";
  title: string;
  startTime?: string;
  endTime?: string;
  constraints?: StructuredConstraint[];
  confidence: number;
}

export interface MoveCommitmentIntent {
  type: "move_commitment";
  target: string;
  direction: "earlier" | "later";
  minutes?: number;
  confidence: number;
}

export interface DelayCommitmentIntent {
  type: "delay_commitment";
  target: string;
  minutes: number;
  confidence: number;
}

export interface EnergyIntent {
  type: "energy";
  level: "low" | "tired" | "recovering";
  confidence: number;
}

export interface GeneralConversationIntent {
  type: "general_conversation";
  message: string;
  confidence: number;
}

export type Intent =
  | ModifyCommitmentIntent
  | CancelCommitmentIntent
  | AddCommitmentIntent
  | MoveCommitmentIntent
  | DelayCommitmentIntent
  | EnergyIntent
  | GeneralConversationIntent;

export type IntentResolutionStatus =
  | "resolved"
  | "ambiguous"
  | "not_found"
  | "locked"
  | "general";

export interface IntentResolution {
  status: IntentResolutionStatus;
  intent?: Intent;
  candidates?: string[];
  message: string;
}
