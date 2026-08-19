import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import { Spacing } from "../../constants/spacing";
import FadeInView from "../ui/FadeInView";

export interface ForgeMomentData {
  greeting: string;
  observation: string;
  question: string;
}

interface ForgeMomentCardProps {
  moment: ForgeMomentData;
}

export default function ForgeMomentCard({ moment }: ForgeMomentCardProps) {
  const accessibilityLabel = `${moment.greeting} ${moment.observation} ${moment.question}`;

  return (
    <FadeInView delay={100} style={styles.card}>
      <Text
        style={styles.greeting}
        accessibilityRole="header"
      >
        {moment.greeting}
      </Text>

      <View style={styles.spacer} />

      <Text
        style={styles.observation}
        accessibilityLabel={moment.observation}
      >
        {moment.observation}
      </Text>

      {moment.question ? (
        <>
          <View style={styles.spacer} />
          <Text
            style={styles.question}
            accessibilityRole="button"
            accessibilityHint="Tap to respond"
          >
            {moment.question}
          </Text>
        </>
      ) : null}
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  greeting: {
    fontSize: Typography.title,
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  observation: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
    lineHeight: 28,
  },
  question: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    lineHeight: 24,
  },
  spacer: {
    height: Spacing.sm,
  },
});
