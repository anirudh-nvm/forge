export interface TimeResult {
  startTime?: string;
  endTime?: string;
  approximate?: boolean;
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, noon: 12, midnight: 0,
};

function wordToNumber(word: string): number | null {
  const lower = word.toLowerCase();
  if (lower in WORD_NUMBERS) return WORD_NUMBERS[lower];
  if (/^\d{1,2}$/.test(lower)) return parseInt(lower, 10);
  return null;
}

function formatHour(h: number, period?: string): string {
  const p = period?.toUpperCase();
  if (p === "AM" || p === "PM") return `${h}:00 ${p}`;
  if (h === 12) return "12:00 PM";
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 PM`;
  return `${h}:00 AM`;
}

function parseTimeToken(token: string): { hour: number; period?: string } | null {
  const explicit = token.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?$/);
  if (explicit) {
    const h = parseInt(explicit[1], 10);
    const p = explicit[3]?.toUpperCase();
    return { hour: h, period: p };
  }

  const wordMatch = token.match(/^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|noon|midnight)$/i);
  if (wordMatch) {
    return { hour: wordToNumber(wordMatch[1])! };
  }

  return null;
}

export function extractTimes(text: string): TimeResult {
  const result: TimeResult = {};

  const fromTo = text.match(/(?:from|between)\s+(\S+)\s+(?:to|and|until|till)\s+(\S+)/i);
  if (fromTo) {
    const s = parseTimeToken(fromTo[1]);
    const e = parseTimeToken(fromTo[2]);
    if (s) result.startTime = formatHour(s.hour, s.period);
    if (e) result.endTime = formatHour(e.hour, e.period);
    return result;
  }

  const hyphen = text.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)/i);
  if (hyphen) {
    const s = parseTimeToken(hyphen[1]);
    const e = parseTimeToken(hyphen[2]);
    if (s) result.startTime = formatHour(s.hour, s.period);
    if (e) result.endTime = formatHour(e.hour, e.period);
    return result;
  }

  const until = text.match(/(?:until|till)\s+(?:around\s+)?(\S+)/i);
  if (until) {
    const e = parseTimeToken(until[1]);
    if (e) result.endTime = formatHour(e.hour, e.period);
    return result;
  }

  const around = text.match(/around\s+(\S+)/i);
  if (around) {
    const e = parseTimeToken(around[1]);
    if (e) {
      result.endTime = formatHour(e.hour, e.period);
      result.approximate = true;
    }
    return result;
  }

  const atTime = text.match(/at\s+(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\b/);
  if (atTime) {
    const s = parseTimeToken(atTime[1]);
    if (s) result.startTime = formatHour(s.hour, s.period);
    return result;
  }

  return result;
}
