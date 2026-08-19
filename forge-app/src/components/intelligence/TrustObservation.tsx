import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import { Spacing } from "../../constants/spacing";
import FadeInView from "../ui/FadeInView";

export interface TrustObservationData {
  score: number;
  level: string;
  trajectory: "improving" | "stable" | "declining";
  streakMessage?: string;
}

interface TrustObservationProps {
  trust: TrustObservationData;
}

function getTrajectorySymbol(trajectory: string): string {
  if (trajectory === "improving") return "↑";
  if (trajectory === "declining") return "↓";
  return "→";
}

export default function TrustObservation({ trust }: TrustObservationProps) {
  const symbol = getTrajectorySymbol(trust.trajectory);

  return (
    <FadeInView delay={300} style={styles.container}>
      <View style={styles.row} accessibilityRole="text" accessibilityLabel={`Trust: ${trust.score} out of 100, ${trust.level}, ${trust.trajectory}`}>
        <Text style={styles.score}>{trust.score}</Text>
        <Text style={styles.symbol}>{symbol}</Text>
        <Text style={styles.level}>{trust.level}</Text>
      </View>
      {trust.streakMessage ? (
        <Text style={styles.streak} accessibilityRole="text">
          {trust.streakMessage}
        </Text>
      ) : null}
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.sm,
  },
  score: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
  },
  symbol: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  level: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  streak: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    marginTop: Spacing.xs,
  },
});
