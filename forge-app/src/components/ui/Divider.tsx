import { View, StyleSheet } from "react-native";

import { Colors } from "../../constants/colors";

type Props = {
  style?: object;
};

export default function Divider({ style }: Props) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    width: "100%",
  },
});