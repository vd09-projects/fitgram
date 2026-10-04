import { StyleSheet } from "react-native";
import { ReturnTypeUseThemeTokens } from "../components/app_manager/ThemeContext";

// Two faces, two jobs. `display` is the standard face for every piece of copy;
// `numeric` is monospace and is the ONLY face numbers render in, so that values
// stack in an aligned column (67.5 kg x 8 over 65 kg x 8). The mono advance width
// gives that alignment inherently -- we deliberately do not lean on
// `fontVariant: ['tabular-nums']`, which is unreliable on Android.
//
// letterSpacing lives per face rather than as one global: it is a property of the
// face's metrics, not of the app. Archivo is narrower than ComicRelief was and
// reads loose at the old 0.4/0.6, and mono digits must not be tracked apart at all
// or the column widths drift.
export const FONT_FAMILY = {
  display: {
    regular: {
      name: "Archivo",
      path: require("../../assets/fonts/Archivo-Regular.ttf"),
    },
    bold: {
      name: "ArchivoBold",
      path: require("../../assets/fonts/Archivo-Bold.ttf"),
    },
    letterSpacing: {
      regular: 0.1,
      bold: 0.2,
    },
  },
  numeric: {
    regular: {
      name: "IBMPlexMono",
      path: require("../../assets/fonts/IBMPlexMono-Regular.ttf"),
    },
    medium: {
      name: "IBMPlexMonoMedium",
      path: require("../../assets/fonts/IBMPlexMono-Medium.ttf"),
    },
    letterSpacing: {
      regular: 0,
      medium: 0,
    },
  },
};

export type FontFamilyType = typeof FONT_FAMILY;

// Flat name -> asset map for `Font.loadAsync`. Derived from FONT_FAMILY so adding
// a face is a one-line change here and nothing in App.tsx.
export const FONT_ASSETS = {
  [FONT_FAMILY.display.regular.name]: FONT_FAMILY.display.regular.path,
  [FONT_FAMILY.display.bold.name]: FONT_FAMILY.display.bold.path,
  [FONT_FAMILY.numeric.regular.name]: FONT_FAMILY.numeric.regular.path,
  [FONT_FAMILY.numeric.medium.name]: FONT_FAMILY.numeric.medium.path,
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
    fontSize: t.fonts.xLarge,
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
    fontSize: t.fonts.large,
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
