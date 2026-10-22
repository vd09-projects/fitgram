import React from "react";
import { View, StyleSheet } from "react-native";
import { Effort } from "../../types/workoutSession";
import { EFFORT_LETTER } from "../../utils/effort";
import { TextBase } from "../TextBase";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

/**
 * A set's effort mark (TICKET-034): **H** solid, **E** hollow. Shared by the
 * rest panel, the Today list, the set card's pill and the history sheet, so a
 * mark looks the same wherever it appears.
 *
 * Decisions (design canvas, boards 5–8):
 * - Told apart by fill — solid against outline, a lightness difference — and
 *   by letter, never by hue alone. No new colour: `signal` (gold) already means
 *   a PR and `danger` (red) means discard, so a gold "easy" or red "hard" would
 *   read as one of those.
 * - Hard is the solid one: it is the mark that asks for a decision next time.
 *
 * Decorative to a screen reader: the enclosing control's label says "felt
 * hard" (`effortSpeech`), so the letter is not read on its own.
 */
export function EffortBadge({ effort, size = 20 }: { effort: Effort; size?: number }) {
  const { styles } = useThemeStyles(createStyles);
  const hard = effort === Effort.Hard;
  return (
    <View
      style={[styles.badge, { width: size, height: size }, hard ? styles.hard : styles.easy]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      testID={`effort-${effort}`}
    >
      <TextBase style={[styles.letter, { fontSize: Math.round(size * 0.55) }, hard && styles.hardLetter]}>
        {EFFORT_LETTER[effort]}
      </TextBase>
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  badge: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  hard: {
    backgroundColor: t.colors.role.textPrimary,
  },
  easy: {
    borderWidth: 1.5,
    borderColor: t.colors.role.textSecondary,
  },
  letter: {
    fontWeight: "bold",
    color: t.colors.role.textPrimary,
  },
  hardLetter: {
    color: t.colors.role.ground,
  },
});
