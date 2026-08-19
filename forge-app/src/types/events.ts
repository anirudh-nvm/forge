export type EngineName = "Scheduler" | "Adjustment" | "Promise" | "Trust" | "Lifecycle" | "Brain";

export type EngineEvent = {
  timestamp: Date;
  engine: EngineName;
  action: string;
  metadata?: Record<string, unknown>;
};

export type TimelineEvent = {
  id: string;
  timestamp: Date;
  type: "planCreated" | "movedEarlier" | "movedLater" | "deleted" | "added" | "durationUpdated" | "locked" | "unlocked" | "completed" | "started" | "skipped";
  commitmentId?: string;
  title: string;
  details?: string;
};
