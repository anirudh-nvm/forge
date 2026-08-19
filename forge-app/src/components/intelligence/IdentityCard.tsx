import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import { Spacing } from "../../constants/spacing";
import FadeInView from "../ui/FadeInView";

export interface IdentityCardData {
  lifeDirectionTitle: string;
  goalTitle?: string;
  connectionText: string;
}

interface IdentityCardProps {
  identity: IdentityCardData;
}

export default function IdentityCard({ identity }: IdentityCardProps) {
  return (
    <FadeInView delay={500} style={styles.card}>
      <Text style={styles.label}>identity</Text>
      <Text style={styles.connection}>{identity.connectionText}</Text>
      {identity.goalTitle ? (
        <Text style={styles.goal}>
          {identity.goalTitle} → {identity.lifeDirectionTitle}
        </Text>
      ) : null}
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: Typography.caption,
    fontFamily: FontFamily.medium,
    color: Colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  connection: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
    lineHeight: 22,
  },
  goal: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    marginTop: Spacing.xs,
  },
});
