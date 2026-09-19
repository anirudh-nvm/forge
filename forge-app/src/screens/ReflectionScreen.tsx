import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
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
import { DailyReflectionEngine } from "../reflection/DailyReflectionEngine";
import type { DailyReflection } from "../reflection/DailyReflectionTypes";
import type { DaySummaryInput } from "../reflection/DailyReflectionTypes";

type Nav = NativeStackNavigationProp<RootStackParamList, "Reflection">;

function parseTimeToMinutes(timeStr: string): number {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export default function ReflectionScreen() {
  const navigation = useNavigation<Nav>();
  const { todayPlan, ai } = useForge();

  const [reflection, setReflection] = useState<DailyReflection | null>(null);
  const [userResponse, setUserResponse] = useState("");
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [stage, setStage] = useState<"loading" | "summary" | "input" | "followUp" | "done">("loading");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    generateSummary();
  }, []);

  async function generateSummary() {
    if (!todayPlan || !ai.client.isConfigured()) {
      setStage("summary");
      return;
    }

    setIsGenerating(true);
    try {
      const input: DaySummaryInput = {
        date: new Date().toISOString().split("T")[0],
        commitments: todayPlan.commitments.map((c) => ({
          title: c.title,
          startTime: c.startTime,
          endTime: c.endTime,
          completed: c.completed,
        })),
      };

      const stats = DailyReflectionEngine.computeStats(input);
      const aiSummary = await DailyReflectionEngine.generateSummary(input, {
        chat: (params) => ai.client.chat(params),
      });

      const newReflection: DailyReflection = {
        id: `refl_${Date.now()}`,
        date: input.date,
        ...stats,
        aiSummary,
        savedAt: new Date().toISOString(),
      };

      setReflection(newReflection);
      setStage("summary");
    } catch {
      setStage("summary");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSubmitResponse() {
    if (!userResponse.trim() || !reflection || !ai.client.isConfigured()) {
      if (reflection) {
        await DailyReflectionEngine.save(reflection);
      }
      setStage("done");
      navigation.goBack();
      return;
    }

    setIsGenerating(true);
    setStage("followUp");
    try {
      const followUpText = await DailyReflectionEngine.generateFollowUp(
        userResponse.trim(),
        reflection,
        { chat: (params) => ai.client.chat(params) }
      );
      setFollowUp(followUpText);

      const updated: DailyReflection = {
        ...reflection,
        userResponse: userResponse.trim(),
        aiFollowUp: followUpText,
      };
      setReflection(updated);
      await DailyReflectionEngine.save(updated);
    } catch {
      if (reflection) {
        await DailyReflectionEngine.save(reflection);
      }
    } finally {
      setIsGenerating(false);
    }
  }

  function handleDone() {
    navigation.goBack();
  }

  function getCompletionEmoji(): string {
    if (!reflection) return "";
    if (reflection.completionRate >= 1) return "all done";
    if (reflection.completionRate >= 0.7) return "solid day";
    if (reflection.completionRate >= 0.4) return "partial progress";
    return "tough day";
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <FadeInView>
            <Text style={styles.greeting}>reflection</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </Text>

            <Divider />

            {stage === "loading" && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.muted} />
                <Text style={styles.loadingText}>looking at your day...</Text>
              </View>
            )}

            {stage !== "loading" && reflection && (
              <>
                <View style={styles.statsRow}>
                  <View style={styles.statBlock}>
                    <Text style={styles.statNumber}>
                      {reflection.completedCount}/{reflection.totalCount}
                    </Text>
                    <Text style={styles.statLabel}>completed</Text>
                  </View>
                  <View style={styles.statBlock}>
                    <Text style={styles.statNumber}>
                      {reflection.plannedMinutes}m
                    </Text>
                    <Text style={styles.statLabel}>planned</Text>
                  </View>
                  <View style={styles.statBlock}>
                    <Text style={styles.statNumber}>
                      {getCompletionEmoji()}
                    </Text>
                    <Text style={styles.statLabel}>day</Text>
                  </View>
                </View>

                <Divider />

                {reflection.completedTitles.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>got done</Text>
                    {reflection.completedTitles.map((title) => (
                      <Text key={title} style={styles.taskLine}>
                        {title}
                      </Text>
                    ))}
                  </View>
                )}

                {reflection.skippedTitles.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>left behind</Text>
                    {reflection.skippedTitles.map((title) => (
                      <Text key={title} style={styles.taskLineSkipped}>
                        {title}
                      </Text>
                    ))}
                  </View>
                )}

                <View style={styles.summaryCard}>
                  <Text style={styles.summaryText}>{reflection.aiSummary}</Text>
                </View>

                {stage === "summary" && !followUp && (
                  <View style={styles.inputSection}>
                    <Text style={styles.inputLabel}>
                      how are you feeling about today?
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      value={userResponse}
                      onChangeText={setUserResponse}
                      placeholder="type your thoughts..."
                      placeholderTextColor={Colors.muted}
                      multiline
                      maxLength={500}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmitResponse}
                    />
                    <Pressable
                      style={[styles.submitButton, isGenerating && styles.submitButtonDisabled]}
                      onPress={handleSubmitResponse}
                      disabled={isGenerating}
                    >
                      <Text style={styles.submitButtonText}>
                        {isGenerating ? "thinking..." : "done reflecting"}
                      </Text>
                    </Pressable>
                  </View>
                )}

                {stage === "followUp" && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={Colors.muted} />
                  </View>
                )}

                {followUp && (
                  <FadeInView>
                    <View style={styles.followUpCard}>
                      <Text style={styles.followUpText}>{followUp}</Text>
                    </View>
                    <Pressable style={styles.doneButton} onPress={handleDone}>
                      <Text style={styles.doneButtonText}>close</Text>
                    </Pressable>
                  </FadeInView>
                )}

                {stage === "summary" && !userResponse && !followUp && (
                  <Pressable style={styles.skipButton} onPress={handleDone}>
                    <Text style={styles.skipButtonText}>skip reflection</Text>
                  </Pressable>
                )}
              </>
            )}
          </FadeInView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 48,
  },
  greeting: {
    fontSize: Typography.title,
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  date: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    marginBottom: Spacing.lg,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
  },
  loadingText: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    marginTop: Spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: Spacing.lg,
  },
  statBlock: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
  },
  statLabel: {
    fontSize: Typography.caption,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    marginTop: 2,
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  taskLine: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.primary,
    marginBottom: 4,
  },
  taskLineSkipped: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    marginBottom: 4,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.lg,
    marginVertical: Spacing.lg,
  },
  summaryText: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.primary,
    lineHeight: 22,
  },
  inputSection: {
    marginTop: Spacing.md,
  },
  inputLabel: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
    marginBottom: Spacing.sm,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.primary,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: Spacing.md,
  },
  submitButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: Typography.body,
    fontFamily: FontFamily.medium,
    color: Colors.primary,
  },
  followUpCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    borderLeftWidth: 2,
    borderLeftColor: Colors.muted,
  },
  followUpText: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.primary,
    lineHeight: 22,
    fontStyle: "italic",
  },
  doneButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  doneButtonText: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  skipButton: {
    alignItems: "center",
    marginTop: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  skipButtonText: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
});
