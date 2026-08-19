import type { Clarification, ConversationContract } from "./ConversationContract";

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
    return clarification.question;
  }

  static formatAll(contract: ConversationContract): string[] {
    return contract.clarifications.map(c => c.question);
  }
}