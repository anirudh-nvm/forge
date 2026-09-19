import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

export type RootStackParamList = {
  Conversation: undefined;
  Today: undefined;
  Adjustment: undefined;
  Commitment: { commitmentId: string };
  Session: undefined;
  Reflection: undefined;
  OnboardingWelcome: undefined;
  OnboardingName: undefined;
  OnboardingLifeSeason: undefined;
  OnboardingPriorities: undefined;
  OnboardingPersonality: undefined;
  OnboardingReady: undefined;
  OnboardingExplainer: undefined;
};

export type ScreenNavigationProp<T extends keyof RootStackParamList> =
  NativeStackNavigationProp<RootStackParamList, T>;
