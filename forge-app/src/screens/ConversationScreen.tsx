import { useState, useEffect, useRef } from "react";
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
  ScrollView,
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
import ChatMemorySurface, { type MemoryInsight } from "../components/intelligence/ChatMemorySurface";
import ChatPredictionSurface from "../components/intelligence/ChatPredictionSurface";
import HigherSelfSurface from "../components/intelligence/HigherSelfSurface";
import { useForge } from "../context/ForgeContext";
import { getPersonalizedGreeting } from "../utils/greeting";
import { resetForge } from "../engine/ResetEngine";
import type { EnergyLevel, ReferenceContext } from "../types/companion";
import {
  createThread,
  saveThread,
  updateThreadEnergy,
  updateThreadStatus,
  getYesterdayThread,
  getReferenceContext,
  getEnergyResponse,
} from "../ai/ConversationThreadEngine";
import { buildChatMemoryContext } from "../ai/ChatMemoryContext";
import { buildPredictionContext, formatPredictionsForLLM } from "../ai/PredictionContext";
import { buildHigherSelfChatContext, type HigherSelfChatContext } from "../ai/HigherSelfContext";
import type { Prediction } from "../memory/PredictionEngine";
import type { HigherSelfMessage } from "../memory/HigherSelf";

type Nav = NativeStackNavigationProp<RootStackParamList, "Conversation">;

type ChatMessage = {
  role: "user" | "forge";
  text: string;
};

type ArrivalPhase =
  | "greeting"
  | "energy_ask"
  | "energy_ack"
  | "yesterday_ref"
  | "planning_ask"
  | "input"
  | "planning_complete"
  | "ready";

const ENERGY_OPTIONS: { label: string; level: EnergyLevel }[] = [
  { label: "tired", level: "tired" },
  { label: "okay", level: "neutral" },
  { label: "good", level: "good" },
  { label: "energized", level: "energized" },
];

