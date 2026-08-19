import type { InsightReport, ReflectionContext, MentorV2Context } from "./MentorTypes";

const SYSTEM_PROMPT_V1 = `You are Forge, a thoughtful reflection engine. You help users understand their patterns without judgment.

Rules:
- Never guilt. Instead of "You failed", say "I noticed..."
- Never diagnose. Instead of "You're lazy", say "Most skipped commitments happened after 8 PM."
- Never overstate certainty. Instead of "You work best in mornings", say "Over the last seven days you've completed more morning commitments than evening ones."
- Suggest experiments, never commands. Instead of "Wake up at 5", say "Would you like to try protecting one important task before lunch this week?"
- Celebrate consistency, not perfection.
- Respect autonomy. Forge proposes, the user chooses.
- Keep responses concise: 2-4 sentences max.
- Return exactly 4 fields as JSON: observation, hypothesis, experiment, encouragement.

When you have observations and memory available, reference them specifically — not generically.`;

const SYSTEM_PROMPT_V2 = `You are Forge, a thoughtful second brain. You help users understand their patterns and make informed decisions about their time.

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

function formatInsights(insights: InsightReport): string {
  const lines: string[] = [];
  lines.push(`Time window: ${insights.windowDays} days`);
  lines.push("");
  for (const insight of insights.insights) {
    lines.push(`- [${insight.severity}] ${insight.text}`);
  }
  return lines.join("\n");
}

function formatObservations(
  observations: { text: string; category: string; confidence: number }[]
): string {
  return observations
    .map((obs) => `- [${obs.category}] ${obs.text} (${Math.round(obs.confidence * 100)}%)`)
    .join("\n");
}

function formatMemoryContext(ctx: ReflectionContext): string {
  const lines: string[] = [];
  if (ctx.stableMemory) {
    const { values, priorities, lifeSeason, rhythm } = ctx.stableMemory;
    if (values.length > 0) lines.push(`Values: ${values.join(", ")}`);
    if (priorities.length > 0) lines.push(`Priorities: ${priorities.join(", ")}`);
    if (lifeSeason) lines.push(`Life season: ${lifeSeason}`);
    if (rhythm) lines.push(`Study preference: ${rhythm.studyPreference}`);
  }
  if (ctx.workingMemory) {
    const { activeGoals, activeFocus } = ctx.workingMemory;
    if (activeGoals.length > 0) lines.push(`Active goals: ${activeGoals.join(", ")}`);
    if (activeFocus.length > 0) lines.push(`Current focus: ${activeFocus.join(", ")}`);
  }
  return lines.join("\n");
}

function formatExperiments(
  experiments: { title: string; hypothesis: string; status: string }[]
): string {
  return experiments
    .map((exp) => `- "${exp.title}" (${exp.status}): ${exp.hypothesis}`)
    .join("\n");
}

function formatTrustContext(
  trust: { score: number; level: string; trajectory: string }
): string {
  return `Trust: ${trust.score}/100 (${trust.level}). Trajectory: ${trust.trajectory}.`;
}

function formatRecentReflections(
  reflections: { observationText: string; userExplanation: string }[]
): string {
  return reflections
    .map(
      (ref) =>
        `- Observation: "${ref.observationText}"\n  Your explanation: "${ref.userExplanation}"`
    )
    .join("\n");
}

function buildUserPrompt(ctx: ReflectionContext): string {
  const sections: string[] = [];
  sections.push(formatInsights(ctx.insights));
  if (ctx.observations && ctx.observations.length > 0) {
    sections.push(`\nRecent observations:\n${formatObservations(ctx.observations)}`);
  }
  const memorySection = formatMemoryContext(ctx);
  if (memorySection) {
    sections.push(`\nUser context:\n${memorySection}`);
  }
  if (ctx.experiments && ctx.experiments.length > 0) {
    sections.push(`\nActive experiments:\n${formatExperiments(ctx.experiments)}`);
  }
  if (ctx.trustContext) {
    sections.push(`\n${formatTrustContext(ctx.trustContext)}`);
  }
  if (ctx.recentReflections && ctx.recentReflections.length > 0) {
    sections.push(`\nRecent reflections:\n${formatRecentReflections(ctx.recentReflections)}`);
  }
  sections.push(
    "\nprovide a brief, thoughtful reflection. return exactly 4 fields as json: observation, hypothesis, experiment, encouragement."
  );
  return sections.join("\n\n");
}

function buildV2IdentitySection(ctx: MentorV2Context): string {
  const lines: string[] = [];
  lines.push(`Identity: ${ctx.identity.lifeDirectionTitle}`);
  if (ctx.identity.values.length > 0) {
    lines.push(`Values: ${ctx.identity.values.join(", ")}`);
  }
  return lines.join("\n");
}

function buildV2ContextSection(ctx: MentorV2Context): string {
  const lines: string[] = [];
  if (ctx.context.currentSession) {
    lines.push(`Currently in: ${ctx.context.currentSession}`);
  }
  if (ctx.context.upcomingCommitments.length > 0) {
    lines.push(`Upcoming: ${ctx.context.upcomingCommitments.join(", ")}`);
  }
  lines.push(`Today: ${ctx.context.todayProgress}`);
  return lines.join("\n");
}

function buildV2OpportunitiesSection(
  opps: { headline: string; question: string; identityLink: string }[]
): string {
  const lines: string[] = [];
  for (const opp of opps) {
    lines.push(`- ${opp.headline}`);
    lines.push(`  ${opp.question}`);
    lines.push(`  (${opp.identityLink})`);
  }
  return lines.join("\n");
}

function buildV2UserPrompt(ctx: MentorV2Context): string {
  const sections: string[] = [];

  sections.push(buildV2IdentitySection(ctx));
  sections.push(buildV2ContextSection(ctx));

  if (ctx.memory.insights.insights.length > 0) {
    sections.push(`\nPatterns:\n${formatInsights(ctx.memory.insights)}`);
  }

  if (ctx.memory.observations && ctx.memory.observations.length > 0) {
    sections.push(`\nObservations:\n${formatObservations(ctx.memory.observations)}`);
  }

  if (ctx.memory.experiments && ctx.memory.experiments.length > 0) {
    sections.push(`\nExperiments:\n${formatExperiments(ctx.memory.experiments)}`);
  }

  if (ctx.memory.trustContext) {
    sections.push(`\n${formatTrustContext(ctx.memory.trustContext)}`);
  }

  if (ctx.opportunities && ctx.opportunities.length > 0) {
    sections.push(`\nOpportunities:\n${buildV2OpportunitiesSection(ctx.opportunities)}`);
  }

  if (ctx.planningMemory) {
    sections.push(
      `\nPlanning memory: ${ctx.planningMemory.preferredTime} works ${Math.round(ctx.planningMemory.successRate * 100)}% of the time. Trend: ${ctx.planningMemory.trend}.`
    );
  }

  sections.push(
    "\nRespond as Forge — a thoughtful second brain. Connect everything to identity. Return exactly 4 fields as JSON: observation, hypothesis, experiment, encouragement."
  );

  return sections.join("\n\n");
}

export function buildPrompt(ctx: ReflectionContext): { system: string; user: string } {
  return { system: SYSTEM_PROMPT_V1, user: buildUserPrompt(ctx) };
}

export function buildPromptV2(ctx: MentorV2Context): { system: string; user: string } {
  return { system: SYSTEM_PROMPT_V2, user: buildV2UserPrompt(ctx) };
}
