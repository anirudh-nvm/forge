import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import type { HigherSelfMessage } from "../../memory/HigherSelf";

type Props = {
  message: HigherSelfMessage;
  visible?: boolean;
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getCategoryLabel(category: HigherSelfMessage["category"]): string {
  switch (category) {
    case "growth":
      return pickRandom(["growth", "what i've noticed"]);
    case "setback":
      return pickRandom(["between us", "i see you"]);
    case "consistency":
      return pickRandom(["consistency", "what i've seen"]);
    case "milestone":
      return pickRandom(["milestone", "you did it"]);
    case "quiet":
      return pickRandom(["reflection", "looking back"]);
  }
}

function getWeightStyle(weight: HigherSelfMessage["weight"]): object {
  switch (weight) {
    case "heavy":
      return styles.heavy;
    case "medium":
      return styles.medium;
    case "light":
      return styles.light;
  }
}

export default function HigherSelfSurface({ message, visible = true }: Props) {
  if (!visible) return null;

  return (
    <View style={[styles.container, getWeightStyle(message.weight)]}>
      <Text style={styles.label}>{getCategoryLabel(message.category)}</Text>
      <Text style={styles.text}>{message.text}</Text>
    </View>
  );
}

export function formatHigherSelfForLLM(message: HigherSelfMessage): string {
  return `\n\nHIGHER SELF INSIGHT:\n${message.text}`;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderLeftWidth: 4,
  },
  heavy: {
    borderLeftColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  medium: {
    borderLeftColor: Colors.secondary,
    backgroundColor: Colors.surface,
  },
  light: {
    borderLeftColor: Colors.muted,
    backgroundColor: Colors.surface,
  },
  label: {
    fontSize: Typography.caption,
    fontFamily: FontFamily.medium,
    color: Colors.muted,
    textTransform: "lowercase",
    marginBottom: 8,
  },
  text: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
    lineHeight: 24,
  },
});