export default function ConversationScreen() {
  const navigation = useNavigation<Nav>();
  const { generateTodayPlan, userName } = useForge();
  const [phase, setPhase] = useState<ArrivalPhase>("greeting");
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isClarifying, setIsClarifying] = useState(false);
  const [pendingContext, setPendingContext] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [referenceContext, setReferenceContext] = useState<ReferenceContext | null>(null);
  const [memoryInsights, setMemoryInsights] = useState<MemoryInsight[]>([]);
  const [activePredictions, setActivePredictions] = useState<Prediction[]>([]);
  const [higherSelfMessage, setHigherSelfMessage] = useState<HigherSelfMessage | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert("Permission needed", "Microphone access is required for voice input.");
      }

      const thread = createThread();
      await saveThread(thread);

      const yesterday = await getYesterdayThread();
      const refContext = getReferenceContext(yesterday);
      setReferenceContext(refContext);

      // Load memory insights for chat surface
      const chatMemory = await buildChatMemoryContext().catch(() => null);
      if (chatMemory && chatMemory.insights.length > 0) {
        setMemoryInsights(chatMemory.insights);
      }

      // Load predictions for chat surface
      const predContext = await buildPredictionContext("").catch(() => null);
      if (predContext && predContext.predictions.length > 0) {
        setActivePredictions(predContext.predictions);
      }

      // Load Higher Self message
      const hsContext = await buildHigherSelfChatContext().catch(() => null);
      if (hsContext && hsContext.message) {
        setHigherSelfMessage(hsContext.message);
      }
    })();
  }, []);

  useEffect(() => {
    if (phase !== "greeting") return;

    const timer = setTimeout(() => {
      setPhase("energy_ask");
      const question = referenceContext?.question ?? "how are you feeling today?";
      setChatHistory([{ role: "forge", text: question }]);
    }, 1200);

    return () => clearTimeout(timer);
  }, [phase, referenceContext]);

  useEffect(() => {
    if (
      phase === "energy_ack" ||
      phase === "yesterday_ref" ||
      phase === "planning_ask" ||
      phase === "planning_complete" ||
      phase === "ready"
    ) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [phase, chatHistory]);

  const handleEnergySelect = async (level: EnergyLevel, label: string) => {
    await updateThreadEnergy({
      level,
      source: "self_report",
      confidence: 1.0,
    });

    setChatHistory((prev) => [...prev, { role: "user", text: label }]);

    const response = getEnergyResponse(level);
    setPhase("energy_ack");
    setChatHistory((prev) => [...prev, { role: "forge", text: response }]);

    setTimeout(() => {
      if (referenceContext?.shouldReferenceYesterday && referenceContext.yesterdayMessage) {
        setPhase("yesterday_ref");
        setChatHistory((prev) => [
          ...prev,
          { role: "forge", text: referenceContext.yesterdayMessage! },
        ]);

        setTimeout(() => {
          setPhase("planning_ask");
          setChatHistory((prev) => [
            ...prev,
            { role: "forge", text: "walk me through today." },
          ]);
        }, 2000);
      } else {
        setPhase("planning_ask");
        setChatHistory((prev) => [
          ...prev,
          { role: "forge", text: "walk me through today." },
        ]);
      }
    }, 1200);
  };

  const handleSend = async () => {
    if (!inputText.trim() && !selectedImage && !recordedUri) return;

    const userMessage = inputText.trim();
    const fullContext = pendingContext
      ? `${pendingContext}\n${userMessage}`
      : userMessage;

    setInputText("");
    setSelectedImage(null);
    setRecordedUri(null);
    setIsUpdating(true);

    setChatHistory((prev) => [...prev, { role: "user", text: userMessage }]);

    const result = await generateTodayPlan(fullContext);
    setIsUpdating(false);

    const hasCommitments = result.todayPlan.commitments.length > 0;
    const isClarification = !hasCommitments && result.todayPlan.greeting.includes("?");

    if (isClarification) {
      setChatHistory((prev) => [
        ...prev,
        { role: "forge", text: result.todayPlan.greeting },
      ]);
      setPendingContext(fullContext);
      setIsClarifying(true);
    } else {
      await updateThreadStatus("planning");
      setPhase("planning_complete");
      setChatHistory((prev) => [
        ...prev,
        { role: "forge", text: "alright. i think we've got a good day here." },
      ]);

      setTimeout(() => {
        setPhase("ready");
        setChatHistory((prev) => [...prev, { role: "forge", text: "ready?" }]);
      }, 1500);
    }
  };

  const handleReady = () => {
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
        </View>

        {chatHistory.length > 0 && (
          <ScrollView
            ref={scrollViewRef}
            style={styles.chatContainer}
            contentContainerStyle={styles.chatContent}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {chatHistory.map((msg, i) => (
              <FadeInView key={i} delay={0} style={msg.role === "user" ? styles.userMsgWrap : styles.forgeMsgWrap}>
                <Text style={msg.role === "user" ? styles.userMsg : styles.forgeMsg}>{msg.text}</Text>
              </FadeInView>
            ))}
          </ScrollView>
        )}

        {/* Memory Surface - shows relevant patterns during chat */}
        {memoryInsights.length > 0 && phase === "planning_ask" && (
          <FadeInView delay={500}>
            <ChatMemorySurface insights={memoryInsights} />
          </FadeInView>
        )}

        {/* Prediction Surface - shows relevant predictions during chat */}
        {activePredictions.length > 0 && phase === "planning_ask" && (
          <FadeInView delay={700}>
            <ChatPredictionSurface predictions={activePredictions} />
          </FadeInView>
        )}

        {/* Higher Self Surface - shows identity growth insights */}
        {higherSelfMessage && phase === "planning_ask" && (
          <FadeInView delay={900}>
            <HigherSelfSurface message={higherSelfMessage} />
          </FadeInView>
        )}

        {isUpdating && chatHistory.length === 0 && (
          <View style={styles.chatContainer}>
            <FadeInView delay={0}>
              <Text style={styles.question}>thinking...</Text>
            </FadeInView>
          </View>
        )}

        {phase === "energy_ask" && (
          <FadeInView delay={200} style={styles.energyContainer}>
            <View style={styles.energyRow}>
              {ENERGY_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.level}
                  style={styles.energyButton}
                  onPress={() => handleEnergySelect(opt.level, opt.label)}
                >
                  <Text style={styles.energyText}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </FadeInView>
        )}

        {phase === "ready" && (
          <FadeInView delay={200} style={styles.readyContainer}>
            <Pressable style={styles.readyButton} onPress={handleReady}>
              <Text style={styles.readyText}>let's begin</Text>
            </Pressable>
          </FadeInView>
        )}

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

        {(phase === "planning_ask" || isClarifying) && (
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
  chatContainer: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
    justifyContent: "center",
  },
  userMsgWrap: {
    alignSelf: "flex-end",
    maxWidth: "80%",
    marginBottom: 8,
  },
  forgeMsgWrap: {
    alignSelf: "flex-start",
    maxWidth: "80%",
    marginBottom: 8,
  },
  userMsg: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.primary,
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderBottomRightRadius: 4,
  },
  forgeMsg: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.secondary,
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: Colors.divider,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
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
  energyContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  energyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  energyButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  energyText: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.primary,
  },
  readyContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  readyButton: {
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: "center",
  },
  readyText: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.primary,
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
