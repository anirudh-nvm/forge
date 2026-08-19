import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/types/navigation";

import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import FadeInView from "../../components/ui/FadeInView";
import { useOnboarding } from "../../context/OnboardingContext";
import type { LifeSeason } from "../../onboarding/OnboardingTypes";

type Nav = NativeStackNavigationProp<RootStackParamList, "OnboardingLifeSeason">;

const SEASONS: { value: LifeSeason; label: string }[] = [
  { value: "student", label: "student" },
  { value: "working_professional", label: "working professional" },
  { value: "building_something", label: "building something" },
  { value: "looking_for_work", label: "looking for work" },
  { value: "taking_a_break", label: "taking a break" },
  { value: "other", label: "other" },
];

export default function OnboardingLifeSeason() {
  const navigation = useNavigation<Nav>();
  const { updateData } = useOnboarding();

  const handleSelect = (season: LifeSeason) => {
    updateData({ lifeSeason: season });
    navigation.navigate("OnboardingPriorities");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <FadeInView delay={100}>
          <Text style={styles.step}>step 2 of 4</Text>
        </FadeInView>

        <FadeInView delay={200}>
          <Text style={styles.question}>
            which best describes where you are right now?
          </Text>
        </FadeInView>

        {SEASONS.map((season, index) => (
          <FadeInView key={season.value} delay={400 + index * 100}>
            <Pressable
              style={styles.option}
              onPress={() => handleSelect(season.value)}
            >
              <Text style={styles.optionText}>{season.label}</Text>
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
    marginBottom: 32,
  },
  option: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  optionText: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
  },
});
