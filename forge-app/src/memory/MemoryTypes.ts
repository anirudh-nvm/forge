import type { TimelineEvent } from "../types/events";

export interface TrustSnapshot {
  date: string;
  score: number;
}

export interface MemoryStats {
  totalSessions: number;
  completedCount: number;
  missedCount: number;
  adjustmentCount: number;
}

export interface MemoryWindow {
  startDate: string;
  endDate: string;
  daysCovered: number;
  timeline: TimelineEvent[];
  trustHistory: TrustSnapshot[];
  completedSessions: TimelineEvent[];
  missedSessions: TimelineEvent[];
  adjustments: TimelineEvent[];
  stats: MemoryStats;
}
