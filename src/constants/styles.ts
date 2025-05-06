import { FontFamily } from "./../../node_modules/lightningcss/node/ast.d";
import { Alert, StyleSheet } from "react-native";

// Common Values
const BasicColors = {
  primary: "#C5ADC5",
  secondary: "#B2B5E0",
  tertiary: "#5A3E62",
  transparent: "transparent",

  button: "#4B5E79",
  buttonSecondary: "#5D6D7E",
  cancelButton: "#E74C3C", // A strong yet slightly muted red (less aggressive than pure red)
  errorBackground: '#ffcccc', // More vibrant than dull red but not neon

  dropdown: "#DCE5F7",
  dropdownBright: "#5A3E62",

  // input: '#DCE5F7',
  // inputBackground: '#DCE5F7',

  accent: "#5A3E62",
  textPrimary: "#5A3E62", // textPrimary: '#FF0000',
  textSecondary: "#FFFFFF",
  textPrimaryPlaceholder: "#8A6C92",

  link: "#0000FF",
  border: "#B2B5E0",

  // buttonBackground: '#A084CF',
  shadow: "#000",

  fail: "#FF0000", // Red for failure/error
  success: "#00FF00", // Green for success
  warning: "#FFA500", // Orange for warnings

  // Table UI Elements
  tableHeader: "rgb(145, 85, 150)", // Darker tone for headers for strong contrast
  tableRowEven: "#DCE5F7",
  tableRowOdd: "#F3EDF7", // Slightly lighter shade for differentiation
  tableBorder: "#B2B5E0", // Consistent with general border color
  tableText: "#4B5E79", // Readable, slightly desaturated dark blue
  tableHeaderText: "#FFFFFF", // Readable, slightly desaturated dark blue
  tableSelectedFilter: "#B2B5E0", // Matches secondary for highlighted filters

  collapsed: "#DCE5F7",
  collapsedTitleText: "#5A3E62",
  collapsedBold: "#556B6F",

  popupBackground: "#FFFFFF",
  popupTitleText: "#5A3E62",
  popupText: "#4B5E79",
  popupButton: "#C5ADC5",
  popupButtonText: "#FFFFFF",
  popupBorder: "#B2B5E0",
};

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
  authContainer: { width: '85%' },
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

export const headerStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.tertiary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.large,
    paddingTop: SPACING.xxxLarge,
    paddingBottom: SPACING.xSmall,
  },
  text: {
    color: COLORS.textSecondary,
    fontWeight: "bold",
    fontSize: FONT_SIZES.medium,
    marginRight: SPACING.small,
    paddingTop: SPACING.small,
  },
  companyName: {
    fontSize: FONT_SIZES.xLarge,
    color: COLORS.textSecondary,
    fontFamily: "cursive",
    fontStyle: "italic",
    fontWeight: "bold",
    letterSpacing: 1.4,
    ...SHADOW,
  },
  tabButton: {
    padding: SPACING.small,
  },
});

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

export const footerStyles = StyleSheet.create({
  tabButton: {
    padding: SPACING.small,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  container: {
    height: 60,
    backgroundColor: COLORS.tertiary,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  tabText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.small,
    marginTop: 2,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.secondary,
  },
  activeText: {
    color: COLORS.secondary,
    fontWeight: "bold",
  },
});
