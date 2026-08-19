import { createContext, useContext, useCallback, useMemo, type ReactNode } from "react";

type AIDevPanelContextType = {
  openPanel: () => void;
  enabled: boolean;
};

const AIDevPanelContext = createContext<AIDevPanelContextType | null>(null);

interface AIDevPanelProviderProps {
  enabled: boolean;
  onOpen: () => void;
  children: ReactNode;
}

export function AIDevPanelProvider({ enabled, onOpen, children }: AIDevPanelProviderProps) {
  const openPanel = useCallback(() => {
    if (enabled) onOpen();
  }, [enabled, onOpen]);

  const value = useMemo(() => ({ openPanel, enabled }), [openPanel, enabled]);

  return (
    <AIDevPanelContext.Provider value={value}>{children}</AIDevPanelContext.Provider>
  );
}

export function useAIDevPanel() {
  const ctx = useContext(AIDevPanelContext);
  if (!ctx) throw new Error("useAIDevPanel must be used within AIDevPanelProvider");
  return ctx;
}