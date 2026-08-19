import type {
  ReflectionPrompt,
  ReflectionSession,
  ReflectionReason,
} from "./ReflectionTypes";
import type { Observation, ObservationCategory } from "../observation/ObservationTypes";

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildQuestion(observation: Observation): ReflectionPrompt {
  const question = generateQuestion(observation.category, observation.text);
  const context = generateContext(observation);

  return {
    observationId: observation.id,
    category: observation.category,
    observationText: observation.text,
    question,
    context,
  };
}

function generateQuestion(category: ObservationCategory, text: string): string {
  switch (category) {
    case "consistency":
      return `${text} Does that feel accurate?`;
    case "timing":
      return `${text} Is that how you'd describe your schedule?`;
    case "energy":
      return `${text} What do you think contributed to that?`;
    case "capacity":
      return `${text} How are you feeling about your workload?`;
    case "identity":
      return `${text} Does that alignment feel right to you?`;
    case "rhythm":
      return `${text} How are you feeling about that pattern?`;
    default:
      return `${text} What do you think?`;
  }
}

function generateContext(observation: Observation): string {
  const sampleSize = observation.metadata?.sampleSize ?? observation.supportingEvents.length;
  const trend = observation.metadata?.trendDirection;
  const parts: string[] = [];

  if (sampleSize > 0) {
    parts.push(`Based on ${sampleSize} data point${sampleSize !== 1 ? "s" : ""}`);
  }

  if (trend) {
    parts.push(`trend: ${trend}`);
  }

  if (observation.confidence > 0.8) {
    parts.push("high confidence");
  } else if (observation.confidence < 0.5) {
    parts.push("still building confidence");
  }

  return parts.join(". ") || "Based on recent activity";
}

function buildConversationalPrompt(observation: Observation): ReflectionPrompt {
  const text = observation.text.toLowerCase();
  let question = "";
  let context = "";

  if (observation.category === "timing" && observation.metadata?.trendDirection === "up") {
    const title = observation.metadata?.commitmentTitle || "this";
    question = `You've been consistent with ${title}. Does that feel like something you want to keep?`;
    context = observation.metadata?.sampleSize
      ? `Based on ${observation.metadata.sampleSize} sessions`
      : "";
  } else if (observation.category === "timing" && observation.metadata?.trendDirection === "down") {
    const title = observation.metadata?.commitmentTitle || "this";
    question = `${title} has been slipping lately. What's getting in the way?`;
    context = "I noticed a downward trend";
  } else if (observation.category === "energy") {
    question = `${observation.text} What do you think is driving that?`;
    context = "Understanding your energy patterns helps us plan better";
  } else if (observation.category === "rhythm") {
    question = `${observation.text} Is that a pattern you want to protect?`;
    context = "Rhythm patterns emerge over time";
  } else if (observation.category === "identity") {
    question = `${observation.text} Does that feel like the direction you want to go?`;
    context = "This connects to who you're trying to become";
  } else {
    question = `${observation.text} What's your take on that?`;
  }

  return {
    observationId: observation.id,
    category: observation.category,
    observationText: observation.text,
    question,
    context,
  };
}

export function startReflection(
  observations: Observation[],
  reason: ReflectionReason = "pattern_detected"
): ReflectionSession | null {
  const actionable = observations.filter(
    (o) => o.status === "new" && o.confidence > 0.5
  );

  if (actionable.length === 0) return null;

  const sorted = [...actionable].sort((a, b) => b.confidence - a.confidence);
  const top = sorted[0];

  const prompt = buildConversationalPrompt(top);

  return {
    id: generateId("refl"),
    date: new Date().toISOString().split("T")[0],
    reason,
    stage: "observation",
    turns: [{ prompt }],
  };
}

export function addResponse(
  session: ReflectionSession,
  promptId: string,
  userExplanation: string
): ReflectionSession {
  const turns = session.turns.map((turn) =>
    turn.prompt.observationId === promptId
      ? { ...turn, response: { promptId, userExplanation, timestamp: new Date().toISOString() } }
      : turn
  );

  return {
    ...session,
    turns,
    stage: "explanation",
  };
}

export function completeReflection(
  session: ReflectionSession,
  summary?: string
): ReflectionSession {
  return {
    ...session,
    stage: "summary",
    summary: summary ?? buildSummary(session),
    completedAt: new Date().toISOString(),
  };
}

function buildSummary(session: ReflectionSession): string {
  const explanations = session.turns
    .filter((t) => t.response)
    .map((t) => t.response!.userExplanation);

  if (explanations.length === 0) return "No explanations provided.";

  return explanations.join(". ");
}
