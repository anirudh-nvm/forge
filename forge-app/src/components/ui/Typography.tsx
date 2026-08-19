import { Text, StyleSheet, TextStyle } from "react-native";

import { Colors } from "../../constants/colors";
import { Typography as Type, FontFamily } from "../../constants/typography";

type TextProps = {
  children: React.ReactNode;
  style?: TextStyle;
  numberOfLines?: number;
};

export function Hero({ children, style, numberOfLines }: TextProps) {
  return (
    <Text style={[styles.hero, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Title({ children, style, numberOfLines }: TextProps) {
  return (
    <Text style={[styles.title, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Headline({ children, style, numberOfLines }: TextProps) {
  return (
    <Text style={[styles.headline, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Body({ children, style, numberOfLines }: TextProps) {
  return (
    <Text style={[styles.body, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Callout({ children, style, numberOfLines }: TextProps) {
  return (
    <Text style={[styles.callout, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Caption({ children, style, numberOfLines }: TextProps) {
  return (
    <Text style={[styles.caption, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  hero: {
    color: Colors.primary,
    fontSize: Type.hero,
    fontFamily: FontFamily.light,
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  title: {
    color: Colors.primary,
    fontSize: Type.title,
    fontFamily: FontFamily.regular,
    letterSpacing: -0.3,
    lineHeight: 34,
  },
  headline: {
    color: Colors.primary,
    fontSize: Type.headline,
    fontFamily: FontFamily.regular,
    letterSpacing: -0.2,
    lineHeight: 28,
  },
  body: {
    color: Colors.secondary,
    fontSize: Type.body,
    fontFamily: FontFamily.regular,
    lineHeight: 24,
  },
  callout: {
    color: Colors.secondary,
    fontSize: Type.callout,
    fontFamily: FontFamily.regular,
    lineHeight: 22,
  },
  caption: {
    color: Colors.muted,
    fontSize: Type.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
});