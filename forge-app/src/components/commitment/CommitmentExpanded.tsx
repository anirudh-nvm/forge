import { View, Text, StyleSheet, Pressable } from "react-native";

import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import FadeInView from "../ui/FadeInView";

type Props = {
  title: string;
  timeRange: string;
  note?: string;
  onMoveEarlier?: () => void;
  onKeepThis?: () => void;
  onMoveLater?: () => void;
};

export default function CommitmentExpanded({
  title,
  timeRange,
  note,
  onMoveEarlier,
  onKeepThis,
  onMoveLater,
}: Props) {
  return (
    <FadeInView delay={0} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.timeRange}>{timeRange}</Text>
      </View>

      {note && (
        <FadeInView delay={100}>
          <Text style={styles.note}>{note}</Text>
        </FadeInView>
      )}

      <View style={styles.divider} />

      <FadeInView delay={200} style={styles.actions}>
        <Pressable style={styles.action} onPress={onMoveEarlier}>
          <Text style={styles.actionText}>move Earlier</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={onKeepThis}>
          <Text style={[styles.actionText, styles.actionPrimary]}>keep This</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={onMoveLater}>
          <Text style={styles.actionText}>move Later</Text>
        </Pressable>
      </FadeInView>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.medium,
    color: Colors.primary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  timeRange: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  note: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    lineHeight: 18,
    marginBottom: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    width: "100%",
    marginVertical: 12,
  },
  actions: {
    gap: 12,
  },
  action: {
    paddingVertical: 4,
  },
  actionText: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  actionPrimary: {
    fontFamily: FontFamily.medium,
    color: Colors.primary,
  },
});
