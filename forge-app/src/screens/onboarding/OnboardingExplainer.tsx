import { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/types/navigation";

import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import { useOnboarding } from "../../context/OnboardingContext";
import { useForge } from "../../context/ForgeContext";
import { StorageEngine } from "../../storage/StorageEngine";

type Nav = NativeStackNavigationProp<RootStackParamList, "OnboardingExplainer">;

const STEP_1 = `forge is the voice
of your higher self.

it sees the bigger picture,
remembers what matters,
and quietly guides you back
when life pulls you away.`;

const STEP_2 = `every day begins with
understanding where you are.

it helps you plan,
notices patterns you might miss,
and gently challenges you when you drift.

it never takes control.
it helps you become the person
you've always wanted to be.`;

const STEPS = [STEP_1, STEP_2];

export default function OnboardingExplainer() {
  const navigation = useNavigation<Nav>();
  const { data } = useOnboarding();
  const { setUserName, setPriorities, setPersonality } = useForge();
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const text = step === 0 ? STEP_1 : STEP_2;
  const isLastStep = step === STEPS.length - 1;

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    autoAdvanceRef.current = setTimeout(() => {
      handleContinue();
    }, 7000);

    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, [step]);

  const handleContinue = async () => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);

    if (!isLastStep) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setStep(step + 1);
      });
    } else {
      try {
        const profile = {
          name: data.name,
          preferredName: data.name,
          lifeSeason: data.lifeSeason || "other",
          priorities: data.priorities,
          personality: data.personality,
          lifeDirectionId: null,
          onboardingCompleted: true,
        };

        await StorageEngine.saveUserProfile(profile);
        await StorageEngine.saveUserName(data.name);
        await StorageEngine.savePriorities(data.priorities);
        await StorageEngine.savePersonality(data.personality);
        await StorageEngine.setOnboardingComplete();

        setUserName(data.name);
        setPriorities(data.priorities);
        setPersonality(data.personality);

        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: "Conversation" }],
          });
        });
      } catch (error) {
        console.error("failed to save onboarding:", error);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.text}>{text}</Text>
        </Animated.View>
      </View>

      {isLastStep && (
        <View style={styles.footer}>
          <Pressable style={styles.button} onPress={handleContinue}>
            <Text style={styles.buttonText}>continue</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
  },
  text: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.primary,
    lineHeight: 36,
    opacity: 0.7,
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  button: {
    backgroundColor: Colors.surface,
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: "center",
  },
  buttonText: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
});
