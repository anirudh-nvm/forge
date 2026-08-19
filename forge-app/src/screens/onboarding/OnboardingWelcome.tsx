import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/types/navigation";

import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import FadeInView from "../../components/ui/FadeInView";

type Nav = NativeStackNavigationProp<RootStackParamList, "OnboardingWelcome">;

export default function OnboardingWelcome() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <FadeInView delay={100}>
          <Text style={styles.greeting}>hello.</Text>
        </FadeInView>

        <FadeInView delay={300}>
          <Text style={styles.forgeName}>i'm forge.</Text>
        </FadeInView>

        <FadeInView delay={500}>
          <Text style={styles.body}>
            i'll help you stay accountable,{"\n"}
            adapt your plans,{"\n"}
            and remember why you started.{"\n"}
            because discipline shouldn't{"\n"}
            depend on motivation.
          </Text>
        </FadeInView>
      </View>

      <FadeInView delay={1200} style={styles.footer}>
        <Pressable
          style={styles.button}
          onPress={() => navigation.navigate("OnboardingName")}
        >
          <Text style={styles.buttonText}>let's begin</Text>
        </Pressable>
      </FadeInView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
  },
  greeting: {
    fontSize: Math.round(Typography.title * 1.3),
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  forgeName: {
    fontSize: Typography.hero,
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
    letterSpacing: -1,
    marginBottom: 24,
  },
  body: {
    fontSize: 17,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
    lineHeight: 30,
    letterSpacing: 3,
    marginBottom: 16,
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  button: {
    backgroundColor: Colors.surface,
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: "center",
  },
  buttonText: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.medium,
    color: Colors.primary,
  },
});
