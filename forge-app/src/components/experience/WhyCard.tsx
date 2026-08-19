import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";

type WhyCardProps = {
  lifeDirection?: string;
  goal?: string;
  project?: string;
  placementReasons?: string[];
  experiment?: string;
  confidence?: "low" | "medium" | "high";
};

const REASON_LABELS: Record<string, string> = {
  after_fixed_event: "after a fixed event",
  before_dinner: "before dinner",
  preferred_time_window: "preferred study window",
  afternoon_preference: "afternoon preference",
  morning_preference: "morning preference",
  evening_preference: "evening preference",
  close_to_existing: "near other commitments",
  avoiding_early: "avoiding early morning",
  avoiding_late: "avoiding late night",
};

function translateReason(reason: string): string {
  return REASON_LABELS[reason] || reason.replace(/_/g, " ");
}

export default function WhyCard({
  lifeDirection,
  goal,
  project,
  placementReasons = [],
  experiment,
  confidence,
}: WhyCardProps) {
  const hasIdentity = lifeDirection || goal || project;
  const hasReasons = placementReasons.length > 0;
  const hasExperiment = !!experiment;
  const hasConfidence = !!confidence;

  if (!hasIdentity && !hasReasons && !hasExperiment && !hasConfidence) {
    return null;
  }

  return (
    <View style={styles.container}>
      {hasIdentity && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>why this exists</Text>
          <View style={styles.identityChain}>
            {lifeDirection && (
              <Text style={styles.identityItem}>{lifeDirection}</Text>
            )}
            {goal && (
              <>
                <Text style={styles.arrow}>↓</Text>
                <Text style={styles.identityItem}>{goal}</Text>
              </>
            )}
            {project && (
              <>
                <Text style={styles.arrow}>↓</Text>
                <Text style={styles.identityItem}>{project}</Text>
              </>
            )}
          </View>
        </View>
      )}

      {hasReasons && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>why this time</Text>
          {placementReasons.map((reason, index) => (
            <Text key={index} style={styles.reasonItem}>
              • {translateReason(reason)}
            </Text>
          ))}
        </View>
      )}

      {hasExperiment && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>current experiment</Text>
          <Text style={styles.experimentText}>{experiment}</Text>
        </View>
      )}

      {hasConfidence && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>confidence</Text>
          <Text style={styles.confidenceText}>{confidence}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    textTransform: "lowercase",
    marginBottom: 8,
  },
  identityChain: {
    gap: 4,
  },
  identityItem: {
    fontSize: Typography.body,
    fontFamily: FontFamily.medium,
    color: Colors.primary,
  },
  arrow: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    marginLeft: 4,
  },
  reasonItem: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
    lineHeight: 24,
  },
  experimentText: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
  },
  confidenceText: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.medium,
    color: Colors.primary,
  },
});
