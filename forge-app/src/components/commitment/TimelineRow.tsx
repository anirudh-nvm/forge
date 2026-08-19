import { Pressable, Text, View, StyleSheet } from "react-native";
import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import type { TimelineItem } from "../../types/timeline";

type Props = {
  item: TimelineItem;
  onPress?: () => void;
};

const KIND_LABEL: Record<string, string> = {
  commitment: "commit",
  meal: "meal",
  break: "break",
  buffer: "reset",
  recovery: "recover",
  anchor: "anchor",
};

export default function TimelineRow({ item, onPress }: Props) {
  const label = KIND_LABEL[item.kind] ?? item.kind;
  return (
    <Pressable onPress={onPress} style={styles.container}>
      <View style={[styles.dot, item.locked && styles.lockedDot]} />
      <View style={styles.body}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.meta}>
          {item.startTime}–{item.endTime} · {label}
        </Text>
        {item.recoveryReason && (
          <Text style={styles.reason}>{item.recoveryReason.replace(/_/g, " ")}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.muted,
  },
  lockedDot: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.primary,
  },
  meta: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    marginTop: 2,
  },
  reason: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    marginTop: 2,
  },
});