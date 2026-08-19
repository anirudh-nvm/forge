export interface MentorResponse {
  observation: string;
  hypothesis: string;
  experiment: string;
  encouragement: string;
}

export interface Insight {
  category: "completion" | "time" | "trust" | "adjustment" | "consistency";
  text: string;
  severity: "low" | "medium" | "high";
}

export interface InsightReport {
  generatedAt: string;
  windowDays: number;
  insights: Insight[];
}

export interface ReflectionContext {
  insights: InsightReport;
  observations?: { text: string; category: string; confidence: number }[];
  stableMemory?: { values: string[]; priorities: string[]; lifeSeason: string; rhythm: { preferredWakeTime: string; preferredSleepTime: string; studyPreference: string } };
  workingMemory?: { activeGoals: string[]; activeFocus: string[] };
  experiments?: { title: string; hypothesis: string; status: string }[];
  trustContext?: { score: number; level: string; trajectory: string };
  recentReflections?: { observationText: string; userExplanation: string }[];
}

export interface MentorV2Context {
  identity: {
    lifeDirectionTitle: string;
    values: string[];
    priorities: string[];
  };
  context: {
    currentSession: string | null;
    upcomingCommitments: string[];
    todayProgress: string;
  };
  memory: ReflectionContext;
  opportunities?: {
    headline: string;
    question: string;
    identityLink: string;
  }[];
  planningMemory?: {
    preferredTime: string;
    successRate: number;
    trend: string;
  };
}
