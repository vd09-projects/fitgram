import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING } from "../../constants/styles";
import { ExerciseHistory } from "../../types/exerciseHistory";
import { LoggedExercise } from "../../types/zustandWorkoutType";
import { RemovedSet } from "../../stores/useWorkoutStore";
import { resolveNumericFields } from "../../utils/exerciseFields";
import {
  comparisonText,
  SetDelta,
  setCountText,
  setDelta,
  setValuesText,
  todaySummary,
  volumeText,
} from "../../utils/setDeltas";
import { TextBase, NumericText } from "../TextBase";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

const HIT = 44;
const ROW_HEIGHT = 46;

type Props = {
  exercise: LoggedExercise;
  history: ExerciseHistory;
  /** The one removal that can still be undone, or null. */
  removed: RemovedSet | null;
  onRemove: (setId: number) => void;
  onUndo: () => void;
};

/**
 * This session's sets for the exercise, under the set card, always visible.
 * Each row compares with the same set last time; the footer compares today's
 * volume with last session's (see `todaySummary` for the base).
 *
 * Decisions (TICKET-019):
 * - Colour: improved is `signal`; down, even and matched are `textSecondary`.
 *   Gold against grey is a lightness difference, so improved-vs-down survives
 *   colour-blind use. The three grey verdicts differ by glyph and text — a
 *   caret down, an equals bar, the word "matched" — not by a third colour.
 * - Remove is a small control per row, not a swipe: the pager body is wrapped
 *   in a horizontal fling (ActiveWorkoutScreen) that a row swipe would fight.
 *   Undo is an inline row in the removed set's place, not a toast: the thing
 *   being undone is on screen, and a timed affordance would race the user.
 * - A row with no delta shows nothing in the delta slot — not 0, not a dash
 *   that reads as a value. The card's notice and the footer say why.
 */
