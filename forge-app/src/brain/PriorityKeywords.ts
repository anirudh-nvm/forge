export type PriorityKey =
  | "health"
  | "studies"
  | "work"
  | "finances"
  | "relationships"
  | "building"
  | "promises";

export const PRIORITY_KEYWORDS: Record<string, string[]> = {
  health: ["gym", "run", "walk", "sleep", "recovery", "stretching", "yoga", "exercise"],
  studies: ["study", "dsa", "assignment", "revision", "reading", "class", "exam", "lecture", "homework"],
  work: ["work", "meeting", "email", "project", "standup", "review", "deadline"],
  finances: ["budget", "investing", "freelance", "interview", "finance", "taxes", "expenses"],
  relationships: ["family", "friends", "calls", "partner", "call", "dinner", "hangout"],
  building: ["startup", "coding", "design", "marketing", "meetings", "product", "sprint"],
  promises: ["promise"],
};

export const PRIORITY_CUSTOM = "custom";

export function getAllKeywords(priority: string): string[] {
  const keywords = PRIORITY_KEYWORDS[priority] ?? [];
  return [priority.toLowerCase(), ...keywords];
}

export function getKeywordsForKey(key: string): string[] {
  return getAllKeywords(key);
}