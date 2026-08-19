export function parseTimeToDecimal(timeStr: string): number {
  const match = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?/i);
  if (!match) return 0;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3]?.toUpperCase();

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  if (!period && hours < 8) hours += 12;

  return hours + minutes / 60;
}

export function parseTimeToMinutes(timeStr: string): number {
  return Math.round(parseTimeToDecimal(timeStr) * 60);
}

export function formatTime(decimalHours: number): string {
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  const period = hours >= 12 ? "PM" : "AM";
  const h = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return minutes === 0 ? `${h}:00 ${period}` : `${h}:${String(minutes).padStart(2, "0")} ${period}`;
}
