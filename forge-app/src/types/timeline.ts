export type TimelineItemKind = "commitment" | "break" | "meal" | "buffer" | "recovery" | "anchor";

export type RecoveryReason = "after_long_fixed" | "after_work_block" | "after_deep_work";

export type TimelineItem = {
  id: string;
  kind: TimelineItemKind;
  title: string;
  startTime: string;
  endTime: string;
  locked: boolean;
  // commitment-only
  completed?: boolean;
  priority?: "high" | "medium" | "low";
  note?: string;
  placementReasons?: string[];
  explanation?: string;
  confidence?: number;
  // recovery-only
  recoveryReason?: RecoveryReason;
  // anchor-only
  anchorType?: "wake" | "breakfast" | "lunch" | "dinner" | "bedtime";
};