import { useState } from "react";
import Screen from "../components/ui/Screen";
import { Title, Body } from "../components/ui/Typography";
import { View, Text, StyleSheet } from "react-native";
import { Spacing } from "../constants/spacing";
import { Colors } from "../constants/colors";
import { FontFamily, Typography } from "../constants/typography";
import Divider from "../components/ui/Divider";
import Button from "../components/ui/Button";
import FadeInView from "../components/ui/FadeInView";
import IdentityCard from "../components/intelligence/IdentityCard";
import SessionStreak from "../components/intelligence/SessionStreak";
import TaskCheckInModal from "../components/modals/TaskCheckInModal";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/types/navigation";
import { useForge } from "../context/ForgeContext";
import { useCurrentTime } from "../hooks/useCurrentTime";
import {
  getSessionState,
  getTimeUntilSession,
  getTimeRemainingInSession,
  formatCountdown,
} from "../engine/SessionEngine";
import { getOutcomeMessage } from "../engine/PromiseEngine";
import { getTrustMessage } from "../engine/TrustEngine";
import { buildIdentityCard, buildSessionStreak } from "../intelligence/IntelligenceBuilder";
import { addTaskCheckIn } from "../ai/ConversationThreadEngine";
import type { IdentityProgress } from "../identity/IdentityTypes";
import type { TaskCheckInResponse } from "../types/companion";

type Nav = NativeStackNavigationProp<RootStackParamList, "Session">;

