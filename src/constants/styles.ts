import { StyleSheet } from "react-native";
import { ReturnTypeUseThemeTokens } from "../components/ThemeContext";

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

export const getShadow = (level: number, shadowColor: string) => ({
  shadowColor: shadowColor,
  shadowOffset: { width: 0, height: level },
  shadowOpacity: level * 0.1,
  shadowRadius: level * 2,
  elevation: level * 2,
});

export const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: t.colors.primary,
  },
  title: {
    fontSize: FONT_SIZES.xLarge,
    fontWeight: "bold",
    marginBottom: SPACING.xLarge,
    color: t.colors.textPrimary,
  },
  input: {
    width: "80%",
    padding: SPACING.small,
    marginBottom: SPACING.small,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: BORDER_RADIUS,
    backgroundColor: t.colors.textSecondary,
  },
  link: {
    color: t.colors.link,
    marginTop: SPACING.small,
  },
  button: {
    backgroundColor: t.colors.button,
    paddingVertical: SPACING.medium,
    paddingHorizontal: SPACING.large,
    borderRadius: BORDER_RADIUS,
    alignItems: "center",
    ...t.shadows.shadowSmall,
  },
  authContainer: { width: "85%" },
  buttonText: {
    color: t.colors.textSecondary,
    fontSize: FONT_SIZES.large,
    fontWeight: "bold",
  },
  switchText: {
    marginVertical: SPACING.medium,
    color: t.colors.textPrimary,
    textAlign: "center",
    textDecorationLine: "underline",
    fontStyle: "italic",
  },
});
