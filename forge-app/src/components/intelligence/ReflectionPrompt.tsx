import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import { Spacing } from "../../constants/spacing";
import FadeInView from "../ui/FadeInView";

export interface ReflectionPromptData {
  observationText: string;
  question: string;
  context?: string;
}

interface ReflectionPromptProps {
  prompt: ReflectionPromptData;
}

export default function ReflectionPrompt({ prompt }: ReflectionPromptProps) {
  return (
    <FadeInView delay={200} style={styles.card}>
      <Text style={styles.label}>I noticed something.</Text>

      <View style={styles.spacer} />

      <Text style={styles.observation}>{prompt.observationText}</Text>

      <View style={styles.spacer} />

      <Text style={styles.question}>{prompt.question}</Text>

      {prompt.context ? (
        <>
          <View style={styles.spacer} />
          <Text style={styles.context}>{prompt.context}</Text>
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
  label: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.medium,
    color: Colors.muted,
    fontStyle: "italic",
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
    color: Colors.primary,
    lineHeight: 24,
  },
  context: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    lineHeight: 20,
  },
  spacer: {
    height: Spacing.sm,
  },
});
