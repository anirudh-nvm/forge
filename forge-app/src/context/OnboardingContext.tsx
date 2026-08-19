import { createContext, useContext, useState, type ReactNode } from "react";
import type { LifeSeason, MentorPersonality } from "../onboarding/OnboardingTypes";

interface OnboardingData {
  name: string;
  lifeSeason: LifeSeason | null;
  priorities: string[];
  personality: MentorPersonality;
}

interface OnboardingContextValue {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
}

const defaultData: OnboardingData = {
  name: "",
  lifeSeason: null,
  priorities: [],
  personality: "supportive",
};

const OnboardingContext = createContext<OnboardingContextValue>({
  data: defaultData,
  updateData: () => {},
});

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<OnboardingData>(defaultData);

  const updateData = (partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  };

  return (
    <OnboardingContext.Provider value={{ data, updateData }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}