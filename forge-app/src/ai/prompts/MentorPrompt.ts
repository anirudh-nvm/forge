import type { MentorV2Context } from "../../mentor/MentorTypes";

export interface MentorPromptResult {
  system: string;
  user: string;
}

const MENTOR_SYSTEM_PROMPT = `You are Forge, a thoughtful second brain. You help users understand their patterns and make informed decisions about their time.

You have access to:
- The user's identity (who they're trying to become)
- Their current context (what's happening right now)
- Their memory (what's been learned about them)
- Their observations (patterns detected)
- Their experiments (what's being tested)
- Opportunities (things worth considering)
- Their planning history (what time windows work best)

Rules:
- Always connect suggestions to identity. Instead of "Study CAT", say "One focused CAT session moves you closer to interview-ready."
- Never guilt. Say "I noticed..." not "You failed..."
- Never diagnose. Say "Most skips happened after 8 PM" not "You're lazy."
- Never command. Ask "Would you like..." not "You should..."
- Reference specific data. Say "3 of your last 5 sessions succeeded" not "you've been doing well."
- Respect autonomy. Forge proposes, the user decides.
- Keep responses concise: 2-4 sentences max.
- Return exactly 4 fields as JSON: observation, hypothesis, experiment, encouragement.`;

export function buildMentorPrompt(ctx: MentorV2Context): MentorPromptResult {
  const sections: string[] = [];

  sections.push(`Identity: ${ctx.identity.lifeDirectionTitle}`);
  if (ctx.identity.values.length > 0) {
    sections.push(`Values: ${ctx.identity.values.join(", ")}`);
  }
  if (ctx.identity.priorities.length > 0) {
    sections.push(`Priorities: ${ctx.identity.priorities.join(", ")}`);
  }

  sections.push("");
  if (ctx.context.currentSession) {
    sections.push(`Currently in: ${ctx.context.currentSession}`);
  }
  if (ctx.context.upcomingCommitments.length > 0) {
    sections.push(`Upcoming: ${ctx.context.upcomingCommitments.join(", ")}`);
  }
  sections.push(`Today: ${ctx.context.todayProgress}`);

  if (ctx.memory.insights.insights.length > 0) {
    sections.push(
      `\nPatterns:\n${ctx.memory.insights.insights
        .map((i) => `- [${i.severity}] ${i.text}`)
        .join("\n")}`
    );
  }

  if (ctx.memory.observations && ctx.memory.observations.length > 0) {
    sections.push(
      `\nObservations:\n${ctx.memory.observations
        .map((o) => `- [${o.category}] ${o.text} (${Math.round(o.confidence * 100)}%)`)
        .join("\n")}`
    );
  }

  if (ctx.opportunities && ctx.opportunities.length > 0) {
    sections.push(`\nOpportunities:`);
    for (const opp of ctx.opportunities) {
      sections.push(`- ${opp.headline}`);
      sections.push(`  ${opp.question}`);
      sections.push(`  (${opp.identityLink})`);
    }
  }

  if (ctx.planningMemory) {
    sections.push(
      `\nPlanning memory: ${ctx.planningMemory.preferredTime} works ${Math.round(
        ctx.planningMemory.successRate * 100
      )}% of the time. Trend: ${ctx.planningMemory.trend}.`
    );
  }

  sections.push(
    "\nRespond as Forge — a thoughtful second brain. Connect everything to identity. Return exactly 4 fields as JSON: observation, hypothesis, experiment, encouragement."
  );

  return {
    system: MENTOR_SYSTEM_PROMPT,
    user: sections.join("\n\n"),
  };
}