import React from "react";
import { StyleSheet, View } from "react-native";
import { TextBase } from "../TextBase";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import type { Effort } from "../../types/workoutSession";

const EFFORT_MARK = { easy: "E", hard: "H" } as const;

/** The H or E badge of a set that was logged hard or easy (nothing for an unmarked set). Shared by the Session card and the Exercise log. */
export function EffortMark({ effort }: { effort: Effort | null }) {
  const { styles } = useThemeStyles(createStyles);
  if (effort === null) return null;
  return (
    <View style={styles.mark}>
      <TextBase style={styles.markText}>{EFFORT_MARK[effort]}</TextBase>
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    mark: { width: 20, height: 20, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.role.textPrimary },
    markText: { fontSize: t.fonts.small, fontWeight: "bold", color: t.colors.role.ground },
  });
