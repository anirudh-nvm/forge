import type { ReflectionContext } from "../../mentor/MentorTypes";

export interface ReflectionPromptResult {
  system: string;
  user: string;
}

const REFLECTION_SYSTEM_PROMPT = `You are Forge, a thoughtful reflection engine. You help users understand their patterns without judgment.

Rules:
- Never guilt. Instead of "You failed", say "I noticed..."
- Never diagnose. Instead of "You're lazy", say "Most skipped commitments happened after 8 PM."
- Never overstate certainty. Instead of "You work best in mornings", say "Over the last seven days you've completed more morning commitments than evening ones."
- Suggest experiments, never commands. Instead of "Wake up at 5", say "Would you like to try protecting one important task before lunch this week?"
- Celebrate consistency, not perfection.
- Respect autonomy. Forge proposes, the user chooses.
- Keep responses concise: 2-4 sentences max.
- Return exactly 4 fields as JSON: observation, hypothesis, experiment, encouragement.`;

function formatInsightSection(ctx: ReflectionContext): string {
  const lines: string[] = [`Time window: ${ctx.insights.windowDays} days`, ""];
  for (const insight of ctx.insights.insights) {
    lines.push(`- [${insight.severity}] ${insight.text}`);
  }
  return lines.join("\n");
}

function formatMemorySection(ctx: ReflectionContext): string {
  const lines: string[] = [];
  const stable = ctx.stableMemory;
  if (stable) {
    if (stable.values.length > 0) lines.push(`Values: ${stable.values.join(", ")}`);
    if (stable.priorities.length > 0) lines.push(`Priorities: ${stable.priorities.join(", ")}`);
    if (stable.lifeSeason) lines.push(`Life season: ${stable.lifeSeason}`);
  }
  const working = ctx.workingMemory;
  if (working) {
    if (working.activeGoals.length > 0) lines.push(`Active goals: ${working.activeGoals.join(", ")}`);
    if (working.activeFocus.length > 0) lines.push(`Current focus: ${working.activeFocus.join(", ")}`);
  }
  return lines.join("\n");
}

export function buildReflectionPrompt(ctx: ReflectionContext): ReflectionPromptResult {
  const sections: string[] = [];
  sections.push(formatInsightSection(ctx));

  if (ctx.observations && ctx.observations.length > 0) {
    sections.push(
      `\nRecent observations:\n${ctx.observations
        .map((o) => `- [${o.category}] ${o.text} (${Math.round(o.confidence * 100)}%)`)
        .join("\n")}`
    );
  }

  const memory = formatMemorySection(ctx);
  if (memory) sections.push(`\nUser context:\n${memory}`);

  sections.push(
    "\nprovide a brief, thoughtful reflection. return exactly 4 fields as json: observation, hypothesis, experiment, encouragement."
  );

  return {
    system: REFLECTION_SYSTEM_PROMPT,
    user: sections.join("\n\n"),
  };
}