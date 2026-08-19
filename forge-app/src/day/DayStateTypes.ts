import type { Commitment } from "../types/commitment";
import type { TimelineItem } from "../types/timeline";

export type DayPhase =
  | "before_day"
  | "before_commitment"
  | "recovery"
  | "active_commitment"
  | "between_commitments"
  | "day_complete";

export interface CommitmentRef {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  locked: boolean;
}

export interface RecoveryRef {
  id: string;
  reason: "after_long_fixed" | "after_work_block" | "after_deep_work";
  endsAt: string;
  minutesRemaining: number;
}

export interface DayState {
  phase: DayPhase;
  currentCommitment?: CommitmentRef;
  nextCommitment?: CommitmentRef;
  timeUntilNext?: number;
  recovery?: RecoveryRef;
}