import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import { generatePatternInsights } from "../../intelligence/patternInsights";

export type PatternInsight = {
  type: "time_preference" | "completion_rate" | "consistency" | "trust_trend" | "adjustment";
  text: string;
  confidence: number;
};

type Props = {
  insights: PatternInsight[];
};

export { generatePatternInsights };

export default function PatternInsights({ insights }: Props) {
  if (insights.length === 0) return null;

  const topInsights = insights
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>i noticed something</Text>
      {topInsights.map((insight, index) => (
        <Text key={index} style={styles.insight}>
          {insight.text}
        </Text>
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
  insight: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
    lineHeight: 24,
    marginBottom: 8,
  },
});
