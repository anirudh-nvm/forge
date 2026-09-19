import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";

type Props = {
  lifeDirection?: string;
  goals?: { title: string; completed: number; total: number }[];
  recentWins?: string[];
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function IdentityGrowth({ lifeDirection, goals = [], recentWins = [] }: Props) {
  if (!lifeDirection && goals.length === 0 && recentWins.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>growth</Text>

      {lifeDirection && (
        <Text style={styles.direction}>{lifeDirection}</Text>
      )}

      {goals.length > 0 && (
        <View style={styles.goalsSection}>
          {goals.map((goal, index) => {
            const progress = goal.total > 0 ? goal.completed / goal.total : 0;
            const progressPercent = Math.round(progress * 100);
            return (
              <View key={index} style={styles.goalRow}>
                <Text style={styles.goalTitle}>{goal.title}</Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                </View>
                <Text style={styles.progressText}>{progressPercent}%</Text>
              </View>
            );
          })}
        </View>
      )}

      {recentWins.length > 0 && (
        <View style={styles.winsSection}>
          <Text style={styles.winsLabel}>recent wins</Text>
          {recentWins.slice(0, 2).map((win, index) => (
            <Text key={index} style={styles.winItem}>
              {win}
            </Text>
          ))}
        </View>
      )}
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
  direction: {
    fontSize: Typography.body,
    fontFamily: FontFamily.medium,
    color: Colors.primary,
    marginBottom: 12,
  },
  goalsSection: {
    gap: 8,
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  goalTitle: {
    flex: 1,
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
  },
  progressBar: {
    width: 60,
    height: 4,
    backgroundColor: Colors.divider,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.secondary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    width: 36,
    textAlign: "right",
  },
  winsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
  },
  winsLabel: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    marginBottom: 8,
  },
  winItem: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
    lineHeight: 24,
    marginBottom: 4,
  },
});
