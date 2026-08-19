export type CommitmentPriority = "high" | "medium" | "low";

export type PlacementReason =
  | "after_fixed_event"
  | "before_dinner"
  | "preferred_time_window"
  | "afternoon_preference"
  | "morning_preference"
  | "evening_preference"
  | "close_to_existing"
  | "avoiding_early"
  | "avoiding_late"
  | "after_recovery"
  | "before_bedtime"
  | "first_thing"
  | "late_afternoon"
  | "near_related";

export type Commitment = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  completed: boolean;
  locked: boolean;
  priority: CommitmentPriority;
  note?: string;
  placementReasons?: PlacementReason[];
  explanation?: string;
  confidence?: number;
};