import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import { Spacing } from "../../constants/spacing";
import FadeInView from "../ui/FadeInView";
import type { HigherSelfMessage } from "../../memory/HigherSelf";

interface HigherSelfCardProps {
  message: HigherSelfMessage;
}

export default function HigherSelfCard({ message }: HigherSelfCardProps) {
  return (
    <FadeInView delay={200} style={styles.card}>
      <Text style={styles.text} accessibilityRole="text" accessibilityLabel={`Forge says: ${message.text}`}>
        {message.text}
      </Text>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  text: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
    lineHeight: 24,
    fontStyle: "italic",
  },
});
