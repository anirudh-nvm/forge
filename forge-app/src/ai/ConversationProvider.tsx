import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { BrainOutput } from "../brain/types";
import type { CalendarEvent } from "../types/calendar";
import { generatePlan, type BrainDeps } from "../brain/Brain";
import { ConversationEngine } from "./ConversationEngine";
import { createForgeAI } from "./services/index";

export type UnderstandSource = "llm" | "deterministic";

export type UnderstandResult = {
  output: BrainOutput;
  source: UnderstandSource;
};

type ConversationContextType = {
  understand: (input: string, priorities: string[], calendarEvents?: CalendarEvent[]) => Promise<UnderstandResult>;
  isThinking: boolean;
  error: string | null;
};

const ConversationContext = createContext<ConversationContextType | null>(null);

let cachedAI: ReturnType<typeof createForgeAI> | null = null;

function getAI() {
  if (!cachedAI) {
    cachedAI = createForgeAI();
  }
  return cachedAI;
}

export function ConversationProvider({ children }: { children: ReactNode }) {
  const [isThinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const understand = useCallback(
    async (input: string, priorities: string[], calendarEvents?: CalendarEvent[]): Promise<UnderstandResult> => {
      setThinking(true);
      setError(null);

      try {
        const ai = getAI();
        const brainDeps: BrainDeps | undefined = ai.configured
          ? {
              ai: {
                chat: (params) => ai.client.json(params),
                isConfigured: () => ai.client.isConfigured(),
              },
            }
          : undefined;

        const output = await generatePlan({ conversation: input, priorities, currentTime: new Date(), calendarEvents }, brainDeps);
        const source: UnderstandSource = output.reasoning.some((r) => r.includes("source: ai")) ? "llm" : "deterministic";
        return { output, source };
      } catch (e) {
        const message = e instanceof Error ? e.message : "unknown error";
        setError(message);
        throw e;
      } finally {
        setThinking(false);
      }
    },
    []
  );

  return (
    <ConversationContext.Provider value={{ understand, isThinking, error }}>
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversation() {
  const ctx = useContext(ConversationContext);
  if (!ctx) throw new Error("useConversation must be used within ConversationProvider");
  return ctx;
}
