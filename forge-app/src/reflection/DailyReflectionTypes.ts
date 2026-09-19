export interface DailyReflection {
  id: string;
  date: string;
  completionRate: number;
  completedCount: number;
  totalCount: number;
  plannedMinutes: number;
  actualMinutes: number;
  skippedTitles: string[];
  completedTitles: string[];
  aiSummary: string;
  userResponse?: string;
  aiFollowUp?: string;
  savedAt: string;
}

export interface DaySummaryInput {
  date: string;
  commitments: {
    title: string;
    startTime: string;
    endTime: string;
    completed: boolean;
  }[];
}
