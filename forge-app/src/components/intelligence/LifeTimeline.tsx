import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import { Spacing } from "../../constants/spacing";
import FadeInView from "../ui/FadeInView";
import type { Milestone } from "../../memory/MilestoneEngine";

interface LifeTimelineProps {
  milestones: Milestone[];
}

function getCategoryColor(category: string): string {
  switch (category) {
    case "first_use":
      return Colors.primary;
    case "session_count":
      return "#7BAF6E";
    case "trust_milestone":
      return "#D4A574";
    case "streak":
      return "#B88ED4";
    case "experiment":
      return "#6EB0AF";
    case "setback":
      return "#D48E8E";
    case "recovery":
      return "#AFD48E";
    case "consistency":
      return "#8EAFD4";
    default:
      return Colors.muted;
  }
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case "first_use":
      return "beginning";
    case "session_count":
      return "sessions";
    case "trust_milestone":
      return "trust";
    case "streak":
      return "streak";
    case "experiment":
      return "experiment";
    case "setback":
      return "challenge";
    case "recovery":
      return "recovery";
    case "consistency":
      return "patterns";
    default:
      return "";
  }
}

export default function LifeTimeline({ milestones }: LifeTimelineProps) {
  if (milestones.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText} accessibilityRole="text">
          Your story is just beginning. Every commitment adds to it.
        </Text>
      </View>
    );
  }

  const grouped = milestones.reduce<Record<string, Milestone[]>>((acc, m) => {
    if (!acc[m.month]) acc[m.month] = [];
    acc[m.month].push(m);
    return acc;
  }, {});

  const months = Object.keys(grouped);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <FadeInView delay={100}>
        <Text style={styles.header} accessibilityRole="header">your story</Text>
      </FadeInView>

      {months.map((month, monthIndex) => (
        <FadeInView key={month} delay={200 + monthIndex * 100} style={styles.monthGroup}>
          <Text style={styles.monthLabel}>{month}</Text>

          {grouped[month].map((milestone, i) => {
            const color = getCategoryColor(milestone.category);
            const label = getCategoryLabel(milestone.category);

            return (
              <View key={milestone.id} style={styles.milestoneRow}>
                <View style={styles.timeline}>
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  {i < grouped[month].length - 1 || monthIndex < months.length - 1 ? (
                    <View style={[styles.line, { backgroundColor: Colors.divider }]} />
                  ) : null}
                </View>

                <View style={styles.content}>
                  {label ? (
                    <Text style={[styles.categoryLabel, { color }]}>{label}</Text>
                  ) : null}
                  <Text style={styles.title}>{milestone.title}</Text>
                  <Text style={styles.description}>{milestone.description}</Text>
                </View>
              </View>
            );
          })}
        </FadeInView>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: {
    fontSize: Typography.title,
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
    letterSpacing: -0.5,
    marginBottom: Spacing.xl,
  },
  empty: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    textAlign: "center",
    lineHeight: 24,
  },
  monthGroup: {
    marginBottom: Spacing.lg,
  },
  monthLabel: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.medium,
    color: Colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  milestoneRow: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  timeline: {
    width: 20,
    alignItems: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  line: {
    width: 1,
    flex: 1,
    marginTop: 4,
  },
  content: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  categoryLabel: {
    fontSize: Typography.caption,
    fontFamily: FontFamily.medium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  title: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.primary,
    marginBottom: 2,
  },
  description: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    lineHeight: 20,
  },
});
