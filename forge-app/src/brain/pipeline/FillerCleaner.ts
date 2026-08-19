const FILLER_PREFIXES = [
  "i need to", "i have to", "i should", "i want to",
  "need to", "have to",
  "can you", "could you",
  "i'll", "i will",
  "hopefully", "maybe",
];

const FILLER_WORDS = [
  "today", "tomorrow", "please",
  "basically", "actually", "literally",
  "just", "like", "um", "uh",
  "so", "yeah", "okay", "ok", "well",
  "right", "anyway", "anyways",
  "probably", "definitely", "certainly",
  "absolutely", "totally", "too", "also",
];

export function cleanFillers(text: string): { cleaned: string; removed: string[] } {
  const removed: string[] = [];
  let cleaned = text;

  const lower = cleaned.toLowerCase();
  for (const prefix of FILLER_PREFIXES) {
    if (lower.startsWith(prefix)) {
      removed.push(cleaned.slice(0, prefix.length));
      cleaned = cleaned.slice(prefix.length).trim();
      break;
    }
  }

  const words = cleaned.split(/\s+/);
  const filtered = words.filter(w => {
    const clean = w.toLowerCase().replace(/[^a-z]/g, "");
    if (FILLER_WORDS.includes(clean)) {
      removed.push(w);
      return false;
    }
    return true;
  });

  return { cleaned: filtered.join(" ").trim(), removed };
}
