// src/components/ShowArchivedToggle.tsx
//
// TICKET-061: "Show archived" / "Hide archived", in a heading row on Start
// (beside YOUR PLANS) and in Manage's plan sheet (beside its title). It takes
// the heading's own type, caps and tracking, so the row has one type style
// (user, 2026-11-01: a 14 px control beside a 10 px label looked off). Brighter
// than the label, with an icon, so it reads as tappable. The callers render it
// only when at least one plan is archived, so it never opens an empty list.

import React from "react";
import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TextBase } from "./TextBase";
import { TouchableOpacityBase } from "./TouchableOpacityBase";
import { SPACING } from "../constants/styles";
import { ReturnTypeUseThemeTokens } from "./app_manager/ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";

const HIT = 44;

type Props = {
  shown: boolean;
  onPress: () => void;
  /** The heading's font token: `xSmall` beside YOUR PLANS, `small` in the plan sheet. */
  size: "xSmall" | "small";
};

export function ShowArchivedToggle({ shown, onPress, size }: Props) {
  const { styles, t } = useThemeStyles(createStyles);
  const label = shown ? "Hide archived" : "Show archived";
  return (
    <TouchableOpacityBase
      style={styles.button}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: shown }}
    >
      <Ionicons
        name={shown ? "eye-off-outline" : "eye-outline"}
        size={14}
        color={t.colors.role.textPrimary}
      />
      <TextBase style={[styles.text, { fontSize: t.fonts[size] }]}>{label.toUpperCase()}</TextBase>
    </TouchableOpacityBase>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    button: {
      minHeight: HIT,
      paddingLeft: SPACING.medium,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    text: {
      fontWeight: "bold",
      letterSpacing: 1.5,
      color: t.colors.role.textPrimary,
    },
  });
