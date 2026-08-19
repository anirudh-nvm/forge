export interface EventDefaults {
  defaultStartHour: number;
  defaultDurationMinutes: number;
}

export const DEFAULT_EVENTS: Record<string, EventDefaults> = {
  College: { defaultStartHour: 9, defaultDurationMinutes: 8 * 60 },
  Office: { defaultStartHour: 9, defaultDurationMinutes: 8 * 60 },
  Gym: { defaultStartHour: 17, defaultDurationMinutes: 60 },
  "DSA Practice": { defaultStartHour: 17, defaultDurationMinutes: 90 },
  Meeting: { defaultStartHour: 10, defaultDurationMinutes: 60 },
  Dentist: { defaultStartHour: 10, defaultDurationMinutes: 60 },
  Assignment: { defaultStartHour: 18, defaultDurationMinutes: 120 },
  Laundry: { defaultStartHour: 18, defaultDurationMinutes: 60 },
  Shopping: { defaultStartHour: 18, defaultDurationMinutes: 60 },
  Dinner: { defaultStartHour: 19, defaultDurationMinutes: 60 },
  Breakfast: { defaultStartHour: 8, defaultDurationMinutes: 30 },
  Lunch: { defaultStartHour: 13, defaultDurationMinutes: 60 },
};

export function getDefaults(entity: string): EventDefaults | null {
  return DEFAULT_EVENTS[entity] ?? null;
}
