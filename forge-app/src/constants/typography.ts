import { Platform, Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");
const scale = Math.min(width / 390, height / 844);

const SF_PRO = Platform.OS === "ios" ? "SF Pro" : "System";

export const FontFamily = {
  light: `${SF_PRO}-Light`,
  regular: `${SF_PRO}-Text`,
  medium: `${SF_PRO}-Medium`,
  semibold: `${SF_PRO}-Semibold`,
  bold: `${SF_PRO}-Bold`,
};

export const Typography = {
  hero: Math.round(31 * scale),
  title: Math.round(25 * scale),
  headline: Math.round(20 * scale),
  body: Math.round(15 * scale),
  callout: Math.round(14 * scale),
  subheadline: Math.round(13 * scale),
  footnote: Math.round(12 * scale),
  caption: Math.round(11 * scale),
  small: Math.round(9 * scale),
};