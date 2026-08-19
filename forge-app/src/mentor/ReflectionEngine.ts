import type { InsightReport, MentorResponse, ReflectionContext, MentorV2Context } from "./MentorTypes";
import { buildInsights } from "./InsightBuilder";
import { buildPrompt, buildPromptV2 } from "./PromptBuilder";
import type { PatternReport } from "../memory/PatternTypes";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

function getApiKey(): string | null {
  if (typeof process !== "undefined" && process.env) {
    return process.env.EXPO_PUBLIC_OPENAI_API_KEY || null;
  }
  return null;
}

function parseResponse(text: string): MentorResponse {
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      observation: String(parsed.observation || ""),
      hypothesis: String(parsed.hypothesis || ""),
      experiment: String(parsed.experiment || ""),
      encouragement: String(parsed.encouragement || ""),
    };
  } catch {
    return {
      observation: text.slice(0, 200),
      hypothesis: "",
      experiment: "",
      encouragement: "",
    };
  }
}

function fallbackResponse(insights: InsightReport): MentorResponse {
  const first = insights.insights[0];
  return {
    observation: first ? first.text : "No patterns detected yet.",
    hypothesis: "Keep building consistency to see clearer patterns.",
    experiment: "Try completing one commitment at your preferred time this week.",
    encouragement: "Every small step counts.",
  };
}

export async function generateReflection(
  report: PatternReport,
  context?: Partial<ReflectionContext>
): Promise<MentorResponse> {
  const insights = buildInsights(report);
  const apiKey = getApiKey();

  const reflectionContext: ReflectionContext = {
    insights,
    observations: context?.observations,
    stableMemory: context?.stableMemory,
    workingMemory: context?.workingMemory,
    experiments: context?.experiments,
    trustContext: context?.trustContext,
    recentReflections: context?.recentReflections,
  };

  if (!apiKey) {
    return fallbackResponse(insights);
  }

  const { system, user } = buildPrompt(reflectionContext);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      return fallbackResponse(insights);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    return parseResponse(text);
  } catch {
    return fallbackResponse(insights);
  }
}

export async function generateReflectionV2(
  ctx: MentorV2Context
): Promise<MentorResponse> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      observation: ctx.identity.lifeDirectionTitle
        ? `Working toward: ${ctx.identity.lifeDirectionTitle}`
        : "No patterns detected yet.",
      hypothesis: "Keep building consistency to see clearer patterns.",
      experiment: "Try completing one commitment at your preferred time this week.",
      encouragement: "Every small step counts.",
    };
  }

  const { system, user } = buildPromptV2(ctx);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      return {
        observation: "Having trouble connecting right now.",
        hypothesis: "The API might be temporarily unavailable.",
        experiment: "Try again in a moment.",
        encouragement: "You're still making progress.",
      };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    return parseResponse(text);
  } catch {
    return {
      observation: "Having trouble connecting right now.",
      hypothesis: "Network issue.",
      experiment: "Try again shortly.",
      encouragement: "You're still making progress.",
    };
  }
}
