import type { StructuredConstraint } from "../types";

type Pattern = {
  regex: RegExp;
  type: StructuredConstraint["type"];
  fixedTarget?: string;
  extractTarget?: (m: RegExpMatchArray) => string;
  tight?: boolean;
};

const PHRASE_TARGETS: Record<string, string> = {
  bed: "Bedtime",
  "bed time": "Bedtime",
  bedtime: "Bedtime",
  sleep: "Bedtime",
  sleeping: "Bedtime",
  "going to bed": "Bedtime",
  "heading to bed": "Bedtime",
  wake: "Wake",
  waking: "Wake",
  "wake up": "Wake",
  "waking up": "Wake",
  awake: "Wake",
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalizeTarget(token: string): string {
  const lower = token.trim().toLowerCase();
  return PHRASE_TARGETS[lower] ?? capitalize(token);
}

const CONSTRAINT_PATTERNS: Pattern[] = [
  // ── phrase-based anchors (multi-word) ──────────────────────────
  {
    regex: /before\s+(?:going\s+to\s+bed|heading\s+to\s+bed|bedtime|bed\s*time|sleeping|sleep|bed)/i,
    type: "before",
    fixedTarget: "Bedtime",
  },
  {
    regex: /(?:until|till)\s+(?:going\s+to\s+bed|bedtime|bed\s*time|sleeping|sleep|bed)/i,
    type: "before",
    fixedTarget: "Bedtime",
  },
  {
    regex: /after\s+(?:waking\s+up|waking|wake\s+up|wake|awake)/i,
    type: "after",
    fixedTarget: "Wake",
  },
  {
    regex: /right\s+after\s+(\S+)/i,
    type: "after",
    extractTarget: m => normalizeTarget(m[1]),
    tight: true,
  },

  // ── generic before/after/until/around with target normalization ─
  {
    regex: /before\s+(?!going\s+to\s+bed|heading\s+to\s+bed)(\S+)/i,
    type: "before",
    extractTarget: m => normalizeTarget(m[1]),
  },
  {
    regex: /after\s+(?!waking\s+up|waking\s+now)(\S+)/i,
    type: "after",
    extractTarget: m => normalizeTarget(m[1]),
  },
  {
    regex: /until\s+(?!going\s+to\s+bed|heading\s+to\s+bed)(\S+)/i,
    type: "before",
    extractTarget: m => normalizeTarget(m[1]),
  },
  {
    regex: /till\s+(?!going\s+to\s+bed|heading\s+to\s+bed)(\S+)/i,
    type: "before",
    extractTarget: m => normalizeTarget(m[1]),
  },
  {
    regex: /around\s+(\S+)/i,
    type: "before",
    extractTarget: m => normalizeTarget(m[1]),
  },

  // ── times of day ───────────────────────────────────────────────
  { regex: /in\s+the\s+morning/i, type: "morning" },
  { regex: /in\s+the\s+afternoon/i, type: "afternoon" },
  { regex: /(?:this|later)\s+evening/i, type: "evening" },
  { regex: /in\s+the\s+(?:evening|night)/i, type: "evening" },
  { regex: /(?:later\s+)?(?:tonight|this\s+night|at\s+night)/i, type: "evening" },
  { regex: /(?:first\s+thing|first\s+thing\s+in\s+the\s+morning|early\s+in\s+the\s+day)/i, type: "first_thing" },
  { regex: /(?:late\s+afternoon|late\s+in\s+the\s+afternoon)/i, type: "late_afternoon" },
  { regex: /(?:anytime|sometime|somewhere)/i, type: "anytime" },
];

export function extractConstraints(text: string): StructuredConstraint[] {
  const constraints: StructuredConstraint[] = [];

  for (const pattern of CONSTRAINT_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      constraints.push({
        type: pattern.type,
        target: pattern.fixedTarget ?? pattern.extractTarget?.(match),
        tight: pattern.tight,
      });
    }
  }

  const seen = new Set<string>();
  const unique = constraints.filter(c => {
    const key = `${c.type}:${c.target ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length === 0) {
    unique.push({ type: "anytime" });
  }

  return unique;
}