export default function TodaySets({ exercise, history, removed, onRemove, onUndo }: Props) {
  const { styles, t } = useThemeStyles(createStyles);
  const numeric = resolveNumericFields(exercise.fields);
  const summary = todaySummary(
    history,
    exercise.sets.map((set) => set.fields),
    exercise.fields
  );
  const volume = volumeText(summary.volume, numeric?.weight.unit);
  const comparison = comparisonText(summary.comparison);

  const rows: React.ReactNode[] = exercise.sets.map((set, index) => {
    const setNumber = index + 1;
    const values = setValuesText(exercise.fields, set.fields);
    const delta = setDelta(history, setNumber, set.fields, numeric);
    return (
      <View key={`set-${set.id}`} style={[styles.row, index > 0 && styles.divider]}>
        <View
          style={styles.rowInfo}
          accessible
          accessibilityLabel={`Set ${setNumber}, ${values.replace("×", "by")}${deltaSpeech(delta)}`}
        >
          <NumericText style={styles.setNumber}>{setNumber}</NumericText>
          <NumericText style={styles.values} numberOfLines={1}>
            {values}
          </NumericText>
          <DeltaBadge delta={delta} styles={styles} t={t} />
        </View>
        <TouchableOpacity
          style={styles.remove}
          onPress={() => onRemove(set.id)}
          accessibilityRole="button"
          accessibilityLabel={`Remove set ${setNumber}: ${values.replace("×", "by")}`}
        >
          <Ionicons name="close" size={16} color={t.colors.role.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  });

  if (removed) {
    const at = Math.min(removed.index, rows.length);
    const values = setValuesText(exercise.fields, removed.set.fields);
    rows.splice(
      at,
      0,
      <View key="undo" style={[styles.row, at > 0 && styles.divider]}>
        <TextBase style={styles.undoText} numberOfLines={1}>
          Set <NumericText style={styles.undoNumber}>{removed.index + 1}</NumericText> removed
        </TextBase>
        <TouchableOpacity
          style={styles.undo}
          onPress={onUndo}
          accessibilityRole="button"
          accessibilityLabel={`Undo: restore set ${removed.index + 1}, ${values.replace("×", "by")}`}
        >
          <TextBase style={styles.undoAction}>Undo</TextBase>
        </TouchableOpacity>
      </View>
    );
  }

  const comparisonColor =
    summary.comparison.kind === "percent" && summary.comparison.direction > 0
      ? t.colors.role.signal
      : t.colors.role.textSecondary;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TextBase style={styles.heading} accessibilityRole="header">
          TODAY
        </TextBase>
        {exercise.sets.length > 0 && (
          <NumericText style={styles.summary}>
            {setCountText(summary.setCount)}
            {volume !== null && (
              <>
                {" · "}
                <NumericText style={summary.volume?.value != null ? styles.summaryValue : styles.summary}>
                  {volume}
                </NumericText>
              </>
            )}
          </NumericText>
        )}
      </View>

      {rows.length === 0 ? (
        <TextBase style={styles.empty}>No sets logged yet</TextBase>
      ) : (
        <View style={styles.list}>
          {rows}
          {comparison !== null && (
            <View style={[styles.footerRow, styles.divider]}>
              {summary.comparison.kind === "percent" && summary.comparison.direction !== 0 && (
                <Ionicons
                  name={summary.comparison.direction > 0 ? "caret-up" : "caret-down"}
                  size={11}
                  color={comparisonColor}
                />
              )}
              <NumericText style={[styles.footerText, { color: comparisonColor }]}>{comparison}</NumericText>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/** ", improved: +1 rep" for the row's spoken label; empty with no delta. */
function deltaSpeech(delta: SetDelta): string {
  if (delta.kind === "none") return "";
  if (delta.verdict === "matched") return ", matched";
  return `, ${delta.verdict}: ${delta.label}`;
}

function DeltaBadge({
  delta,
  styles,
  t,
}: {
  delta: SetDelta;
  styles: ReturnType<typeof createStyles>;
  t: ReturnTypeUseThemeTokens;
}) {
  if (delta.kind === "none") return null;
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

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  container: {
    gap: 9,
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: SPACING.small,
  },
  heading: {
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 1.3,
    color: t.colors.role.textSecondary,
  },
  summary: {
    fontSize: 12,
    color: t.colors.role.textSecondary,
  },
  summaryValue: {
    fontSize: 12,
    color: t.colors.role.textPrimary,
  },
  empty: {
    fontSize: t.fonts.small,
    color: t.colors.role.textSecondary,
  },
  list: {
    backgroundColor: t.colors.role.surface,
    borderWidth: 1,
    borderColor: t.colors.role.hairline,
    borderRadius: 14,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: ROW_HEIGHT,
    paddingLeft: 13,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: t.colors.role.hairline,
  },
  rowInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.medium,
  },
  setNumber: {
    width: 22,
    fontSize: 12,
    // textSecondary, not textGhost: textGhost is cleared for large numerals only.
    color: t.colors.role.textSecondary,
  },
  values: {
    flex: 1,
    fontSize: 15.5,
    color: t.colors.role.textPrimary,
  },
  delta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  deltaText: {
    fontSize: 12,
    fontWeight: "600",
  },
  remove: {
    width: HIT,
    height: HIT,
    alignItems: "center",
    justifyContent: "center",
  },
  undoText: {
    flex: 1,
    fontSize: t.fonts.small,
    color: t.colors.role.textSecondary,
  },
  undoNumber: {
    fontSize: t.fonts.small,
    color: t.colors.role.textSecondary,
  },
  undo: {
    minWidth: HIT * 1.5,
    height: HIT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.medium,
  },
  undoAction: {
    fontSize: t.fonts.small,
    fontWeight: "bold",
    color: t.colors.role.accent,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    minHeight: 40,
    paddingHorizontal: 13,
    backgroundColor: t.colors.role.ground,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
