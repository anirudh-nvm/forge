import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import { Spacing } from "../../constants/spacing";
import FadeInView from "../ui/FadeInView";

export interface SessionStreakData {
  completedCount: number;
  totalCount: number;
  currentStreak: number;
  message: string;
}

interface SessionStreakProps {
  streak: SessionStreakData;
}

export default function SessionStreak({ streak }: SessionStreakProps) {
  return (
    <FadeInView delay={400} style={styles.container}>
      <Text style={styles.message}>{streak.message}</Text>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  message: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    lineHeight: 22,
  },
});
