import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";

export type Prediction = {
  title: string;
  trigger: string;
  suggestion: string;
  confidence: number;
  type: "reschedule" | "adjust_duration" | "add_buffer" | "skip_warning";
};

type Props = {
  predictions: Prediction[];
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
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

function getPredictionTone(type: Prediction["type"]): string {
  switch (type) {
    case "reschedule":
      return pickRandom([
        "based on your patterns,",
        "i've noticed a trend,",
        "looking at your history,",
      ]);
    case "adjust_duration":
      return pickRandom([
        "based on your patterns,",
        "you usually take longer,",
        "your history shows,",
      ]);
    case "add_buffer":
      return pickRandom([
        "you might want to add buffer,",
        "based on past sessions,",
        "you typically need more time,",
      ]);
    case "skip_warning":
      return pickRandom([
        "heads up,",
        "just so you know,",
        "fair warning,",
      ]);
  }
}

export default function PredictionCard({ predictions }: Props) {
  if (predictions.length === 0) return null;

  // Show top 2 predictions by confidence
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
            <Text style={styles.suggestion}>{prediction.suggestion}</Text>
          </View>
        </View>
      ))}
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
    marginBottom: 12,
  },
  predictionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  icon: {
    fontSize: Typography.body,
    marginTop: 2,
  },
  textBlock: {
    flex: 1,
  },
  tone: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    marginBottom: 2,
  },
  suggestion: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
    lineHeight: 24,
  },
});
