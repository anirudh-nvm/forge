export interface DayExpression {
  daysFromNow: number;
  label: string;
}

const DAY_PATTERNS: { regex: RegExp; daysFromNow: number; label: string }[] = [
  { regex: /(?:the\s+)?day\s+after\s+tomorrow/i, daysFromNow: 2, label: "day after tomorrow" },
  { regex: /tomorrow/i, daysFromNow: 1, label: "tomorrow" },
];

export function detectDayExpression(text: string): DayExpression {
  for (const pattern of DAY_PATTERNS) {
    if (pattern.regex.test(text)) {
      return { daysFromNow: pattern.daysFromNow, label: pattern.label };
    }
  }
  return { daysFromNow: 0, label: "today" };
}

export function isForToday(text: string): boolean {
  return detectDayExpression(text).daysFromNow === 0;
}