import { useCallback, useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { Colors } from "./src/constants/colors";
import type { RootStackParamList } from "./src/types/navigation";
import { ForgeProvider } from "./src/context/ForgeContext";
import { OnboardingProvider } from "./src/context/OnboardingContext";
import { ConversationProvider } from "./src/ai/ConversationProvider";
import { StorageEngine } from "./src/storage/StorageEngine";
import { checkLifecycleState } from "./src/engine/LifecycleEngine";
import { getAIConfig } from "@/ai/config/env";
import DeveloperAIPanel from "./src/components/dev/DeveloperAIPanel";
import { AIDevPanelProvider } from "./src/context/AIDevPanelContext";
import SplashScreen from "./src/screens/SplashScreen";

import ConversationScreen from "./src/screens/ConversationScreen";
import TodayScreen from "./src/screens/TodayScreen";
import AdjustmentScreen from "./src/screens/AdjustmentScreen";
import CommitmentScreen from "./src/screens/CommitmentScreen";
import SessionScreen from "./src/screens/SessionScreen";
import ReflectionScreen from "./src/screens/ReflectionScreen";

import OnboardingWelcome from "./src/screens/onboarding/OnboardingWelcome";
import OnboardingName from "./src/screens/onboarding/OnboardingName";
import OnboardingLifeSeason from "./src/screens/onboarding/OnboardingLifeSeason";
import OnboardingPriorities from "./src/screens/onboarding/OnboardingPriorities";
import OnboardingPersonality from "./src/screens/onboarding/OnboardingPersonality";
import OnboardingReady from "./src/screens/onboarding/OnboardingReady";
import OnboardingExplainer from "./src/screens/onboarding/OnboardingExplainer";

const Stack = createNativeStackNavigator<RootStackParamList>();

type RouteDecision =
  | { route: "OnboardingWelcome" }
  | { route: "Today" }
  | { route: "Conversation" };

async function decideInitialRoute(): Promise<RouteDecision> {
  try {
    const onboardingComplete = await Promise.race([
      StorageEngine.isOnboardingComplete(),
      new Promise<boolean>((r) => setTimeout(() => r(false), 2000)),
    ]);
    if (!onboardingComplete) return { route: "OnboardingWelcome" };

    const lifecycle = await Promise.race([
      checkLifecycleState(new Date()),
      new Promise<{ hasPlan: boolean }>((r) => setTimeout(() => r({ hasPlan: false }), 2000)),
    ]);
    return lifecycle.hasPlan ? { route: "Today" } : { route: "Conversation" };
  } catch {
    return { route: "Conversation" };
  }
}

export default function App() {
  const [routeDecision, setRouteDecision] = useState<RouteDecision | null>(null);
  const [splashDone, setSplashDone] = useState(false);
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const devPanelEnabled = getAIConfig().devPanel;

  const handleSplashDone = useCallback(() => setSplashDone(true), []);

  useEffect(() => {
    decideInitialRoute().then(setRouteDecision);
  }, []);

  if (!splashDone) return <SplashScreen onDone={handleSplashDone} />;
  if (routeDecision === null) return null;

  const initialRouteName = routeDecision.route;

  return (
    <ConversationProvider>
      <ForgeProvider>
        <OnboardingProvider>
          <AIDevPanelProvider
            enabled={devPanelEnabled}
            onOpen={() => setDevPanelOpen(true)}
          >
          <NavigationContainer>
            <StatusBar style="light" />
          <Stack.Navigator
            initialRouteName={initialRouteName}
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Colors.background },
              animation: "fade",
              animationDuration: 300,
            }}
          >
            <Stack.Screen name="OnboardingWelcome" component={OnboardingWelcome} />
            <Stack.Screen name="OnboardingName" component={OnboardingName} />
            <Stack.Screen name="OnboardingLifeSeason" component={OnboardingLifeSeason} />
            <Stack.Screen name="OnboardingPriorities" component={OnboardingPriorities} />
            <Stack.Screen name="OnboardingPersonality" component={OnboardingPersonality} />
            <Stack.Screen name="OnboardingReady" component={OnboardingReady} />
            <Stack.Screen name="OnboardingExplainer" component={OnboardingExplainer} />
            <Stack.Screen name="Today" component={TodayScreen} />
            <Stack.Screen name="Conversation" component={ConversationScreen} />
            <Stack.Screen name="Adjustment" component={AdjustmentScreen} />
            <Stack.Screen name="Commitment" component={CommitmentScreen} />
            <Stack.Screen name="Session" component={SessionScreen} />
            <Stack.Screen name="Reflection" component={ReflectionScreen} />
          </Stack.Navigator>
          </NavigationContainer>
          {devPanelEnabled && (
            <DeveloperAIPanel
              visible={devPanelOpen}
              onClose={() => setDevPanelOpen(false)}
            />
          )}
          </AIDevPanelProvider>
        </OnboardingProvider>
      </ForgeProvider>
    </ConversationProvider>
  );
}