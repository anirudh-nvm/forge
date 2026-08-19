import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/types/navigation";

import { Colors } from "../constants/colors";
import { FontFamily, Typography } from "../constants/typography";
import { Spacing } from "../constants/spacing";
import Divider from "../components/ui/Divider";
import CommitmentRow from "../components/commitment/CommitmentRow";
import FadeInView from "../components/ui/FadeInView";
import { useForge } from "../context/ForgeContext";
import { useAIDevPanel } from "../context/AIDevPanelContext";
import { useDayState } from "../hooks/useDayState";
import { generateLiveBrief } from "../day/LiveBriefEngine";
import { resetForge } from "../engine/ResetEngine";
import { getPersonalizedGreeting } from "../utils/greeting";
import type { PlanStatus } from "../types/todayPlan";
import type { Commitment } from "../types/commitment";

type Nav = NativeStackNavigationProp<RootStackParamList, "Today">;

function parseTimeToMinutes(timeStr: string): number {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return -1;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function getNowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function getContextLine(commitments: Commitment[], hasPlan: boolean): string {
  if (!hasPlan || commitments.length === 0) {
    return "what does today look like?";
  }

  const nowMinutes = getNowMinutes();
  const allCompleted = commitments.every((c) => c.completed);
  if (allCompleted) return "today is complete.";

  for (const c of commitments) {
    const start = parseTimeToMinutes(c.startTime);
    const end = parseTimeToMinutes(c.endTime);
    if (start !== -1 && end !== -1 && nowMinutes >= start && nowMinutes <= end) {
      return `you're currently in ${c.title.toLowerCase()}.`;
    }
  }

  const upcoming = commitments
    .filter((c) => !c.completed)
    .map((c) => ({ ...c, startMinutes: parseTimeToMinutes(c.startTime) }))
    .filter((c) => c.startMinutes !== -1 && c.startMinutes > nowMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  if (upcoming.length > 0) {
    const next = upcoming[0];
    return `next up: ${next.title.toLowerCase()} at ${next.startTime}.`;
  }

  return "today is complete.";
}

function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function dedupeByTitle(commitments: Commitment[]): Commitment[] {
  const earliestByTitle = new Map<string, Commitment>();
  for (const c of commitments) {
    const key = normalizeTitle(c.title);
    const existing = earliestByTitle.get(key);
    if (!existing || parseTimeToMinutes(c.startTime) < parseTimeToMinutes(existing.startTime)) {
      earliestByTitle.set(key, c);
    }
  }
  return [...earliestByTitle.values()].sort(
    (a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
  );
}

export default function TodayScreen() {
  const navigation = useNavigation<Nav>();
  const { todayPlan, personality, approvePlan, isLoading, trustScore, userName } = useForge();
  const { openPanel } = useAIDevPanel();
  const dayState = useDayState(todayPlan);
  const commitments = todayPlan?.commitments ?? [];
  const displayCommitments = dedupeByTitle(commitments);
  const sessionCountFor = (title: string) =>
    commitments.filter((c) => normalizeTitle(c.title) === normalizeTitle(title)).length;
  const unscheduled = todayPlan?.unscheduled ?? [];
  const warnings = todayPlan?.warnings ?? [];
  const brief = todayPlan ? generateLiveBrief(dayState, todayPlan, personality) : null;
  const planStatus: PlanStatus | null = todayPlan?.status ?? null;
  const [showFullSchedule, setShowFullSchedule] = useState(false);

  const completedToday = commitments.filter((c) => c.completed).length;
  const contextLine = getContextLine(commitments, !!todayPlan);

  const handleLooksGood = () => {
    approvePlan();
  };

  const handleAdjustToday = () => {
    navigation.navigate("Adjustment");
  };

  const handleReset = () => {
    Alert.alert("reset forge?", "this clears everything and starts fresh.", [
      { text: "cancel", style: "cancel" },
      {
        text: "reset",
        style: "destructive",
        onPress: async () => {
          await resetForge();
          navigation.reset({
            index: 0,
            routes: [{ name: "OnboardingWelcome" }],
          });
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>preparing your day...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <FadeInView delay={200}>
          <Pressable onLongPress={openPanel} delayLongPress={600}>
            <Text style={styles.greeting}>{getPersonalizedGreeting(userName)}</Text>
          </Pressable>
        </FadeInView>

        <FadeInView delay={400}>
          <Text style={styles.contextLine}>{contextLine}</Text>
        </FadeInView>

        <FadeInView delay={600} style={styles.dividerContainer}>
          <Divider />
        </FadeInView>

        {todayPlan && planStatus === "draft" && dayState.phase === "active_commitment" && dayState.currentCommitment && !showFullSchedule && (
          <View style={styles.activeCommitmentCard}>
            <FadeInView delay={400}>
              <Text style={styles.activeLabel}>it's time.</Text>
            </FadeInView>

            <FadeInView delay={600}>
              <Text style={styles.activeTitle}>{dayState.currentCommitment.title}</Text>
            </FadeInView>

            <FadeInView delay={800}>
              <Text style={styles.activeTimeRange}>
                {dayState.currentCommitment.startTime} – {dayState.currentCommitment.endTime}
              </Text>
            </FadeInView>

            <FadeInView delay={1000} style={styles.activeDividerContainer}>
              <Divider />
            </FadeInView>

            <FadeInView delay={1200}>
              <Text style={styles.activeRemaining}>
                {(() => {
                  const end = parseTimeToMinutes(dayState.currentCommitment.endTime);
                  const now = getNowMinutes();
                  const mins = Math.max(0, end - now);
                  if (mins <= 0) return "finishing up.";
                  if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""} remaining.`;
                  const h = Math.floor(mins / 60);
                  const m = mins % 60;
                  return m > 0 ? `${h}h ${m}m remaining.` : `${h} hour${h !== 1 ? "s" : ""} remaining.`;
                })()}
              </Text>
            </FadeInView>
          </View>
        )}

        {todayPlan && planStatus === "draft" && (showFullSchedule || !(dayState.phase === "active_commitment" && dayState.currentCommitment)) && (
          <>
            {brief && (
              <View style={styles.briefSection}>
                <FadeInView delay={400}>
                  <Text style={styles.briefFocus}>{brief.subheadline}</Text>
                </FadeInView>
              </View>
            )}

            <FadeInView delay={750}>
              <Text style={styles.sectionTitle}>today's plan</Text>
            </FadeInView>

            <FadeInView delay={900}>
              {displayCommitments.map((commitment) => (
                <CommitmentRow
                  key={commitment.id}
                  commitment={commitment}
                  sessionCount={sessionCountFor(commitment.title)}
                  isCalendar={commitment.id.startsWith("cal-")}
                  onPress={() => navigation.navigate("Commitment", { commitmentId: commitment.id })}
                />
              ))}
            </FadeInView>

            {unscheduled.length > 0 && (
              <>
                <FadeInView delay={1050}>
                  <Text style={styles.sectionTitle}>couldn't fit today</Text>
                </FadeInView>
                <FadeInView delay={1150}>
                  {unscheduled.map((item) => (
                    <View key={item.title} style={styles.unscheduledRow}>
                      <Text style={styles.unscheduledTitle}>{item.title}</Text>
                      <Text style={styles.unscheduledReason}>{item.reason}</Text>
                    </View>
                  ))}
                </FadeInView>
              </>
            )}

            {warnings.length > 0 && (
              <FadeInView delay={1250}>
                {warnings.map((warning, index) => (
                  <Text key={index} style={styles.warning}>{warning}</Text>
                ))}
              </FadeInView>
            )}
          </>
        )}

        {todayPlan && planStatus === "active" && dayState.phase === "active_commitment" && dayState.currentCommitment && !showFullSchedule && (
          <View style={styles.activeCommitmentCard}>
            <FadeInView delay={400}>
              <Text style={styles.activeLabel}>it's time.</Text>
            </FadeInView>

            <FadeInView delay={600}>
              <Text style={styles.activeTitle}>{dayState.currentCommitment.title}</Text>
            </FadeInView>

            <FadeInView delay={800}>
              <Text style={styles.activeTimeRange}>
                {dayState.currentCommitment.startTime} – {dayState.currentCommitment.endTime}
              </Text>
            </FadeInView>

            <FadeInView delay={1000} style={styles.activeDividerContainer}>
              <Divider />
            </FadeInView>

            <FadeInView delay={1200}>
              <Text style={styles.activeRemaining}>
                {(() => {
                  const end = parseTimeToMinutes(dayState.currentCommitment.endTime);
                  const now = getNowMinutes();
                  const mins = Math.max(0, end - now);
                  if (mins <= 0) return "finishing up.";
                  if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""} remaining.`;
                  const h = Math.floor(mins / 60);
                  const m = mins % 60;
                  return m > 0 ? `${h}h ${m}m remaining.` : `${h} hour${h !== 1 ? "s" : ""} remaining.`;
                })()}
              </Text>
            </FadeInView>
          </View>
        )}

        {todayPlan && planStatus === "active" && (showFullSchedule || !(dayState.phase === "active_commitment" && dayState.currentCommitment)) && (
          <>
            {brief && (
              <View style={styles.briefSection}>
                <FadeInView delay={400}>
                  <Text style={styles.briefFocus}>{brief.subheadline}</Text>
                </FadeInView>
                {brief.cta && (
                  <FadeInView delay={550}>
                    <Text style={styles.briefEncouragement}>{brief.cta.label}</Text>
                  </FadeInView>
                )}
              </View>
            )}

            <FadeInView delay={850}>
              <Text style={styles.sectionTitle}>today's commitments</Text>
            </FadeInView>

            <FadeInView delay={1000}>
              {displayCommitments.map((commitment) => (
                <CommitmentRow
                  key={commitment.id}
                  commitment={commitment}
                  sessionCount={sessionCountFor(commitment.title)}
                  isCalendar={commitment.id.startsWith("cal-")}
                  onPress={() => navigation.navigate("Commitment", { commitmentId: commitment.id })}
                />
              ))}
            </FadeInView>

            {unscheduled.length > 0 && (
              <>
                <FadeInView delay={1150}>
                  <Text style={styles.sectionTitle}>couldn't fit today</Text>
                </FadeInView>
                <FadeInView delay={1250}>
                  {unscheduled.map((item) => (
                    <View key={item.title} style={styles.unscheduledRow}>
                      <Text style={styles.unscheduledTitle}>{item.title}</Text>
                      <Text style={styles.unscheduledReason}>{item.reason}</Text>
                    </View>
                  ))}
                </FadeInView>
              </>
            )}

            {warnings.length > 0 && (
              <FadeInView delay={1350}>
                {warnings.map((warning, index) => (
                  <Text key={index} style={styles.warning}>{warning}</Text>
                ))}
              </FadeInView>
            )}
          </>
        )}

        {todayPlan && planStatus === "completed" && (
          <>
            <FadeInView delay={400}>
              <Text style={styles.completedTitle}>day complete.</Text>
            </FadeInView>

            <FadeInView delay={550}>
              <Text style={styles.completedSubtitle}>
                {completedToday} commitment{completedToday !== 1 ? "s" : ""} kept.
              </Text>
            </FadeInView>

            <FadeInView delay={700} style={styles.dividerContainer}>
              <Divider />
            </FadeInView>

            <FadeInView delay={850}>
              <Text style={styles.sectionTitle}>today's commitments</Text>
            </FadeInView>

            <FadeInView delay={1000}>
              {displayCommitments.map((commitment) => (
                <CommitmentRow
                  key={commitment.id}
                  commitment={commitment}
                  sessionCount={sessionCountFor(commitment.title)}
                  isCalendar={commitment.id.startsWith("cal-")}
                  onPress={() => navigation.navigate("Commitment", { commitmentId: commitment.id })}
                />
              ))}
            </FadeInView>
          </>
        )}

        {todayPlan && planStatus === "archived" && (
          <>
            <FadeInView delay={400}>
              <Text style={styles.completedTitle}>this day is archived.</Text>
            </FadeInView>

            <FadeInView delay={550}>
              <Text style={styles.completedSubtitle}>
                {completedToday} commitment{completedToday !== 1 ? "s" : ""} were kept.
              </Text>
            </FadeInView>
          </>
        )}
      </ScrollView>

      <FadeInView delay={1100} style={styles.footer}>
        {todayPlan && planStatus === "draft" && !showFullSchedule && dayState.phase === "active_commitment" && dayState.currentCommitment && (
          <>
            <Pressable style={styles.primaryButton} onPress={handleLooksGood}>
              <Text style={styles.primaryButtonText}>looks good</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setShowFullSchedule(true)}>
              <Text style={styles.secondaryButtonText}>view today's schedule</Text>
            </Pressable>
          </>
        )}

        {todayPlan && planStatus === "draft" && (showFullSchedule || !(dayState.phase === "active_commitment" && dayState.currentCommitment)) && (
          <>
            <Pressable style={styles.primaryButton} onPress={handleLooksGood}>
              <Text style={styles.primaryButtonText}>looks good</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={handleAdjustToday}>
              <Text style={styles.secondaryButtonText}>adjust today</Text>
            </Pressable>
          </>
        )}

        {todayPlan && planStatus === "active" && !showFullSchedule && dayState.phase === "active_commitment" && dayState.currentCommitment && (
          <>
            <Pressable style={styles.primaryButton} onPress={handleAdjustToday}>
              <Text style={styles.primaryButtonText}>adjust today</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setShowFullSchedule(true)}>
              <Text style={styles.secondaryButtonText}>view today's schedule</Text>
            </Pressable>
          </>
        )}

        {todayPlan && planStatus === "active" && (showFullSchedule || !(dayState.phase === "active_commitment" && dayState.currentCommitment)) && (
          <Pressable style={styles.primaryButton} onPress={handleAdjustToday}>
            <Text style={styles.primaryButtonText}>adjust today</Text>
          </Pressable>
        )}

        <Pressable style={styles.resetButton} onPress={handleReset}>
          <Text style={styles.resetButtonText}>reset forge</Text>
        </Pressable>
      </FadeInView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
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
  contextLine: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    lineHeight: 28,
    marginBottom: Spacing.lg,
  },
  briefSection: {
    marginBottom: 8,
  },
  briefFocus: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
    lineHeight: 28,
    marginBottom: 8,
  },
  briefEncouragement: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    lineHeight: 24,
    marginBottom: 8,
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
  unscheduledRow: {
    marginBottom: 8,
  },
  unscheduledTitle: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  unscheduledReason: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    marginTop: 2,
  },
  warning: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    marginTop: 8,
  },
  activeCommitmentCard: {
    marginTop: 24,
    gap: 12,
  },
  activeLabel: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  activeTitle: {
    fontSize: Typography.hero,
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  activeTimeRange: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
    letterSpacing: 2,
  },
  activeDividerContainer: {
    marginVertical: 8,
  },
  activeRemaining: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  completedTitle: {
    fontSize: Typography.title,
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
    letterSpacing: -0.5,
    marginBottom: Spacing.sm,
  },
  completedSubtitle: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
    lineHeight: 28,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  secondaryButton: {
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  resetButton: {
    paddingVertical: 8,
    alignItems: "center",
  },
  resetButtonText: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
});
