import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SetDelta } from "../../utils/setDeltas";
import { NumericText } from "../TextBase";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

/**
 * One set's verdict against the same set last time: glyph, label, colour.
 * Shared by the Today list and the history sheet so a verdict looks the same
 * wherever it appears.
 *
 * Colour (TICKET-019): improved is `signal`; down, even and matched are
 * `textSecondary`. Gold against grey is a lightness difference, so
 * improved-vs-down survives colour-blind use. The three grey verdicts differ by
 * glyph and text — a caret down, an equals bar, the word "matched".
 *
 * Renders nothing with no delta — not 0, not a dash that reads as a value.
 */
export function DeltaBadge({ delta }: { delta: SetDelta | null }) {
  const { styles, t } = useThemeStyles(createStyles);
  if (delta === null || delta.kind === "none") return null;
  const color = delta.verdict === "improved" ? t.colors.role.signal : t.colors.role.textSecondary;
  const glyph =
    delta.verdict === "improved"
      ? "caret-up"
      : delta.verdict === "down"
        ? "caret-down"
        : delta.verdict === "even"
          ? "reorder-two"
          : null;
  return (
    <View style={styles.delta} testID={`delta-${delta.verdict}`}>
      {glyph !== null && <Ionicons name={glyph} size={11} color={color} />}
      <NumericText style={[styles.deltaText, { color }]}>{delta.label}</NumericText>
    </View>
  );
}

/** ", improved: +1 rep" for a row's spoken label; empty with no delta. */
export function deltaSpeech(delta: SetDelta | null): string {
  if (delta === null || delta.kind === "none") return "";
  if (delta.verdict === "matched") return ", matched";
  return `, ${delta.verdict}: ${delta.label}`;
}

const createStyles = (_t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  delta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  deltaText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
