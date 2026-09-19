import { withJSONInstruction } from "../JSONMode";

export interface PlanCritique {
  issues: CritiqueIssue[];
  overallScore: number;
  summary: string;
}

export interface CritiqueIssue {
  type: "recovery" | "energy" | "balance" | "conflict" | "pacing" | "meal" | "sleep";
  severity: "high" | "medium" | "low";
  description: string;
  suggestion: string;
  affectedCommitments: string[];
}

const CRITIQUE_SCHEMA = `{
  "issues": [
    {
      "type": "recovery",
      "severity": "high",
      "description": "Four mentally demanding blocks back-to-back with no breaks",
      "suggestion": "Add 10-15 minute breaks between study sessions",
      "affectedCommitments": ["CAT Prep", "DSA Practice"]
    }
  ],
  "overallScore": 0.6,
  "summary": "Day is too intense with insufficient recovery between deep work blocks"
}`;

const FEW_SHOT = `
Plan:
- College (9:00 AM – 4:00 PM) [locked]
- CAT Prep (5:00 PM – 7:00 PM)
- Gym (7:30 PM – 8:30 PM)
- DSA Practice (9:00 PM – 10:00 PM)

Critique:
{
  "issues": [
    {
      "type": "recovery",
      "severity": "medium",
      "description": "College to CAT Prep has no real break — just a 1-hour gap",
      "suggestion": "Consider a 15-20 minute wind-down after college before starting CAT",
      "affectedCommitments": ["CAT Prep"]
    },
    {
      "type": "energy",
      "severity": "high",
      "description": "Three mentally demanding tasks after a full day of college",
      "suggestion": "Shorten DSA to 30 minutes or move it to tomorrow — cognitive load is too high",
      "affectedCommitments": ["DSA Practice", "CAT Prep"]
    },
    {
      "type": "pacing",
      "severity": "medium",
      "description": "Gym at 7:30 PM after two study blocks may result in low motivation",
      "suggestion": "If gym is important, consider placing it after college when energy is higher",
      "affectedCommitments": ["Gym"]
    }
  ],
  "overallScore": 0.55,
  "summary": "Day has three demanding blocks after a full college day. Recovery gaps are too short. Consider shortening evening study or moving gym earlier."
}

Plan:
- Wake (7:30 AM)
- Gym (8:00 AM – 9:00 AM)
- College (9:30 AM – 4:30 PM) [locked]
- Lunch (1:00 PM – 2:00 PM)
- CAT Prep (5:00 PM – 7:00 PM)
- Dinner (8:00 PM – 9:00 PM)
- Reading (9:30 PM – 10:00 PM)

Critique:
{
  "issues": [
    {
      "type": "pacing",
      "severity": "low",
      "description": "Reading after dinner is a nice wind-down — well placed",
      "suggestion": "No change needed",
      "affectedCommitments": ["Reading"]
    }
  ],
  "overallScore": 0.88,
  "summary": "Well-balanced day. Gym morning, college midday, focused study after, gentle evening. Good recovery between blocks."
}`;

export const PLAN_CRITIQUE_PROMPT = withJSONInstruction(`You are Forge's Plan Critique Engine.

Your ONLY job: review a day plan and find problems.

You are NOT a scheduler. You do NOT rebuild the plan.
You only IDENTIFY issues and SUGGEST improvements.

Valid issue types:
- recovery  -> missing breaks between demanding blocks
- energy    -> too many high-energy tasks stacked together
- balance   -> day is heavily skewed (all morning or all evening)
- conflict  -> tasks overlap or are too close together
- pacing    -> wrong activity at wrong energy level
- meal      -> meals skipped or poorly timed
- sleep     -> not enough wind-down before bed, or too late

Severity:
- high   -> will likely cause burnout, missed commitment, or user frustration
- medium -> suboptimal but manageable
- low    -> minor improvement possible

Rules:
1. Be specific. Name the commitments involved.
2. Give actionable suggestions ("shorten X to 30 min", "add a 10-min break").
3. Consider the user's energy curve: high in morning, drops after lunch, low at night.
4. Locked commitments are fixed — work around them.
5. A score of 0.8+ means the plan is solid. Below 0.6 needs rebuilding.
6. If the plan is good, say so. Don't invent problems.
7. Output one JSON object. Nothing else.`);

export function buildPlanCritiquePrompt(
  plan: string,
  context?: { lifeSeason?: string; priorities?: string[]; identity?: string; goals?: string[]; timePreferences?: string; behavioralPatterns?: string }
): string {
  const contextParts: string[] = [];
  if (context?.identity) contextParts.push(`Identity: ${context.identity}`);
  if (context?.goals?.length) contextParts.push(`Goals: ${context.goals.join(", ")}`);
  if (context?.lifeSeason) contextParts.push(`Life season: ${context.lifeSeason}`);
  if (context?.priorities?.length) contextParts.push(`Priorities: ${context.priorities.join(", ")}`);
  if (context?.timePreferences) contextParts.push(`Time preferences: ${context.timePreferences}`);
  if (context?.behavioralPatterns) contextParts.push(`Patterns: ${context.behavioralPatterns}`);

  const contextStr = contextParts.length > 0
    ? `\nUSER CONTEXT:\n${contextParts.join("\n")}\n`
    : '';

  return `${PLAN_CRITIQUE_PROMPT}${contextStr}\n${FEW_SHOT}\n\nPlan:\n${plan}\n\nCritique:`;
}
