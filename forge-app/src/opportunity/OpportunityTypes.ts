import type { MemoryProfile } from "../memory/MemoryProfile";
import type { TodayPlan } from "../types/todayPlan";
import type { IdentityProgress } from "../identity/IdentityTypes";
import type { Observation } from "../observation/ObservationTypes";

export type OpportunityType =
  | "review"
  | "protect_time"
  | "continue_experiment"
  | "remember_change"
  | "recover"
  | "prepare"
  | "celebrate"
  | "reflect";

export interface Opportunity {
  id: string;
  type: OpportunityType;
  headline: string;
  question: string;
  identityLink: string;
  priority: number;
  source: string;
  createdAt: string;
}

export interface OpportunityContext {
  memory: MemoryProfile;
  todayPlan: TodayPlan;
  identity: IdentityProgress;
  observations: Observation[];
  now: Date;
}
