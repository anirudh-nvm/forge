import { Pressable, Text, View, StyleSheet } from "react-native";
import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import { Commitment } from "../../types/commitment";

type Props = {
  commitment: Commitment;
  onPress?: () => void;
  sessionCount?: number;
  isCalendar?: boolean;
};

const REASON_SUBTITLES: Record<string, string[]> = {
  after_fixed_event: ["right after your fixed event", "flows from what comes before"],
  after_recovery: ["after a recovery break", "pacing matters"],
  preferred_time_window: ["in your preferred window", "your sweet spot"],
  before_dinner: ["before dinner", "evening stays open"],
  near_related: ["near similar work", "context stays fresh"],
  late_afternoon: ["late afternoon slot", "later in the day"],
  morning_preference: ["morning energy", "when you're sharpest"],
  evening_preference: ["evening slot", "wraps up your day"],
  first_thing: ["first thing", "before anything else"],
  before_bedtime: ["before bedtime", "before you wind down"],
};

function getSubtitle(commitment: Commitment): string | null {
  const reasons = commitment.placementReasons ?? [];
  for (const reason of reasons) {
    const options = REASON_SUBTITLES[reason];
    if (options) {
      return options[Math.floor(Math.random() * options.length)];
    }
  }
  return null;
}

function getConfidenceDot(score?: number): { color: string; label: string } | null {
  if (!score) return null;
  if (score >= 0.9) return { color: Colors.secondary, label: "clear" };
  if (score >= 0.7) return { color: Colors.secondary, label: "good" };
  if (score >= 0.5) return { color: Colors.muted, label: "partial" };
  return { color: Colors.muted, label: "unclear" };
}

export default function CommitmentRow({ commitment, onPress, sessionCount, isCalendar }: Props) {
  const multiSession = !!sessionCount && sessionCount > 1;
  const subtitle = getSubtitle(commitment);
  const confidence = getConfidenceDot(commitment.confidence);
  return (
    <Pressable onPress={onPress} style={styles.container}>
      <View style={[styles.circle, isCalendar && styles.calendarCircle]}>
        {isCalendar && <Text style={styles.calendarIcon}>C</Text>}
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{commitment.title}</Text>
        {multiSession ? (
          <Text style={styles.time}>{sessionCount} sessions today</Text>
        ) : (
          <Text style={styles.time}>{commitment.startTime} – {commitment.endTime}</Text>
        )}
        {subtitle && !multiSession && (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}
      </View>
      <View style={styles.rightSection}>
        {confidence && commitment.confidence !== undefined && commitment.confidence < 0.7 && (
          <View style={[styles.confidenceDot, { backgroundColor: confidence.color }]} />
        )}
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  circle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.muted,
  },
  calendarCircle: {
    borderColor: Colors.secondary,
    backgroundColor: "transparent",
  },
  calendarIcon: {
    fontSize: 7,
    fontFamily: FontFamily.semibold,
    color: Colors.secondary,
    textAlign: "center",
    lineHeight: 12,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.primary,
  },
  time: {
    fontSize: Typography.subheadline,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    marginTop: 2,
  },
  subtitle: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
    opacity: 0.7,
    marginTop: 2,
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chevron: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
});