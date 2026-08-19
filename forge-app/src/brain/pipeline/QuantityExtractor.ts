export interface Quantity {
  value: number;
  unit: string;
  raw: string;
}

const QUANTITY_REGEX = /(\d+)\s+\w*\s*(questions?|chapters?|assignments?|pages?|problems?|tasks?|hours?|minutes?)/gi;

const DURATION_MAP: Record<string, number> = {
  hours: 60,
  minutes: 1,
};

export function extractQuantity(text: string): Quantity | null {
  const match = QUANTITY_REGEX.exec(text);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multiplier = DURATION_MAP[unit] ?? 1;

  return {
    value: value * multiplier,
    unit: multiplier > 1 ? "minutes" : unit,
    raw: match[0],
  };
}
