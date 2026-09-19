import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import type { TrustScore } from "../../types/todayPlan";

type Props = {
  trustScore: TrustScore;
};

function getTrustLevel(score: number): string {
  if (score >= 80) return "strong";
  if (score >= 60) return "building";
  if (score >= 40) return "developing";
  if (score >= 20) return "recovering";
  return "rebuilding";
}

function getTrajectory(history: TrustScore["history"]): "improving" | "stable" | "declining" {
  const recent = history.slice(-5);
  if (recent.length < 2) return "stable";
  const avgChange = recent.reduce((sum, e) => sum + e.trustChange, 0) / recent.length;
  if (avgChange > 2) return "improving";
  if (avgChange < -2) return "declining";
  return "stable";
}

function getTrajectoryMessage(trajectory: "improving" | "stable" | "declining"): string {
  switch (trajectory) {
    case "improving":
      return pickRandom([
        "you're building momentum.",
        "trust is growing.",
        "you're becoming more consistent.",
      ]);
    case "declining":
      return pickRandom([
        "you've had a rough stretch.",
        "trust takes time to rebuild.",
        "let's get back on track.",
      ]);
    default:
      return pickRandom([
        "trust is steady.",
        "you're holding steady.",
        "consistent so far.",
      ]);
  }
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getStreakMessage(history: TrustScore["history"]): string | null {
  if (history.length === 0) return null;

  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].outcome === "completed") {
      streak++;
    } else {
      break;
    }
  }

  if (streak >= 5) {
    return pickRandom([
      `${streak} in a row — you're on fire.`,
      `${streak} promises kept — that's rare.`,
      `${streak} completions straight — keep going.`,
    ]);
  }

  if (streak >= 3) {
    return pickRandom([
      `${streak} in a row — nice streak.`,
      `${streak} promises kept — momentum is real.`,
    ]);
  }

  return null;
}

export default function TrustEvolution({ trustScore }: Props) {
  const level = getTrustLevel(trustScore.current);
  const trajectory = getTrajectory(trustScore.history);
  const trajectoryMessage = getTrajectoryMessage(trajectory);
  const streakMessage = getStreakMessage(trustScore.history);

  // Calculate trend arrow
  let trendArrow = "→";
  if (trajectory === "improving") trendArrow = "↑";
  if (trajectory === "declining") trendArrow = "↓";

  return (
    <View style={styles.container}>
      <Text style={styles.label}>trust</Text>

      <View style={styles.scoreRow}>
        <Text style={styles.score}>{trustScore.current}</Text>
        <Text style={styles.arrow}>{trendArrow}</Text>
        <Text style={styles.level}>{level}</Text>
      </View>

      <Text style={styles.trajectory}>{trajectoryMessage}</Text>

      {streakMessage && (
        <Text style={styles.streak}>{streakMessage}</Text>
      )}

      {trustScore.history.length >= 3 && (
        <Text style={styles.history}>
          {trustScore.history.length} sessions tracked
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  label: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    textTransform: "lowercase",
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 8,
  },
  score: {
    fontSize: Typography.title,
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
  },
  arrow: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
  },
  level: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
  },
  trajectory: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    lineHeight: 24,
  },
  streak: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
    lineHeight: 24,
    marginTop: 8,
  },
  history: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    marginTop: 8,
  },
});
