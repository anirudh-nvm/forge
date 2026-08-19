import { ReactNode } from "react";
import { SafeAreaView, View } from "react-native";

import { Colors } from "../../constants/colors";
import { Spacing } from "../../constants/spacing";

type Props = {
  children: ReactNode;
};

export default function Screen({ children }: Props) {
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: Colors.background,
      }}
    >
      <View
        style={{
          flex: 1,
          paddingHorizontal: Spacing.md,
          paddingTop: Spacing.lg,
        }}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}