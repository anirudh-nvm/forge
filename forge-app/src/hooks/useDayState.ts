import { useState, useEffect, useCallback } from "react";
import { getCurrentDayState } from "../day/DayStateEngine";
import type { DayState } from "../day/DayStateTypes";
import type { TodayPlan } from "../types/todayPlan";

export function useDayState(plan: TodayPlan | null): DayState {
  const [state, setState] = useState<DayState>(() =>
    getCurrentDayState(plan, new Date())
  );

  const updateState = useCallback(() => {
    setState(getCurrentDayState(plan, new Date()));
  }, [plan]);

  useEffect(() => {
    updateState();
  }, [updateState]);

  useEffect(() => {
    if (!plan) return;

    const isActive = state.phase === "active_commitment";
    const intervalMs = isActive ? 1000 : 60_000;

    const id = setInterval(updateState, intervalMs);
    return () => clearInterval(id);
  }, [plan, state.phase, updateState]);

  return state;
}
