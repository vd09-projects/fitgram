import React, { ReactNode } from "react";
import { View, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { ReturnTypeUseThemeTokens } from "./app_manager/ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";

const HIT = 44;

type Props = {
  // Defaults to `goBack`, the same action Android back dispatches, so the
  // on-screen button and the hardware key always land in the same place.
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** The logger's back chevron (WorkoutHeader), shared by every screen. */
export default function BackButton({ onPress, style }: Props) {
  const { styles, t } = useThemeStyles(createStyles);
  const navigation = useNavigation();

  return (
    <TouchableOpacity
      style={[styles.iconButton, style]}
      onPress={onPress ?? (() => navigation.goBack())}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Ionicons name="chevron-back" size={22} color={t.colors.role.textSecondary} />
    </TouchableOpacity>
  );
}

/**
 * A screen title with the back button on its left. A spacer of the same width
 * on the right keeps the title centred on the screen, not in the space left
 * over by the button.
 */
export function BackTitle({ children }: { children: ReactNode }) {
  const { styles } = useThemeStyles(createStyles);
  return (
    <View style={styles.row}>
      <BackButton />
      <View style={styles.title}>{children}</View>
      <View style={styles.spacer} />
    </View>
  );
}

const createStyles = (_t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  iconButton: {
    width: HIT,
    height: HIT,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  row: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    flex: 1,
    alignItems: "center",
  },
  spacer: {
    width: HIT,
  },
});
