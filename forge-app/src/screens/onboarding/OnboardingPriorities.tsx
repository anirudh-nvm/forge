import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/types/navigation";

import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import FadeInView from "../../components/ui/FadeInView";
import { useOnboarding } from "../../context/OnboardingContext";
import { PRIORITY_CUSTOM } from "../../brain/PriorityKeywords";

type Nav = NativeStackNavigationProp<RootStackParamList, "OnboardingPriorities">;

const MAX_SELECTIONS = 2;

const presetOptions = [
  { key: "health", label: "my health" },
  { key: "studies", label: "my studies" },
  { key: "work", label: "my work" },
  { key: "finances", label: "my finances" },
  { key: "relationships", label: "my relationships" },
  { key: "building", label: "building something" },
  { key: "promises", label: "keeping promises to myself" },
];

export default function OnboardingPriorities() {
  const navigation = useNavigation<Nav>();
  const { updateData } = useOnboarding();
  const [selected, setSelected] = useState<string[]>([]);
  const [showCustom, setShowCustom] = useState(false);
  const [customText, setCustomText] = useState("");

  const toggle = (key: string) => {
    setSelected((prev) =>
      prev.includes(key)
        ? prev.filter((s) => s !== key)
        : prev.length >= MAX_SELECTIONS
          ? prev
          : [...prev, key]
    );
  };

  const handleCustomAdd = () => {
    const trimmed = customText.trim().toLowerCase();
    if (trimmed) {
      setSelected((prev) =>
        prev.length >= MAX_SELECTIONS || prev.includes(PRIORITY_CUSTOM)
          ? prev
          : [...prev, PRIORITY_CUSTOM]
      );
      setCustomText(trimmed);
      setShowCustom(false);
    }
  };

  const handleContinue = () => {
    if (selected.length !== 2) return;
    const priorities = selected.includes(PRIORITY_CUSTOM)
      ? [...selected.filter((s) => s !== PRIORITY_CUSTOM), customText.trim().toLowerCase()]
      : selected;
    updateData({ priorities });
    navigation.navigate("OnboardingPersonality");
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeInView delay={100}>
            <Text style={styles.step}>step 3 of 4</Text>
          </FadeInView>

          <FadeInView delay={200}>
            <Text style={styles.question}>
              what would you like me to{"\n"}protect time for?
            </Text>
          </FadeInView>

          <FadeInView delay={300}>
            <Text style={styles.subtext}>
              choose two. i'll use these{"\n"}when planning your day.
            </Text>
          </FadeInView>

          <View style={styles.optionsContainer}>
            {presetOptions.map((item, index) => (
              <FadeInView key={item.key} delay={400 + index * 60}>
                <Pressable
                  style={[styles.option, selected.includes(item.key) && styles.optionSelected]}
                  onPress={() => toggle(item.key)}
                >
                  <Text style={[styles.optionText, selected.includes(item.key) && styles.optionTextSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              </FadeInView>
            ))}

            <FadeInView delay={400 + presetOptions.length * 60}>
              {showCustom ? (
                <View style={styles.customInputRow}>
                  <TextInput
                    style={styles.customInput}
                    placeholder="what should i protect?"
                    placeholderTextColor={Colors.muted}
                    value={customText}
                    onChangeText={(text) => setCustomText(text.toLowerCase())}
                    onSubmitEditing={handleCustomAdd}
                    returnKeyType="done"
                    autoFocus
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Pressable style={styles.customAdd} onPress={handleCustomAdd}>
                    <Text style={styles.customAddText}>add</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.option} onPress={() => setShowCustom(true)}>
                  <Text style={styles.optionText}>write my own →</Text>
                </Pressable>
              )}
            </FadeInView>
          </View>
        </ScrollView>

        <FadeInView delay={600} style={styles.footer}>
          <Pressable
            style={[styles.button, selected.length !== 2 && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={selected.length !== 2}
          >
            <Text style={styles.buttonText}>continue</Text>
          </Pressable>
        </FadeInView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 16,
  },
  step: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    textTransform: "lowercase",
    marginBottom: 24,
  },
  question: {
    fontSize: Math.round(Typography.headline * 1.35),
    fontFamily: FontFamily.medium,
    color: Colors.primary,
    lineHeight: 36,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  subtext: {
    fontSize: Math.round(Typography.footnote * 1.1),
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    lineHeight: 20,
    marginBottom: 32,
  },
  optionsContainer: {
    gap: 10,
  },
  option: {
    backgroundColor: Colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },
  optionSelected: {
    backgroundColor: Colors.surface,
    borderColor: Colors.muted,
  },
  optionText: {
    fontSize: Math.round(Typography.body * 1.1),
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  optionTextSelected: {
    color: Colors.primary,
  },
  customInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  customInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    fontSize: Math.round(Typography.body * 1.1),
    fontFamily: FontFamily.regular,
    color: Colors.primary,
    borderWidth: 1,
    borderColor: Colors.muted,
  },
  customAdd: {
    backgroundColor: Colors.divider,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  customAddText: {
    fontSize: Math.round(Typography.body * 1.1),
    fontFamily: FontFamily.regular,
    color: Colors.primary,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  button: {
    backgroundColor: Colors.surface,
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  buttonText: {
    fontSize: Math.round(Typography.callout * 1.1),
    fontFamily: FontFamily.regular,
    color: Colors.primary,
  },
});