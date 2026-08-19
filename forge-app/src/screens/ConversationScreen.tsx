import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/types/navigation";
import * as ImagePicker from "expo-image-picker";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from "expo-audio";

import { Colors } from "../constants/colors";
import { FontFamily, Typography } from "../constants/typography";
import FadeInView from "../components/ui/FadeInView";
import { useForge } from "../context/ForgeContext";
import { getPersonalizedGreeting } from "../utils/greeting";
import { resetForge } from "../engine/ResetEngine";

type Nav = NativeStackNavigationProp<RootStackParamList, "Conversation">;

export default function ConversationScreen() {
  const navigation = useNavigation<Nav>();
  const { generateTodayPlan, userName } = useForge();
  const [phase, setPhase] = useState<"greeting" | "ask" | "input">("greeting");
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert("Permission needed", "Microphone access is required for voice input.");
      }
    })();
  }, []);

  useEffect(() => {
    const timer1 = setTimeout(() => setPhase("ask"), 1200);
    const timer2 = setTimeout(() => setPhase("input"), 2000);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() && !selectedImage && !recordedUri) return;

    await generateTodayPlan(inputText);
    navigation.navigate("Today");
  };

  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleCameraCapture = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const startRecording = async () => {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
  };

  const stopRecording = async () => {
    await audioRecorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    if (audioRecorder.uri) {
      setRecordedUri(audioRecorder.uri);
    }
  };

  const hasContent = inputText.trim() || selectedImage || recordedUri;

  const handleReset = () => {
    Alert.alert("reset forge?", "this clears everything and starts fresh.", [
      { text: "cancel", style: "cancel" },
      {
        text: "reset",
        style: "destructive",
        onPress: async () => {
          await resetForge();
          navigation.reset({
            index: 0,
            routes: [{ name: "OnboardingWelcome" }],
          });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.resetRow}>
          <Pressable onPress={handleReset}>
            <Text style={styles.resetText}>reset forge</Text>
          </Pressable>
        </View>
        <View style={styles.content}>
          <FadeInView delay={200}>
            <Text style={styles.greeting}>{getPersonalizedGreeting(userName)}</Text>
          </FadeInView>

          {phase !== "greeting" && (
            <FadeInView delay={0}>
              <Text style={styles.question}>what's happening today?</Text>
            </FadeInView>
          )}
        </View>

        {selectedImage && (
          <FadeInView delay={0} style={styles.imagePreviewContainer}>
            <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
            <Pressable style={styles.removeImage} onPress={() => setSelectedImage(null)}>
              <Text style={styles.removeImageText}>×</Text>
            </Pressable>
          </FadeInView>
        )}

        {recordedUri && (
          <FadeInView delay={0} style={styles.audioPreviewContainer}>
            <View style={styles.audioPreview}>
              <Text style={styles.audioPreviewText}>voice message recorded</Text>
              <Pressable onPress={() => setRecordedUri(null)}>
                <Text style={styles.removeAudioText}>remove</Text>
              </Pressable>
            </View>
          </FadeInView>
        )}

        {phase === "input" && (
          <FadeInView delay={200} style={styles.footer}>
            <View style={styles.inputBar}>
              <Pressable style={styles.iconButton} onPress={handleCameraCapture}>
                <Text style={styles.icon}>📷</Text>
              </Pressable>

              <Pressable style={styles.iconButton} onPress={handleImagePick}>
                <Text style={styles.icon}>🖼</Text>
              </Pressable>

              <TextInput
                style={styles.input}
                placeholder="tell me about your day..."
                placeholderTextColor={Colors.muted}
                value={inputText}
                onChangeText={(text) => setInputText(text.toLowerCase())}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />

              <Pressable
                style={[styles.iconButton, recorderState.isRecording && styles.iconButtonActive]}
                onPress={recorderState.isRecording ? stopRecording : startRecording}
              >
                <Text style={styles.icon}>{recorderState.isRecording ? "⏹" : "🎤"}</Text>
              </Pressable>
            </View>

            <Pressable
              style={[styles.sendButton, !hasContent && styles.sendDisabled]}
              onPress={handleSend}
              disabled={!hasContent}
            >
              <Text style={styles.sendText}>continue</Text>
            </Pressable>
          </FadeInView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  resetRow: {
    paddingTop: 24,
    paddingRight: 24,
    alignItems: "flex-end",
  },
  resetText: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    justifyContent: "center",
  },
  greeting: {
    fontSize: Math.round(Typography.hero * 1.1),
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  question: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  imagePreviewContainer: {
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  removeImage: {
    position: "absolute",
    top: 4,
    right: 28,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  removeImageText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: "600",
  },
  audioPreviewContainer: {
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  audioPreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  audioPreviewText: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
  removeAudioText: {
    fontSize: Typography.footnote,
    fontFamily: FontFamily.regular,
    color: Colors.primary,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  iconButtonActive: {
    backgroundColor: "#3A2A2A",
  },
  icon: {
    fontSize: 14,
  },
  input: {
    flex: 1,
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  sendButton: {
    backgroundColor: Colors.surface,
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: "center",
  },
  sendDisabled: {
    opacity: 0.3,
  },
  sendText: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
  },
});
