import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/types/navigation";

import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import { useOnboarding } from "../../context/OnboardingContext";
import { useForge } from "../../context/ForgeContext";
import { StorageEngine } from "../../storage/StorageEngine";

type Nav = NativeStackNavigationProp<RootStackParamList, "OnboardingReady">;

export default function OnboardingReady() {
  const navigation = useNavigation<Nav>();
  const { data } = useOnboarding();
  const { setUserName, setPriorities, setPersonality } = useForge();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(300),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.delay(1800),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      handleContinue();
    });
  }, []);

  const handleContinue = async () => {
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

      navigation.reset({
        index: 0,
        routes: [{ name: "OnboardingExplainer" }],
      });
    } catch (error) {
      console.error("failed to save onboarding:", error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.line}>thanks, {data.name}.</Text>
          <Text style={styles.line}>i know enough to start.</Text>
          <Text style={styles.line}>the rest i'll learn by working with you.</Text>
        </Animated.View>
      </View>
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
  line: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.primary,
    lineHeight: 34,
    marginBottom: 8,
  },
});