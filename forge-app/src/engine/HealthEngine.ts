import AppleHealth, { HealthKitQuery } from "apple-health";

export type StepData = {
  date: string;
  steps: number;
};

export type SleepData = {
  date: string;
  inBed: number;
  core: number;
  deep: number;
  rem: number;
  totalMinutes: number;
};

export type WorkoutData = {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  durationMinutes: number;
  calories?: number;
  distanceMeters?: number;
};

export type DailyHealth = {
  steps: number;
  sleep: SleepData | null;
  workouts: WorkoutData[];
  restingHeartRate?: number;
};

export async function requestPermission(): Promise<boolean> {
  try {
    const result = await AppleHealth.requestAuthorization({
      read: [
        "stepCount",
        "heartRate",
        "restingHeartRate",
        "sleepAnalysis",
        "activeEnergyBurned",
        "appleExerciseTime",
      ],
      write: ["activeEnergyBurned"],
    });
    return result.status === "sharingAuthorized";
  } catch {
    return false;
  }
}

export async function isAvailable(): Promise<boolean> {
  try {
    return AppleHealth.isAvailable();
  } catch {
    return false;
  }
}

export async function getTodaySteps(): Promise<number> {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const stats = await new HealthKitQuery()
      .type("stepCount", "statistics")
      .dateRange(startOfDay, today)
      .aggregations(["cumulativeSum"])
      .executeStatistics();

    const result = Array.isArray(stats) ? stats[0] : stats;
    return result?.sumQuantity ?? 0;
  } catch {
    return 0;
  }
}

export async function getWeekSteps(): Promise<StepData[]> {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);

    const results = await new HealthKitQuery()
      .type("stepCount", "statistics")
      .dateRange(startOfWeek, now)
      .aggregations(["cumulativeSum"])
      .interval("day")
      .executeStatistics();

    const items = Array.isArray(results) ? results : [results];

    return items.map((r) => ({
      date: r.startDate.split("T")[0],
      steps: r.sumQuantity ?? 0,
    }));
  } catch {
    return [];
  }
}

export async function getLastNightSleep(): Promise<SleepData | null> {
  try {
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);

    const samples = await new HealthKitQuery()
      .type("sleepAnalysis", "category")
      .dateRange(yesterday, today)
      .limit(20)
      .execute();

    if (samples.length === 0) return null;

    let inBed = 0;
    let core = 0;
    let deep = 0;
    let rem = 0;

    for (const s of samples) {
      const start = new Date(s.startDate).getTime();
      const end = new Date(s.endDate).getTime();
      const minutes = (end - start) / (1000 * 60);
      const value = (s as unknown as { value: number }).value;

      if (value === 0) inBed += minutes;
      else if (value === 3) core += minutes;
      else if (value === 4) deep += minutes;
      else if (value === 5) rem += minutes;
    }

    return {
      date: yesterday.toISOString().split("T")[0],
      inBed: Math.round(inBed),
      core: Math.round(core),
      deep: Math.round(deep),
      rem: Math.round(rem),
      totalMinutes: Math.round(inBed),
    };
  } catch {
    return null;
  }
}

export async function getTodayWorkouts(): Promise<WorkoutData[]> {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const samples = await new HealthKitQuery()
      .type("workout", "workout")
      .dateRange(startOfDay, today)
      .execute();

    return samples.map((s) => {
      const raw = s as unknown as {
        uuid: string;
        workoutActivityType: string;
        startDate: string;
        endDate: string;
        duration: number;
        totalEnergyBurned?: number;
        totalDistance?: number;
      };
      return {
        id: raw.uuid,
        type: raw.workoutActivityType,
        startDate: raw.startDate,
        endDate: raw.endDate,
        durationMinutes: Math.round(raw.duration / 60),
        calories: raw.totalEnergyBurned,
        distanceMeters: raw.totalDistance,
      };
    });
  } catch {
    return [];
  }
}

export async function getRestingHeartRate(): Promise<number | undefined> {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);

    const samples = await new HealthKitQuery()
      .type("restingHeartRate", "quantity")
      .dateRange(weekAgo, now)
      .limit(1)
      .ascending(false)
      .execute();

    if (samples.length > 0) {
      const raw = samples[0] as unknown as { value: number };
      return Math.round(raw.value);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function getDailyHealth(): Promise<DailyHealth> {
  const [steps, sleep, workouts, restingHR] = await Promise.all([
    getTodaySteps(),
    getLastNightSleep(),
    getTodayWorkouts(),
    getRestingHeartRate(),
  ]);

  return {
    steps,
    sleep,
    workouts,
    restingHeartRate: restingHR,
  };
}

export type EnergyLevel = "high" | "normal" | "low" | "recovering";

export function inferEnergy(health: DailyHealth | null): EnergyLevel {
  if (!health) return "normal";

  const sleepHours = health.sleep ? health.sleep.totalMinutes / 60 : null;

  if (sleepHours !== null && sleepHours < 5) return "low";
  if (sleepHours !== null && sleepHours < 6.5) return "recovering";

  if (health.restingHeartRate && health.restingHeartRate > 90) return "low";

  if (health.steps > 8000) return "high";
  if (health.steps > 4000) return "normal";

  return "normal";
}
