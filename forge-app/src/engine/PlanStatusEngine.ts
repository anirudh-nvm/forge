import type { TodayPlan, PlanStatus } from "../types/todayPlan";

export function transitionPlanStatus(plan: TodayPlan, next: PlanStatus): TodayPlan {
  if (plan.status === next) return plan;

  return {
    ...plan,
    status: next,
  };
}

export function promoteToActive(plan: TodayPlan): TodayPlan {
  if (plan.status !== "draft") return plan;
  return transitionPlanStatus(plan, "active");
}

export function completePlan(plan: TodayPlan): TodayPlan {
  if (plan.status !== "active") return plan;
  return transitionPlanStatus(plan, "completed");
}

export function archivePlan(plan: TodayPlan): TodayPlan {
  if (plan.status !== "completed") return plan;
  return transitionPlanStatus(plan, "archived");
}
