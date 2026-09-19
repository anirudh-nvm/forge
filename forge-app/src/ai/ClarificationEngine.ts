import type { Clarification, ConversationContract } from "./ConversationContract";

const WARM_PREFIXES = [
  "got it.",
  "nice.",
  "cool.",
  "alright.",
  "sounds good.",
];

const TRANSITION_PHRASES = [
  "just one more thing —",
  "quick question —",
  "one thing —",
  "before I build your plan —",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class ClarificationEngine {
  static needsClarification(contract: ConversationContract): boolean {
    return contract.clarifications.length > 0;
  }

  static pickMostImportant(contract: ConversationContract): Clarification | null {
    if (contract.clarifications.length === 0) return null;

    const priorityOrder = ["day", "time", "entity", "confirmation"];
    return contract.clarifications
      .slice()
      .sort((a, b) => priorityOrder.indexOf(a.expects) - priorityOrder.indexOf(b.expects))[0];
  }

  static formatQuestion(clarification: Clarification): string {
    const prefix = pickRandom(WARM_PREFIXES);
    const transition = pickRandom(TRANSITION_PHRASES);
    return `${prefix} ${transition} ${clarification.question}`;
  }

  static formatAll(contract: ConversationContract): string[] {
    return contract.clarifications.map((c, i) => {
      if (i === 0) return this.formatQuestion(c);
      return c.question;
    });
  }
}