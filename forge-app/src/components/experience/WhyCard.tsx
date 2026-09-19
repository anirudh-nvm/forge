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
  confidenceScore?: number;
};

const REASON_EXPLANATIONS: Record<string, string[]> = {
  after_fixed_event: [
    "it flows naturally from what comes before.",
    "right after your fixed event — no reason to move it.",
    "it fits where it is.",
  ],
  before_dinner: [
    "i kept it before dinner so the evening stays open.",
    "before dinner — you asked for that.",
    "dinner is at 8, so this fits nicely before.",
  ],
  preferred_time_window: [
    "this is your preferred window.",
    "i put it where you usually focus best.",
    "your sweet spot — afternoon energy.",
  ],
  afternoon_preference: [
    "afternoon is when you do your best work.",
    "i placed it in the afternoon.",
    "this fits your afternoon rhythm.",
  ],
  morning_preference: [
    "morning energy is your edge.",
    "i put it in the morning where you're sharpest.",
    "this starts your day right.",
  ],
  evening_preference: [
    "evening works for this.",
    "i placed it in the evening.",
    "this wraps up your day.",
  ],
  close_to_existing: [
    "near other commitments — context stays fresh.",
    "i kept it close to similar work.",
    "proximity helps you stay in flow.",
  ],
  avoiding_early: [
    "i avoided the early morning hours.",
    "no need to start that early.",
    "you don't need to be up at 6 for this.",
  ],
  avoiding_late: [
    "i avoided placing this too late.",
    "you don't want this running into the night.",
    "kept it before things get too late.",
  ],
  after_recovery: [
    "i gave you a break before this — you don't need to run on empty.",
    "pacing matters. this comes after a recovery.",
    "you need time to reset before this.",
  ],
  near_related: [
    "i put this near similar work — context stays fresh.",
    "related tasks together help you stay in flow.",
    "keeping this next to similar work.",
  ],
  late_afternoon: [
    "late afternoon works well for this.",
    "i shifted it to the later part of the day.",
    "this fits the late afternoon slot.",
  ],
  first_thing: [
    "first thing — before anything else fills the morning.",
    "i put this at the start of your day.",
    "this opens your morning.",
  ],
  before_bedtime: [
    "before bedtime — you wanted this done before sleeping.",
    "i kept this before you wind down.",
    "this wraps up before sleep.",
  ],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getConfidenceLabel(score?: number): { label: string; color: string } {
  if (!score) return { label: "understood", color: Colors.secondary };
  if (score >= 0.9) return { label: "very clear", color: Colors.secondary };
  if (score >= 0.7) return { label: "pretty clear", color: Colors.secondary };
  if (score >= 0.5) return { label: "somewhat clear", color: Colors.muted };
  return { label: "needs clarification", color: Colors.muted };
}

function translateReason(reason: string): string {
  const explanations = REASON_EXPLANATIONS[reason];
  if (explanations) return pickRandom(explanations);
  return reason.replace(/_/g, " ");
}

export default function WhyCard({
  lifeDirection,
  goal,
  project,
  placementReasons = [],
  experiment,
  confidence,
  confidenceScore,
}: WhyCardProps) {
  const hasIdentity = lifeDirection || goal || project;
  const hasReasons = placementReasons.length > 0;
  const hasExperiment = !!experiment;
  const hasConfidence = !!confidence || !!confidenceScore;

  if (!hasIdentity && !hasReasons && !hasExperiment && !hasConfidence) {
    return null;
  }

  const confidenceInfo = getConfidenceLabel(confidenceScore);

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
              {translateReason(reason)}
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
          <Text style={styles.sectionLabel}>how well i understood you</Text>
          <Text style={[styles.confidenceText, { color: confidenceInfo.color }]}>
            {confidenceInfo.label}
          </Text>
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
