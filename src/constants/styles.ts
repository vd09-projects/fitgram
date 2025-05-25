import { FontFamily } from "./../../node_modules/lightningcss/node/ast.d";
import { Alert, StyleSheet } from "react-native";
import { BasicColors } from "./colors";

export const COLORS = BasicColors;

export const FONT_FAMILY = {
  regular: {
    name: "ComicRelief",
    path: require("../../assets/fonts/ComicRelief-Regular.ttf"),
  },
  bold: {
    name: "ComicReliefBold",
    path: require("../../assets/fonts/ComicRelief-Bold.ttf"),
  },
};

export const FONT_SIZES = {
  xSmall: 10,
  small: 12,
  xMedium: 14,
  medium: 16,
  large: 18,
  xLarge: 24,
};

export const BUTTON_SIZES = {
  xSmall: 12,
  small: 16,
  xMedium: 24,
  medium: 30,
  large: 36,
  xLarge: 40,
};

export const SPACING = {
  xSmall: 4,
  small: 8,
  medium: 12,
  xMedium: 14,
  large: 16,
  xLarge: 20,
  xxLarge: 24,
  xxxLarge: 32,
  xxxxLarge: 40,
};

export const BORDER_RADIUS = 8;
export const LARGE_BORDER_RADIUS = 16;

export const getShadow = (level: number) => ({
  shadowColor: COLORS.shadow,
  shadowOffset: { width: 0, height: level },
  shadowOpacity: level * 0.1,
  shadowRadius: level * 2,
  elevation: level * 2,
});

export const SHADOW = getShadow(2);
export const SHADOW_3 = getShadow(3);
export const SHADOW_4 = getShadow(4);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.primary,
  },
  title: {
    fontSize: FONT_SIZES.xLarge,
    fontWeight: "bold",
    marginBottom: SPACING.xLarge,
    color: COLORS.textPrimary,
  },
  input: {
    width: "80%",
    padding: SPACING.small,
    marginBottom: SPACING.small,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS,
    backgroundColor: COLORS.textSecondary,
  },
  link: {
    color: COLORS.link,
    marginTop: SPACING.small,
  },
  button: {
    backgroundColor: COLORS.button,
    paddingVertical: SPACING.medium,
    paddingHorizontal: SPACING.large,
    borderRadius: BORDER_RADIUS,
    alignItems: "center",
    ...SHADOW,
  },
  authContainer: { width: "85%" },
  buttonText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.large,
    fontWeight: "bold",
  },
  switchText: {
    marginVertical: SPACING.medium,
    color: COLORS.textPrimary,
    textAlign: "center",
    textDecorationLine: "underline",
    fontStyle: "italic",
  },
});

export default styles;

export const layoutStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  content: {
    flex: 1,
    margin: SPACING.xSmall,
    marginBottom: 0,
  },
});
