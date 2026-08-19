import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "@/types/navigation";

import { Colors } from "../constants/colors";
import { FontFamily, Typography } from "../constants/typography";
import Divider from "../components/ui/Divider";
import FadeInView from "../components/ui/FadeInView";
import WhyCard from "../components/experience/WhyCard";
import { useForge } from "../context/ForgeContext";
import { getContextForCommitment } from "../identity/IdentityEngine";

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

function isCommitmentActive(startTime: string, endTime: string): boolean {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  return start !== -1 && end !== -1 && nowMinutes >= start && nowMinutes <= end;
}

type Nav = NativeStackNavigationProp<RootStackParamList, "Commitment">;
type Route = RouteProp<RootStackParamList, "Commitment">;

export default function CommitmentScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { todayPlan, isLoading, adjustPlan, startSession } = useForge();
  const commitment = todayPlan?.commitments.find((c) => c.id === route.params.commitmentId);
  const note = commitment?.note || "let's make this work.";

  const context = commitment ? getContextForCommitment(commitment.title) : undefined;

  const handleMoveEarlier = () => {
    if (!commitment) return;
    adjustPlan({ type: "moveEarlier", taskId: commitment.id, minutes: 30 });
  };

  const handleMoveLater = () => {
    if (!commitment) return;
    adjustPlan({ type: "moveLater", taskId: commitment.id, minutes: 30 });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!commitment) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>commitment not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const instances = (todayPlan?.commitments ?? []).filter(c =>
    c.title.trim().toLowerCase() === commitment.title.trim().toLowerCase()
  );
  const activeInstance = instances.find(i => isCommitmentActive(i.startTime, i.endTime));

  const handleBegin = (id: string) => {
    startSession(id);
    navigation.navigate("Session");
  };

  if (instances.length > 1) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <FadeInView delay={100}>
            <Text style={styles.title}>{commitment.title}</Text>
          </FadeInView>

          <FadeInView delay={200}>
            <Text style={styles.instancesLabel}>
              {instances.length} sessions today
            </Text>
          </FadeInView>

          <FadeInView delay={300}>
            {instances.map((instance, index) => {
              const running = isCommitmentActive(instance.startTime, instance.endTime);
              const reasonText = (instance.placementReasons ?? [])
                .map((r) => r.replace(/_/g, " "))
                .join(", ");
              const confidence = instance.confidence !== undefined
                ? `${Math.round(instance.confidence * 100)}% confidence`
                : null;
              return (
                <View key={instance.id} style={styles.instanceCard}>
                  <View style={styles.instanceRow}>
                    <View style={styles.instanceText}>
                      <Text style={styles.instanceTime}>
                        {instance.startTime} – {instance.endTime}
                      </Text>
                      {running && (
                        <Text style={styles.instanceRunning}>running now</Text>
                      )}
                    </View>
                    {running ? (
                      <Pressable style={styles.beginButton} onPress={() => handleBegin(instance.id)}>
                        <Text style={styles.beginButtonText}>begin</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.instanceIndex}>session {index + 1}</Text>
                    )}
                  </View>

                  {(reasonText || confidence) && (
                    <View style={styles.instanceDetail}>
                      {reasonText ? (
                        <Text style={styles.instanceReason}>why this time: {reasonText}</Text>
                      ) : null}
                      {confidence ? (
                        <Text style={styles.instanceConfidence}>{confidence}</Text>
                      ) : null}
                    </View>
                  )}
                </View>
              );
            })}
          </FadeInView>
        </View>

        <FadeInView delay={500} style={styles.footer}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← back</Text>
          </Pressable>
        </FadeInView>
      </SafeAreaView>
    );
  }

  const active = isCommitmentActive(commitment.startTime, commitment.endTime);

  if (active) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.activeContent}>
          <FadeInView delay={200}>
            <Text style={styles.activeLabel}>it's time.</Text>
          </FadeInView>

          <FadeInView delay={400}>
            <Text style={styles.activeTitle}>{commitment.title}</Text>
          </FadeInView>

          <FadeInView delay={600}>
            <Text style={styles.activeTimeRange}>
              {commitment.startTime} – {commitment.endTime}
            </Text>
          </FadeInView>

          <FadeInView delay={800} style={styles.activeDividerContainer}>
            <Divider />
          </FadeInView>

          <FadeInView delay={1000}>
            <Text style={styles.activeRemaining}>
              {(() => {
                const end = parseTimeToMinutes(commitment.endTime);
                const now = new Date();
                const nowMins = now.getHours() * 60 + now.getMinutes();
                const mins = Math.max(0, end - nowMins);
                if (mins <= 0) return "finishing up.";
                if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""} remaining.`;
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                return m > 0 ? `${h}h ${m}m remaining.` : `${h} hour${h !== 1 ? "s" : ""} remaining.`;
              })()}
            </Text>
          </FadeInView>
        </View>

        <FadeInView delay={1200} style={styles.footer}>
          <Pressable style={styles.primaryButton} onPress={() => handleBegin(commitment.id)}>
            <Text style={styles.primaryButtonText}>begin</Text>
          </Pressable>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← back</Text>
          </Pressable>
        </FadeInView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <FadeInView delay={100}>
          <View style={styles.circle} />
        </FadeInView>

        <FadeInView delay={200}>
          <Text style={styles.title}>{commitment.title}</Text>
        </FadeInView>

        <FadeInView delay={300}>
          <Text style={styles.timeRange}>
            {commitment.startTime} – {commitment.endTime}
          </Text>
        </FadeInView>

        <FadeInView delay={400} style={styles.dividerContainer}>
          <View style={styles.divider} />
        </FadeInView>

        <FadeInView delay={500}>
          <Text style={styles.note}>{note}</Text>
        </FadeInView>

        <FadeInView delay={550}>
          <WhyCard
            lifeDirection={context?.goalTitle}
            goal={context?.projectTitle}
            project={context?.taskTitle}
            placementReasons={commitment.placementReasons}
          />
        </FadeInView>

        <FadeInView delay={600} style={styles.dividerContainer}>
          <View style={styles.divider} />
        </FadeInView>

        <FadeInView delay={700} style={styles.actions}>
          <Pressable style={styles.action} onPress={handleMoveEarlier}>
            <Text style={styles.actionText}>move earlier</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={() => handleBegin(commitment.id)}>
            <Text style={[styles.actionText, styles.actionPrimary]}>keep this</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={handleMoveLater}>
            <Text style={styles.actionText}>move later</Text>
          </Pressable>
        </FadeInView>
      </View>

      <FadeInView delay={800} style={styles.footer}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← back</Text>
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
  },
  emptyText: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    justifyContent: "center",
  },
  circle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.muted,
    marginBottom: 20,
  },
  title: {
    fontSize: Math.round(Typography.title * 1.1),
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  timeRange: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    marginBottom: 24,
  },
  dividerContainer: {
    marginVertical: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    width: "100%",
  },
  note: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    lineHeight: 26,
  },
  actions: {
    gap: 16,
    marginTop: 8,
  },
  action: {
    paddingVertical: 4,
  },
  actionText: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  actionPrimary: {
    fontFamily: FontFamily.medium,
    color: Colors.primary,
    fontSize: Typography.body,
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
  backButton: {
    paddingVertical: 8,
    alignItems: "center",
  },
  backText: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  activeContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    justifyContent: "center",
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
  instancesLabel: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    marginBottom: 8,
  },
  instanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  instanceCard: {
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  instanceDetail: {
    paddingBottom: 14,
    gap: 4,
  },
  instanceReason: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  instanceConfidence: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.medium,
    color: Colors.secondary,
  },
  instanceText: {
    gap: 2,
  },
  instanceTime: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.primary,
  },
  instanceRunning: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
  },
  instanceIndex: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  beginButton: {
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  beginButtonText: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.primary,
  },
});
