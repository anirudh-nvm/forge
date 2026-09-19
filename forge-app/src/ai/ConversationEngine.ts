import type { ConversationContract } from "./ConversationContract";
import { validateContract, type ValidatedAnalysis } from "./Validation";
import { buildMemoryContext, buildConversationEngineContext } from "./MemoryContext";
import { buildChatMemoryContext } from "./ChatMemoryContext";
import { buildPredictionContext, formatPredictionsForLLM } from "./PredictionContext";
import { buildHigherSelfChatContext, formatHigherSelfForLLM, formatIdentityForLLM } from "./HigherSelfContext";
import { buildUnderstandingPrompt } from "./prompts/UnderstandingPrompt";
import { jsonWithRetry } from "./RetryEngine";
import { toJSONChatParams } from "./JSONMode";
import { Logger } from "./debug/Logger";

export interface ConversationEngineContext {
  lifeSeason: string;
  priorities: string[];
  currentDate: string;
  existingTimetable: string[];
}

export interface ConversationEngineDeps {
  chat: <T>(params: import("./types/AIResponse").ChatParams) => Promise<import("./types/AIResponse").JSONResult<T>>;
  isConfigured: () => boolean;
}

export class ConversationEngine {
  static async understandConversation(
    input: string,
    context?: Partial<ConversationEngineContext>,
    deps?: ConversationEngineDeps
  ): Promise<ConversationContract> {
    const [memory, chatMemory, predContext, hsContext] = await Promise.all([
      buildMemoryContext(),
      buildChatMemoryContext(),
      buildPredictionContext(input),
      buildHigherSelfChatContext(),
    ]);
    const fullContext = buildConversationEngineContext(memory);

    if (context) {
      Object.assign(fullContext, context);
    }

    if (!deps || !deps.isConfigured()) {
      throw new Error("LLM not configured — use deterministic pipeline");
    }

    const prompt = buildUnderstandingPrompt(input, {
      ...fullContext,
      identity: memory.identity,
      goals: memory.goals,
      timePreferences: memory.timePreferences,
      behavioralPatterns: memory.behavioralPatterns,
      memoryPatterns: memory.memoryPatterns,
      outcomeHistory: memory.outcomeHistory,
      beliefs: memory.beliefs,
      chatMemory: {
        patterns: chatMemory.patterns,
        predictions: chatMemory.predictions,
        beliefs: chatMemory.beliefs,
        completionRates: chatMemory.completionRates,
      },
      predictions: formatPredictionsForLLM(predContext.predictions).split("\n").filter(Boolean),
      higherSelf: hsContext.message?.text,
    });

    const params = toJSONChatParams(
      "You are Forge's Understanding Layer. Extract structured schedule data from natural language.",
      prompt,
      { maxTokens: 1200 }
    );

    const result = await jsonWithRetry<ConversationContract>(
      { json: deps.chat },
      {
        messages: params.messages,
        temperature: 0.2,
        maxTokens: 1200,
        operation: "understanding",
      },
      { maxAttempts: 3 }
    );

    Logger.log("[ConversationEngine] LLM understanding succeeded");
    return result.data;
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
    context?: Partial<ConversationEngineContext>,
    deps?: ConversationEngineDeps
  ): Promise<ValidatedAnalysis> {
    const contract = await this.understandConversation(input, context, deps);
    const result = await validateContract(contract);
    if (!result.valid || !result.analysis) {
      throw new Error(`Validation failed: ${result.errors.join(", ")}`);
    }
    return result.analysis;
  }
}