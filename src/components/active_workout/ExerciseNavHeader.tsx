import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING } from "../../constants/styles";
import { TextBase, NumericText } from "../TextBase";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

const HIT = 44;

type Props = {
  exerciseName: string;
  /** 0-based. */
  index: number;
  count: number;
  previousName: string | null;
  nextName: string | null;
  onPrevious: () => void;
  onNext: () => void;
};

/**
 * Prev / exercise name / next, with "Exercise N of M" always under the name.
 *
 * At either end the arrow stays in place but disabled and dimmed, rather than
 * disappearing, so the name does not shift sideways and the user can see they
 * are at the end. Rejected: wrapping from the last exercise to the first, which
 * makes "next" on the final exercise silently go backwards.
 */
export default function ExerciseNavHeader({
  exerciseName,
  index,
  count,
  previousName,
  nextName,
  onPrevious,
  onNext,
}: Props) {
  const { styles, t } = useThemeStyles(createStyles);
  const canGoBack = previousName !== null;
  const canGoForward = nextName !== null;

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.arrow, !canGoBack && styles.arrowDisabled]}
        onPress={onPrevious}
        disabled={!canGoBack}
        accessibilityRole="button"
        accessibilityLabel={canGoBack ? `Previous exercise: ${previousName}` : "Previous exercise"}
        accessibilityState={{ disabled: !canGoBack }}
      >
        <Ionicons name="chevron-back" size={20} color={t.colors.role.textSecondary} />
      </TouchableOpacity>

      <View style={styles.titleBlock}>
        <TextBase style={styles.exerciseName} numberOfLines={2}>{exerciseName}</TextBase>
        <View style={styles.positionRow} accessibilityLabel={`Exercise ${index + 1} of ${count}`}>
          <TextBase style={styles.positionLabel}>EXERCISE </TextBase>
          <NumericText style={styles.positionLabel}>{index + 1}</NumericText>
          <TextBase style={styles.positionLabel}> OF </TextBase>
          <NumericText style={styles.positionLabel}>{count}</NumericText>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.arrow, !canGoForward && styles.arrowDisabled]}
        onPress={onNext}
        disabled={!canGoForward}
        accessibilityRole="button"
        accessibilityLabel={canGoForward ? `Next exercise: ${nextName}` : "Next exercise"}
        accessibilityState={{ disabled: !canGoForward }}
      >
        <Ionicons name="chevron-forward" size={20} color={t.colors.role.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.small,
  },
  arrow: {
    width: HIT,
    height: HIT,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: t.colors.role.surface,
    borderWidth: 1,
    borderColor: t.colors.role.hairline,
  },
  arrowDisabled: {
    opacity: 0.35,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: SPACING.xSmall,
  },
  exerciseName: {
    fontSize: 25,
    fontWeight: "bold",
    lineHeight: 28,
    textAlign: "center",
    color: t.colors.role.textPrimary,
  },
  positionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  positionLabel: {
    fontSize: t.fonts.xSmall,
    letterSpacing: 1.5,
    color: t.colors.role.textSecondary,
  },
});
