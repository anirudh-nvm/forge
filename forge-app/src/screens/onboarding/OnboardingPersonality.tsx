import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/types/navigation";

import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import FadeInView from "../../components/ui/FadeInView";
import { useOnboarding } from "../../context/OnboardingContext";
import type { MentorPersonality } from "../../onboarding/OnboardingTypes";

type Nav = NativeStackNavigationProp<RootStackParamList, "OnboardingPersonality">;

const OPTIONS: { value: MentorPersonality; label: string; hint: string }[] = [
  { value: "quiet", label: "quiet", hint: "remind me, then get out of my way" },
  { value: "supportive", label: "supportive", hint: "encourage me when it matters" },
  { value: "mentor", label: "mentor", hint: "keep me connected to what matters" },
];

export default function OnboardingPersonality() {
  const navigation = useNavigation<Nav>();
  const { updateData } = useOnboarding();

  const handleSelect = (personality: MentorPersonality) => {
    updateData({ personality });
    navigation.navigate("OnboardingReady");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <FadeInView delay={100}>
          <Text style={styles.step}>step 4 of 4</Text>
        </FadeInView>

        <FadeInView delay={200}>
          <Text style={styles.question}>
            how should i remind you{"\n"}when a promise is near?
          </Text>
        </FadeInView>

        {OPTIONS.map((option, index) => (
          <FadeInView key={option.value} delay={400 + index * 100}>
            <Pressable
              style={styles.option}
              onPress={() => handleSelect(option.value)}
            >
              <Text style={styles.optionText}>{option.label}</Text>
              <Text style={styles.optionHint}>{option.hint}</Text>
            </Pressable>
          </FadeInView>
        ))}
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
  step: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    textTransform: "lowercase",
    marginBottom: 24,
  },
  question: {
    fontSize: Math.round(Typography.title * 1.1),
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
    letterSpacing: -0.5,
    lineHeight: 38,
    marginBottom: 32,
  },
  option: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  optionText: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.medium,
    color: Colors.primary,
  },
  optionHint: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    marginTop: 4,
  },
});
