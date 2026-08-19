import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Colors } from "../constants/colors";
import { FontFamily, Typography } from "../constants/typography";

interface Props {
  onDone: () => void;
}

export default function SplashScreen({ onDone }: Props) {
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => onDone());
    }, 2200);

    return () => clearTimeout(timer);
  }, [onDone, opacity]);

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Text style={styles.wordmark}>forge</Text>
      <Text style={styles.tagline}>become someone{"\n"}you can trust .</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  wordmark: {
    fontSize: Typography.hero,
    fontFamily: FontFamily.light,
    color: Colors.primary,
    letterSpacing: 6,
    marginBottom: 24,
  },
  tagline: {
    fontSize: Typography.body,
    fontFamily: FontFamily.light,
    color: Colors.muted,
    lineHeight: 24,
    textAlign: "center",
    letterSpacing: 2,
  },
});