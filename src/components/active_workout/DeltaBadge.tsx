import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SetDelta, SetVerdict } from "../../utils/setDeltas";
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
 * glyph: a caret down, ~ for even, = for matched.
 *
 * Glyphs (TICKET-059, board TA1, user 2026-10-30): = is matched (the same
 * weight and reps), ~ is even (numbers moved, volume the same). Replaced: =
 * for even and the word alone for matched; the Today row now shows the glyph
 * without its text, so matched needs one.
 *
 * Renders nothing with no delta — not 0, not a dash that reads as a value.
 */
export function DeltaBadge({ delta }: { delta: SetDelta | null }) {
  const { styles, t } = useThemeStyles(createStyles);
  if (delta === null || delta.kind === "none") return null;
  return (
    <View style={styles.delta} testID={`delta-${delta.verdict}`}>
      <VerdictGlyph verdict={delta.verdict} size={11} />
      <NumericText style={[styles.deltaText, { color: verdictColor(t, delta.verdict) }]}>{delta.label}</NumericText>
    </View>
  );
}

/**
 * The verdict alone, for the Today row (TICKET-059). The label is in the
 * row's spoken name (`deltaSpeech`) and in the open row's change line.
 */
export function DeltaGlyph({ delta, size = 12 }: { delta: SetDelta | null; size?: number }) {
  if (delta === null || delta.kind === "none") return null;
  return (
    <View testID={`delta-${delta.verdict}`}>
      <VerdictGlyph verdict={delta.verdict} size={size} />
    </View>
  );
}

export const verdictColor = (t: ReturnTypeUseThemeTokens, verdict: SetVerdict): string =>
  verdict === "improved" ? t.colors.role.signal : t.colors.role.textSecondary;

export function VerdictGlyph({ verdict, size }: { verdict: SetVerdict; size: number }) {
  const { t } = useThemeStyles(createStyles);
  const color = verdictColor(t, verdict);
  if (verdict === "improved") return <Ionicons name="caret-up" size={size} color={color} />;
  if (verdict === "down") return <Ionicons name="caret-down" size={size} color={color} />;
  return <MaterialCommunityIcons name={verdict === "even" ? "tilde" : "equal"} size={size + 2} color={color} />;
}

/** ", improved: +1 rep" for a row's spoken label; empty with no delta. */
export function deltaSpeech(delta: SetDelta | null): string {
  if (delta === null || delta.kind === "none") return "";
  if (delta.verdict === "matched") return ", matched";
  return `, ${delta.verdict}: ${delta.label}`;
}

const createStyles = (_t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  // Shrinks and wraps in a narrow column ("+2.5 kg · −2 reps" in the history
  // sheet's Today column, TICKET-033-2) rather than running past its edge.
  delta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
    maxWidth: "100%",
  },
  deltaText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "600",
  },
});