export default function SessionScreen() {
  const navigation = useNavigation<Nav>();
  const {
    currentSession,
    isLoading,
    completeSession,
    trustScore,
    recoveryMessage,
    resumeAbandonedSession,
    completedCommitments,
  } = useForge();
  const currentTime = useCurrentTime();
  const [showCheckIn, setShowCheckIn] = useState(false);

  if (isLoading) {
    return (
      <Screen>
        <Body>loading...</Body>
      </Screen>
    );
  }

  if (!currentSession) {
    return (
      <Screen>
        <Body>no active session.</Body>
      </Screen>
    );
  }

  const sessionState = getSessionState(currentSession, currentTime);
  const timeUntil = getTimeUntilSession(currentSession, currentTime);
  const timeRemaining = getTimeRemainingInSession(currentSession, currentTime);

  const identityCard = buildIdentityCard(
    {
      trustScore,
      observations: [],
      memory: {
        stable: { lifeSeason: "", priorities: [], values: [], rhythm: { preferredWakeTime: "", preferredSleepTime: "", studyPreference: "morning" }, constraints: [], lastUpdated: "" },
        working: { weekOf: "", activeGoals: [], currentExperiments: [], activeFocus: [], recentDecisions: [], lastUpdated: "" },
        recent: { date: "", planId: null, observations: [], adjustments: [], reflections: [], lastUpdated: "" },
        lastBuilt: "",
      },
      identity: { lifeDirectionId: "", lifeDirectionTitle: "", goalProgress: [], generatedAt: "" },
      completedSessions: [],
    },
    currentSession.title
  );

  const streak = buildSessionStreak({
    trustScore,
    observations: [],
    memory: {
      stable: { lifeSeason: "", priorities: [], values: [], rhythm: { preferredWakeTime: "", preferredSleepTime: "", studyPreference: "morning" }, constraints: [], lastUpdated: "" },
      working: { weekOf: "", activeGoals: [], currentExperiments: [], activeFocus: [], recentDecisions: [], lastUpdated: "" },
      recent: { date: "", planId: null, observations: [], adjustments: [], reflections: [], lastUpdated: "" },
      lastBuilt: "",
    },
    identity: { lifeDirectionId: "", lifeDirectionTitle: "", goalProgress: [], generatedAt: "" },
    completedSessions: [],
  });

  if (recoveryMessage && sessionState === "active") {
    return (
      <Screen>
        <Title>{currentSession.title}</Title>

        <View style={{ height: Spacing.sm }} />

        <Body>
          {currentSession.scheduledStart} – {currentSession.scheduledEnd}
        </Body>

        {identityCard && (
          <>
            <View style={{ height: Spacing.md }} />
            <IdentityCard identity={identityCard} />
          </>
        )}

        <View style={{ height: Spacing.sm }} />

        <Divider />

        <View style={{ height: Spacing.xl }} />

        <Body style={styles.recoveryMessage}>{recoveryMessage}</Body>

        <View style={{ height: Spacing.lg }} />

        <Text style={styles.timer}>{formatCountdown(timeRemaining)}</Text>

        <View style={{ height: Spacing.xl }} />

        <Button title="Continue session" onPress={resumeAbandonedSession} />
        <View style={{ height: Spacing.sm }} />
        <Button title="Skip this one" onPress={() => completeSession("skipped")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{currentSession.title}</Title>

      <View style={{ height: Spacing.sm }} />

      <Body>
        {currentSession.scheduledStart} – {currentSession.scheduledEnd}
      </Body>

      {identityCard && (
        <>
          <View style={{ height: Spacing.md }} />
          <IdentityCard identity={identityCard} />
        </>
      )}

      <View style={{ height: Spacing.sm }} />

      <Divider />

      <View style={{ height: Spacing.xl }} />

      {sessionState === "waiting" && (
        <View>
          <FadeInView delay={100}>
            <Body style={styles.getReadyLabel}>we'll take it from here</Body>
          </FadeInView>

          <FadeInView delay={300}>
            <Text style={styles.timer}>{formatCountdown(timeUntil)}</Text>
          </FadeInView>

          <FadeInView delay={500}>
            <View style={styles.divider} />
          </FadeInView>

          <FadeInView delay={600}>
            <Body style={styles.getReadyLabel}>get ready.</Body>
          </FadeInView>

          <View style={{ height: Spacing.xl }} />

          {currentSession.message.map((paragraph, index) => (
            <Body key={index}>{paragraph}</Body>
          ))}

          <View style={{ height: Spacing.xl }} />

          <Button title="View today's schedule" onPress={() => navigation.navigate("Today")} />
        </View>
      )}

      {sessionState === "active" && (
        <View>
          <Text style={styles.timer}>{formatCountdown(timeRemaining)}</Text>

          <View style={{ height: Spacing.lg }} />

          <Body>forget everything else.</Body>

          <View style={{ height: Spacing.xl }} />

          <Button title="Continue" onPress={() => completeSession("completed")} />
          <View style={{ height: Spacing.sm }} />
          <Button title="Skip this one" onPress={() => completeSession("skipped")} />
        </View>
      )}

      {sessionState === "completed" && (
        <View>
          {currentSession.outcome ? (
            <View>
              <Body>{getOutcomeMessage(currentSession.outcome)}</Body>

              <View style={{ height: Spacing.lg }} />

              <Body style={styles.trustMessage}>{getTrustMessage(trustScore.current, trustScore.history)}</Body>

              {streak && (
                <>
                  <View style={{ height: Spacing.sm }} />
                  <SessionStreak streak={streak} />
                </>
              )}

              <View style={{ height: Spacing.xl }} />

              <Button title="Move on" onPress={() => setShowCheckIn(true)} />
              <View style={{ height: Spacing.sm }} />
              <Button title="View today's schedule" onPress={() => navigation.navigate("Today")} />
            </View>
          ) : (
            <View>
              <Body>did you keep this promise?</Body>

              <View style={{ height: Spacing.xl }} />

              <Button
                title="Yes, completed"
                onPress={() => completeSession("completed")}
              />
              <View style={{ height: Spacing.sm }} />
              <Button
                title="Mostly"
                onPress={() => completeSession("mostlyCompleted")}
              />
              <View style={{ height: Spacing.sm }} />
              <Button
                title="Not really"
                onPress={() => completeSession("notCompleted")}
              />
            </View>
          )}
        </View>
      )}

      {sessionState === "missed" && (
        <View>
          <Body>looks like today got away from us.</Body>

          <View style={{ height: Spacing.lg }} />

          <Body>let's protect the next commitment.</Body>

          <View style={{ height: Spacing.xl }} />

          <Button
            title="Skip this one"
            onPress={() => completeSession("skipped")}
          />
        </View>
      )}

      <TaskCheckInModal
        visible={showCheckIn}
        commitmentTitle={currentSession.title}
        onSelect={async (response: TaskCheckInResponse) => {
          await addTaskCheckIn(currentSession.id, response);
          setShowCheckIn(false);
          navigation.navigate("Today");
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  getReadyLabel: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    marginBottom: Spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    width: "100%",
    marginBottom: Spacing.lg,
  },
  timer: {
    fontSize: 64,
    fontFamily: FontFamily.light,
    color: Colors.primary,
    letterSpacing: -2,
    fontVariant: ["tabular-nums"],
  },
  trustMessage: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  recoveryMessage: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    lineHeight: 24,
  },
});
