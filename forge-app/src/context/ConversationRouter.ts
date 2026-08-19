import type { RelevantContext } from "./ContextEngine";

export type ConversationReason =
  | "daily_planning"
  | "reflection"
  | "adjustment"
  | "general_chat"
  | "opportunity"
  | "identity"
  | "session_start"
  | "session_end";

export interface RouterDecision {
  reason: ConversationReason;
  confidence: number;
  context: string;
}

function detectReason(input: string, context: RelevantContext): RouterDecision {
  const lower = input.toLowerCase();

  if (
    lower.includes("plan") ||
    lower.includes("today") ||
    lower.includes("schedule") ||
    lower.includes("morning") ||
    lower.includes("afternoon")
  ) {
    return {
      reason: "daily_planning",
      confidence: 0.8,
      context: "User is asking about planning or scheduling",
    };
  }

  if (
    lower.includes("reflect") ||
    lower.includes("notice") ||
    lower.includes("pattern") ||
    lower.includes("think about")
  ) {
    return {
      reason: "reflection",
      confidence: 0.8,
      context: "User wants to reflect on patterns",
    };
  }

  if (
    lower.includes("adjust") ||
    lower.includes("change") ||
    lower.includes("move") ||
    lower.includes("reschedule") ||
    lower.includes("shift")
  ) {
    return {
      reason: "adjustment",
      confidence: 0.8,
      context: "User wants to adjust the plan",
    };
  }

  if (
    lower.includes("who") ||
    lower.includes("become") ||
    lower.includes("direction") ||
    lower.includes("goal") ||
    lower.includes("identity")
  ) {
    return {
      reason: "identity",
      confidence: 0.7,
      context: "User is asking about identity or direction",
    };
  }

  if (context.currentSession.activeCommitment) {
    return {
      reason: "session_start",
      confidence: 0.6,
      context: `User is in active session: ${context.currentSession.activeCommitment.title}`,
    };
  }

  if (
    lower.includes("help") ||
    lower.includes("stuck") ||
    lower.includes("can't") ||
    lower.includes("hard")
  ) {
    return {
      reason: "adjustment",
      confidence: 0.6,
      context: "User seems stuck or needs help",
    };
  }

  return {
    reason: "general_chat",
    confidence: 0.4,
    context: "General conversation — no specific trigger detected",
  };
}

export function routeConversation(
  input: string,
  context: RelevantContext
): RouterDecision {
  return detectReason(input, context);
}
