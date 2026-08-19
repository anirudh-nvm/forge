import { Pressable, Text, StyleSheet } from "react-native";

import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
};

export default function Button({ title, onPress, variant = "primary", disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "ghost" && styles.ghost,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.text,
          variant === "primary" && styles.textPrimary,
          variant === "secondary" && styles.textSecondary,
          variant === "ghost" && styles.textGhost,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: Colors.primary,
  },
  secondary: {
    backgroundColor: Colors.surface,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.3,
  },
  text: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
  },
  textPrimary: {
    color: Colors.background,
    fontFamily: FontFamily.medium,
  },
  textSecondary: {
    color: Colors.muted,
  },
  textGhost: {
    color: Colors.muted,
  },
});