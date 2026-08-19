import type { ConversationContract } from "./ConversationContract";
import { validateContract, type ValidatedAnalysis } from "./Validation";
import { buildMemoryContext, buildConversationEngineContext } from "./MemoryContext";

export interface ConversationEngineContext {
  lifeSeason: string;
  priorities: string[];
  currentDate: string;
  existingTimetable: string[];
}

export class ConversationEngine {
  static async understandConversation(
    input: string,
    context?: Partial<ConversationEngineContext>
  ): Promise<ConversationContract> {
    const memory = await buildMemoryContext();
    const fullContext = buildConversationEngineContext(memory);
    
    if (context) {
      Object.assign(fullContext, context);
    }

    // TODO: Call LLM with buildPrompt(input, fullContext)
    // For now, throw to use deterministic fallback
    throw new Error("LLM integration not yet implemented. Use deterministic pipeline for now.");
  }

  static async validateContract(contract: ConversationContract): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const result = await validateContract(contract);
    return { valid: result.valid, errors: result.errors };
  }

  static async understandWithValidation(
    input: string,
    context?: Partial<ConversationEngineContext>
  ): Promise<ValidatedAnalysis> {
    const contract = await this.understandConversation(input, context);
    const result = await validateContract(contract);
    if (!result.valid || !result.analysis) {
      throw new Error(`Validation failed: ${result.errors.join(", ")}`);
    }
    return result.analysis;
  }
}