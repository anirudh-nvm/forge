import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { BrainOutput } from "../brain/types";
import type { CalendarEvent } from "../types/calendar";
import { generatePlan } from "../brain/Brain";
import { ConversationEngine } from "./ConversationEngine";

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

export function ConversationProvider({ children }: { children: ReactNode }) {
  const [isThinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const understand = useCallback(
    async (input: string, priorities: string[], calendarEvents?: CalendarEvent[]): Promise<UnderstandResult> => {
      setThinking(true);
      setError(null);

      try {
        await ConversationEngine.understandWithValidation(input);
      } catch {
        // LLM path not yet implemented — fall through to deterministic pipeline.
      }

      try {
        const output = await generatePlan({ conversation: input, priorities, currentTime: new Date(), calendarEvents });
        return { output, source: "deterministic" };
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
