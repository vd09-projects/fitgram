import React, { useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING } from "../../constants/styles";
import { ExerciseHistory } from "../../types/exerciseHistory";
import { LoggedExercise } from "../../types/zustandWorkoutType";
import { Effort, EFFORTS } from "../../types/workoutSession";
import { RemovedSet } from "../../stores/useWorkoutStore";
import { resolveNumericFields } from "../../utils/exerciseFields";
import {
  comparisonText,
  setCountText,
  setDelta,
  setValuesText,
  todaySummary,
  volumeText,
} from "../../utils/setDeltas";
import { TextBase, NumericText } from "../TextBase";
import { DeltaBadge, deltaSpeech } from "./DeltaBadge";
import { EffortBadge } from "./EffortBadge";
import { EFFORT_LABEL, effortSpeech } from "../../utils/effort";
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
  /** Mark a set, or clear its mark with null (TICKET-034). */
  onSetEffort: (setId: number, effort: Effort | null) => void;
};

/**
 * This session's sets for the exercise, under the set card, always visible.
 * Each row compares with the same set last time; the footer compares today's
 * volume with last session's (see `todaySummary` for the base).
 *
 * Decisions (TICKET-019):
 * - Colour and glyph per verdict: see `DeltaBadge`, shared with the history
 *   sheet (TICKET-020) so a verdict looks the same in both places.
 * - Remove is a small control per row, not a swipe: the pager body is wrapped
 *   in a horizontal fling (ActiveWorkoutScreen) that a row swipe would fight.
 *   Undo is an inline row in the removed set's place, not a toast: the thing
 *   being undone is on screen, and a timed affordance would race the user.
 * - A row with no delta shows nothing in the delta slot — not 0, not a dash
 *   that reads as a value. The card's notice and the footer say why.
 *
 * Decisions (TICKET-034, canvas boards 6 and 6b):
 * - A mark shows right after the set's values, `65 kg × 6 [H]`; an unmarked
 *   row shows nothing extra. Rejected: an empty slot per row (looked
 *   cluttered beside the remove control), and a column by the set number
 *   (board 6b, kept as the alternative).
 * - Tapping the row opens a strip with Easy / Hard, and Clear once marked.
 *   The row body did nothing before, so this takes no gesture from anything.
 *   Not a swipe, for the same reason as remove; not a long-press, which
 *   nothing on screen would reveal. One strip open at a time; picking a mark
 *   closes it.
 * - The strip closes on remove: set ids are ordinals, so after a removal the
 *   open id would name a different set.
 */
export default function TodaySets({ exercise, history, removed, onRemove, onUndo, onSetEffort }: Props) {
  const { styles, t } = useThemeStyles(createStyles);
  const [openSetId, setOpenSetId] = useState<number | null>(null);
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
    const effort = set.effort ?? null;
    const open = openSetId === set.id;
    return (
      <View key={`set-${set.id}`} style={[open && styles.rowOpen, index > 0 && styles.divider]}>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.rowInfo}
            onPress={() => setOpenSetId(open ? null : set.id)}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={`Set ${setNumber}, ${values.replace("×", "by")}${effortSpeech(effort)}${deltaSpeech(delta)}`}
            accessibilityHint="Mark easy or hard"
          >
            <NumericText style={styles.setNumber}>{setNumber}</NumericText>
            <View style={styles.valuesWrap}>
              <NumericText style={styles.values} numberOfLines={1}>
                {values}
              </NumericText>
              {effort !== null && <EffortBadge effort={effort} />}
            </View>
            <DeltaBadge delta={delta} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.remove}
            onPress={() => {
              setOpenSetId(null);
              onRemove(set.id);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Remove set ${setNumber}: ${values.replace("×", "by")}`}
          >
            <Ionicons name="close" size={16} color={t.colors.role.textSecondary} />
          </TouchableOpacity>
        </View>
        {open && (
          <View style={styles.strip} accessibilityRole="radiogroup" accessibilityLabel={`Mark set ${setNumber}`}>
            {EFFORTS.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.stripOption, effort === option && styles.stripOptionSelected]}
                onPress={() => {
                  setOpenSetId(null);
                  onSetEffort(set.id, option);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: effort === option }}
                accessibilityLabel={EFFORT_LABEL[option]}
              >
                <EffortBadge effort={option} size={18} />
                <TextBase style={styles.stripText}>{EFFORT_LABEL[option]}</TextBase>
              </TouchableOpacity>
            ))}
            {effort !== null && (
              <TouchableOpacity
                style={styles.stripClear}
                onPress={() => {
                  setOpenSetId(null);
                  onSetEffort(set.id, null);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Clear mark on set ${setNumber}`}
              >
                <TextBase style={styles.stripClearText}>Clear</TextBase>
              </TouchableOpacity>
            )}
          </View>
        )}
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
    // The whole row height is the tap target, not just the text.
    minHeight: ROW_HEIGHT,
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
  valuesWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.small,
  },
  values: {
    flexShrink: 1,
    fontSize: 15.5,
    color: t.colors.role.textPrimary,
  },
  rowOpen: {
    backgroundColor: t.colors.role.raised,
  },
  strip: {
    flexDirection: "row",
    gap: SPACING.small,
    paddingLeft: 13 + 22 + SPACING.medium,
    paddingRight: 13,
    paddingBottom: 11,
  },
  stripOption: {
    flex: 1,
    height: HIT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
  },
  stripOptionSelected: {
    backgroundColor: t.colors.role.accentDeep,
    borderColor: t.colors.role.accent,
  },
  stripText: {
    fontSize: t.fonts.small,
    fontWeight: "600",
    color: t.colors.role.textPrimary,
  },
  stripClear: {
    height: HIT,
    justifyContent: "center",
    paddingHorizontal: SPACING.medium,
  },
  stripClearText: {
    fontSize: t.fonts.small,
    fontWeight: "600",
    color: t.colors.role.textSecondary,
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
