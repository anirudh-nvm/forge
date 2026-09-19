import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
import { Colors } from "../../constants/colors";
import { FontFamily, Typography } from "../../constants/typography";
import type { TaskCheckInResponse } from "../../types/companion";

type Props = {
  visible: boolean;
  commitmentTitle: string;
  onSelect: (response: TaskCheckInResponse) => void;
};

const CHECK_IN_OPTIONS: { label: string; response: TaskCheckInResponse }[] = [
  { label: "tiring", response: "tiring" },
  { label: "productive", response: "productive" },
  { label: "need a break", response: "need_break" },
  { label: "fine", response: "fine" },
  { label: "great", response: "great" },
];

export default function TaskCheckInModal({
  visible,
  commitmentTitle,
  onSelect,
}: Props) {
  const [selected, setSelected] = useState<TaskCheckInResponse | null>(null);
  const [showThankYou, setShowThankYou] = useState(false);

  const handleSelect = (response: TaskCheckInResponse) => {
    setSelected(response);
    setShowThankYou(true);

    setTimeout(() => {
      onSelect(response);
      setSelected(null);
      setShowThankYou(false);
    }, 1200);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          {!showThankYou ? (
            <>
              <Text style={styles.title}>how was {commitmentTitle}?</Text>
              <View style={styles.optionsRow}>
                {CHECK_IN_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.response}
                    style={[
                      styles.optionButton,
                      selected === opt.response && styles.optionSelected,
                    ]}
                    onPress={() => handleSelect(opt.response)}
                  >
                    <Text style={styles.optionText}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.thankYou}>got it. we'll keep that in mind.</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  container: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    alignItems: "center",
  },
  title: {
    fontSize: Typography.headline,
    fontFamily: FontFamily.regular,
    color: Colors.primary,
    marginBottom: 20,
    textAlign: "center",
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  optionButton: {
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  optionSelected: {
    backgroundColor: Colors.primary,
  },
  optionText: {
    fontSize: Typography.callout,
    fontFamily: FontFamily.regular,
    color: Colors.primary,
  },
  thankYou: {
    fontSize: Typography.body,
    fontFamily: FontFamily.regular,
    color: Colors.muted,
    textAlign: "center",
  },
});
