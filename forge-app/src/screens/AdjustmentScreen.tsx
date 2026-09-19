import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/types/navigation";

import { Colors } from "../constants/colors";
import { FontFamily, Typography } from "../constants/typography";
import { Spacing } from "../constants/spacing";
import Divider from "../components/ui/Divider";
import FadeInView from "../components/ui/FadeInView";
import { useForge } from "../context/ForgeContext";
import { getPersonalizedGreeting } from "../utils/greeting";
import { buildAdjustmentSuggestions } from "../engine/AdjustmentSuggestions";

type Nav = NativeStackNavigationProp<RootStackParamList, "Adjustment">;

type LearningPrompt = {
  patternId: string;
  message: string;
  options: { label: string; value: string }[];
};

export default function AdjustmentScreen() {
  const navigation = useNavigation<Nav>();
  const { todayPlan, userName, adjustFromText } = useForge();
  const [inputText, setInputText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [learningPrompts, setLearningPrompts] = useState<LearningPrompt[]>([]);

  const suggestions = todayPlan ? buildAdjustmentSuggestions(todayPlan) : [];
  const hasContent = inputText.trim().length > 0;

  const handleSuggestionPress = (message: string) => {
    setInputText(message);
    setFeedback(null);
  };

  const handleUpdate = async () => {
    if (!hasContent || !todayPlan || isUpdating) return;

    // Ask before major changes
    const lower = inputText.toLowerCase();
    const isMajor = /cancel|delete|remove|skip|don't\s+need|no\s+\w+\s+today/i.test(lower);

    if (isMajor) {
      Alert.alert(
        "are you sure?",
        "this will change your plan. want to continue?",
        [
          { text: "cancel", style: "cancel" },
          { text: "yes, update", onPress: () => performUpdate() },
        ]
      );
      return;
    }

    await performUpdate();
  };

  const performUpdate = async () => {
    if (!hasContent || !todayPlan || isUpdating) return;

    setIsUpdating(true);
    const result = await adjustFromText(inputText);
    setIsUpdating(false);

    if (result.applied) {
      if (result.learningPrompts && result.learningPrompts.length > 0) {
        setLearningPrompts(result.learningPrompts);
        setFeedback(result.explanation);
      } else {
        navigation.navigate("Today");
      }
    } else {
      setFeedback(result.explanation || "i didn't find anything to change. try mentioning a commitment by name.");
    }
  };

  const handleLearningResponse = (patternId: string, value: string) => {
    setLearningPrompts((prev) => prev.filter((p) => p.patternId !== patternId));
    if (learningPrompts.length <= 1) {
      navigation.navigate("Today");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <FadeInView delay={200}>
            <Text style={styles.greeting}>{getPersonalizedGreeting(userName)}</Text>
          </FadeInView>

          <FadeInView delay={400}>
            <Text style={styles.question}>what changed?</Text>
          </FadeInView>

          {feedback && (
            <FadeInView delay={500}>
              <Text style={styles.feedback}>{feedback}</Text>
            </FadeInView>
          )}

          {learningPrompts.length > 0 && (
            <FadeInView delay={600}>
              <Text style={styles.sectionTitle}>i noticed something</Text>
              {learningPrompts.map((prompt) => (
                <View key={prompt.patternId} style={styles.learningCard}>
                  <Text style={styles.learningMessage}>{prompt.message}</Text>
                  <View style={styles.learningButtons}>
                    {prompt.options.map((opt) => (
                      <Pressable
                        key={opt.value}
                        style={styles.learningButton}
                        onPress={() => handleLearningResponse(prompt.patternId, opt.value)}
                      >
                        <Text style={styles.learningButtonText}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </FadeInView>
          )}

          <FadeInView delay={700} style={styles.dividerContainer}>
            <Divider />
          </FadeInView>

          {suggestions.length > 0 && (
            <FadeInView delay={800}>
              <Text style={styles.sectionTitle}>suggestions</Text>
              {suggestions.map((suggestion) => (
                <Pressable
                  key={suggestion.label}
                  style={styles.suggestionRow}
                  onPress={() => handleSuggestionPress(suggestion.message)}
                >
                  <Text style={styles.suggestionText}>{suggestion.label}</Text>
                  <Text style={styles.suggestionArrow}>›</Text>
                </Pressable>
              ))}
            </FadeInView>
          )}
        </ScrollView>

        <FadeInView delay={900} style={styles.footer}>
          {isUpdating && (
            <View style={styles.loadingBar}>
              <ActivityIndicator size="small" color={Colors.muted} />
              <Text style={styles.loadingText}>updating your plan...</Text>
            </View>
          )}

          <View style={[styles.inputBar, isUpdating && styles.inputDisabled]}>
            <TextInput
              style={styles.input}
              placeholder="tell me what changed..."
              placeholderTextColor={Colors.muted}
              value={inputText}
              onChangeText={(text) => {
                setInputText(text);
                setFeedback(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleUpdate}
              returnKeyType="send"
              editable={!isUpdating}
            />
          </View>

          <Pressable
            style={[styles.updateButton, (!hasContent || isUpdating) && styles.updateDisabled]}
            onPress={handleUpdate}
            disabled={!hasContent || isUpdating}
          >
            <Text style={styles.updateButtonText}>{isUpdating ? "updating..." : "update today"}</Text>
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
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  greeting: {
    fontSize: Typography.title,
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
    letterSpacing: -0.5,
    marginTop: Spacing.lg,
    marginBottom: 4,
  },
  question: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    lineHeight: 28,
    marginBottom: Spacing.lg,
  },
  feedback: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
    lineHeight: 24,
    marginBottom: Spacing.sm,
  },
  dividerContainer: {
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    marginTop: 16,
    marginBottom: 8,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  suggestionText: {
    flex: 1,
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
    opacity: 0.7,
  },
  suggestionArrow: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    opacity: 0.5,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 10,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.primary,
    paddingVertical: 8,
  },
  updateButton: {
    backgroundColor: Colors.surface,
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: "center",
  },
  updateDisabled: {
    opacity: 0.3,
  },
  updateButtonText: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  loadingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
  },
  loadingText: {
    fontSize: Typography.subheadline,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  learningCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  learningMessage: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
    lineHeight: 24,
    marginBottom: 12,
  },
  learningButtons: {
    flexDirection: "row",
    gap: 8,
  },
  learningButton: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  learningButtonText: {
    fontSize: Typography.subheadline,
    fontFamily: FontFamily.regular,
    color: Colors.primary,
  },
});