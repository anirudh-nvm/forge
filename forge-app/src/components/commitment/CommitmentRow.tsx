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

export default function CommitmentRow({ commitment, onPress, sessionCount, isCalendar }: Props) {
  const multiSession = !!sessionCount && sessionCount > 1;
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
      </View>
      <Text style={styles.chevron}>›</Text>
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
  chevron: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
});