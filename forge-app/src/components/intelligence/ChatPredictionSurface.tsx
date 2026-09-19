import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import type { Prediction } from "../../memory/PredictionEngine";
import { formatPredictionsForChat } from "../../intelligence/chatPredictions";

type Props = {
  predictions: Prediction[];
  visible?: boolean;
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getPredictionTone(type: Prediction["type"]): string {
  switch (type) {
    case "reschedule":
      return pickRandom(["heads up,", "just so you know,", "fair warning,"]);
    case "adjust_duration":
      return pickRandom(["based on your patterns,", "you usually take longer,"]);
    case "add_buffer":
      return pickRandom(["you might want to add buffer,", "based on past sessions,"]);
    case "skip_warning":
      return pickRandom(["i've noticed a trend,", "looking at your history,"]);
  }
}

function getPredictionIcon(type: Prediction["type"]): string {
  switch (type) {
    case "reschedule":
      return pickRandom(["📅", "🔄"]);
    case "adjust_duration":
      return pickRandom(["⏱️", "⏰"]);
    case "add_buffer":
      return pickRandom(["➕", "🕐"]);
    case "skip_warning":
      return pickRandom(["⚠️", "💡"]);
  }
}

export { formatPredictionsForChat };

export default function ChatPredictionSurface({ predictions, visible = true }: Props) {
  if (!visible || predictions.length === 0) return null;

  const topPredictions = predictions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 2);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>based on your patterns</Text>
      {topPredictions.map((prediction, index) => (
        <View key={index} style={styles.predictionRow}>
          <Text style={styles.icon}>{getPredictionIcon(prediction.type)}</Text>
          <View style={styles.textBlock}>
            <Text style={styles.tone}>{getPredictionTone(prediction.type)}</Text>
            <Text style={styles.suggestion}>{prediction.suggestion.toLowerCase()}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  label: {
    fontSize: Typography.caption,
    fontFamily: FontFamily.medium,
    color: Colors.muted,
    textTransform: "lowercase",
    marginBottom: 8,
  },
  predictionRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  icon: {
    fontSize: Typography.subheadline,
    marginTop: 2,
  },
  textBlock: {
    flex: 1,
  },
  tone: {
    fontSize: Typography.caption,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    marginBottom: 2,
  },
  suggestion: {
    fontSize: Typography.subheadline,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
    lineHeight: 20,
  },
});
