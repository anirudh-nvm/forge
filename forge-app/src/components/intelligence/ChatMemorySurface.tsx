import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import { formatMemoryForLLM } from "../../intelligence/chatMemory";

export type MemoryInsight = {
  type: "pattern" | "prediction" | "belief" | "trust";
  text: string;
  confidence: number;
};

type Props = {
  insights: MemoryInsight[];
  visible?: boolean;
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getInsightLabel(type: MemoryInsight["type"]): string {
  switch (type) {
    case "pattern":
      return pickRandom(["pattern", "what i've noticed"]);
    case "prediction":
      return pickRandom(["heads up", "based on history"]);
    case "belief":
      return pickRandom(["i think", "what i believe"]);
    case "trust":
      return pickRandom(["trust", "between us"]);
  }
}

export { formatMemoryForLLM };

export default function ChatMemorySurface({ insights, visible = true }: Props) {
  if (!visible || insights.length === 0) return null;

  const topInsights = insights
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 2);

  return (
    <View style={styles.container}>
      {topInsights.map((insight, index) => (
        <View key={index} style={styles.insightRow}>
          <Text style={styles.label}>{getInsightLabel(insight.type)}</Text>
          <Text style={styles.text}>{insight.text}</Text>
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
  insightRow: {
    marginBottom: 8,
  },
  label: {
    fontSize: Typography.caption,
    fontFamily: FontFamily.medium,
    color: Colors.muted,
    textTransform: "lowercase",
    marginBottom: 2,
  },
  text: {
    fontSize: Typography.subheadline,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
    lineHeight: 20,
  },
});
