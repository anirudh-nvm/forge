import { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/types/navigation";

import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import FadeInView from "../../components/ui/FadeInView";
import { useOnboarding } from "../../context/OnboardingContext";

type Nav = NativeStackNavigationProp<RootStackParamList, "OnboardingName">;

export default function OnboardingName() {
  const navigation = useNavigation<Nav>();
  const { updateData } = useOnboarding();
  const [name, setName] = useState("");

  const handleContinue = () => {
    if (name.trim().length === 0) return;
    updateData({ name: name.trim() });
    navigation.navigate("OnboardingLifeSeason");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <FadeInView delay={100}>
          <Text style={styles.step}>step 1 of 4</Text>
        </FadeInView>

        <FadeInView delay={200}>
          <Text style={styles.question}>what's your name?</Text>
        </FadeInView>

        <FadeInView delay={400}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(text) => setName(text.toLowerCase())}
            placeholder="your name"
            placeholderTextColor={Colors.muted}
            autoFocus
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />
        </FadeInView>
      </View>

      <FadeInView delay={600} style={styles.footer}>
        <Pressable
          style={[styles.button, name.trim().length === 0 && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={name.trim().length === 0}
        >
          <Text style={styles.buttonText}>continue</Text>
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
  step: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    textTransform: "lowercase",
    marginBottom: 24,
  },
  question: {
    fontSize: Math.round(Typography.title * 1.1),
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
    letterSpacing: -0.5,
    marginBottom: 32,
  },
  input: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.primary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
    paddingVertical: 12,
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
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.medium,
    color: Colors.primary,
  },
});
