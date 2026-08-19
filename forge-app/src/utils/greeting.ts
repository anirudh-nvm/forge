export function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "good morning.";
  if (hour < 17) return "good afternoon.";
  return "good evening.";
}

export function getPersonalizedGreeting(name?: string | null): string {
  const timeGreeting = getTimeGreeting();
  const trimmed = name?.trim();
  if (!trimmed) return timeGreeting;
  return `${timeGreeting.replace(".", "")}, ${trimmed}.`;
}