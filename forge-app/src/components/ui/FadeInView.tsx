import { useEffect, useRef, ReactNode } from "react";
import { Animated, StyleSheet, ViewStyle } from "react-native";

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  delay?: number;
  duration?: number;
};

export default function FadeInView({
  children,
  style,
  delay = 0,
  duration = 400,
}: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: fadeAnim,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
