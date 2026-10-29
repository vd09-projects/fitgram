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
import { EFFORT_LABEL, effortSpeech, toggleEffort } from "../../utils/effort";
import { splitCountText } from "../../utils/splits";
import { comparisonSegment, plannedSegment, splitSegments } from "../../utils/storedSets";
import { SplitIcon } from "./SetRows";
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
  /** Open the card's edit mode for a set (TICKET-040). */
  onEdit: (setId: number) => void;
  /** The set the card is editing, or null. While set, the list is read-only. */
  editingSetId: number | null;
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
 * - Tapping the row opens a strip with Easy / Hard (TICKET-040 adds Edit and
 *   drops Clear; see below).
 *   The row body did nothing before, so this takes no gesture from anything.
 *   Not a swipe, for the same reason as remove; not a long-press, which
 *   nothing on screen would reveal. One strip open at a time; picking a mark
 *   closes it.
 * - The strip closes on remove and on undo: set ids are ordinals, so after
 *   either the open id would name a different set.
 * - Tapping the mark already chosen clears it (`toggleEffort`), as on the rest
 *   panel.
 *
 * Decisions (TICKET-040, canvas boards 9b and 10):
 * - The strip is three equal buttons: Easy / Hard / Edit. Clear is gone; once
 *   a set is marked a one-line hint says tapping the mark again clears it.
 *   Rejected: Edit beside Easy / Hard / Clear (board 9, four controls,
 *   cluttered), and dropping the strip for an edit card holding the mark too
 *   (board 9c: marking alone would become tap, tap, Save).
 * - While an edit is open the list is read-only: rows do not open, no remove,
 *   and a pending undo reads "Undo after this edit" instead of offering Undo.
 *   Ids are ordinals, so a remove or undo would renumber the set under the
 *   edit and Save would land on another set. Rejected: remove/undo cancelling
 *   the edit (silently drops what was typed), and the edit following its set
 *   through a renumber (more state for a rare path). The removal is not lost:
 *   Undo comes back after Save or Cancel.
 *
 * Decisions (TICKET-033, canvas board S4):
 * - A split set shows its first segment, which is what the delta compares, and
 *   a ⑂N chip for the rows after it. Opening the row lists them above the
 *   strip. Rejected: listing them always, which makes a split set two or three
 *   rows tall in a list read at a glance.
 * - Rows read as `setValuesText` writes them, unit included ("17.5 kg × 3";
 *   the board drew "17.5 × 3"), so a distance × time row keeps its units.
 * - The footer's volume counts every row (`todaySummary`).
 */
export default function TodaySets({
  exercise,
  history,
  removed,
  onRemove,
  onUndo,
  onSetEffort,
  onEdit,
  editingSetId,
}: Props) {
  const { styles, t } = useThemeStyles(createStyles);
  const [openSetId, setOpenSetId] = useState<number | null>(null);
  const numeric = resolveNumericFields(exercise.fields);
  const summary = todaySummary(history, exercise.sets, exercise.fields);
  const volume = volumeText(summary.volume, numeric?.weight.unit);
  const comparison = comparisonText(summary.comparison);

  const rows: React.ReactNode[] = exercise.sets.map((set, index) => {
    const setNumber = index + 1;
    // The row and its delta are the first segment; the rest list under it.
    const values = setValuesText(exercise.fields, plannedSegment(set));
    const delta = setDelta(history, setNumber, comparisonSegment(set), numeric);
    const effort = set.effort ?? null;
    const splits = splitSegments(set).map((row) => setValuesText(exercise.fields, row));
    const splitsSpeech =
      splits.length > 0 ? `, then ${splitCountText(splits.length)}: ${splits.join(", ").replace(/×/g, "by")}` : "";
    const readOnly = editingSetId !== null;
    const editing = editingSetId === set.id;
    const open = !readOnly && openSetId === set.id;
    return (
      <View key={`set-${set.id}`} style={[(open || editing) && styles.rowOpen, index > 0 && styles.divider]}>
        <View style={[styles.row, readOnly && styles.rowReadOnly]}>
          <TouchableOpacity
            style={styles.rowInfo}
            onPress={() => setOpenSetId(open ? null : set.id)}
            disabled={readOnly}
            accessibilityRole="button"
            accessibilityState={{ expanded: open, disabled: readOnly }}
            accessibilityLabel={`Set ${setNumber}, ${values.replace("×", "by")}${splitsSpeech}${effortSpeech(effort)}${
              editing ? ", editing" : deltaSpeech(delta)
            }`}
            accessibilityHint={readOnly ? undefined : "Mark easy or hard, or edit"}
          >
            <NumericText style={styles.setNumber}>{setNumber}</NumericText>
            <View style={styles.valuesWrap}>
              <NumericText style={styles.values} numberOfLines={1}>
                {values}
              </NumericText>
              {splits.length > 0 && (
                <View style={styles.splitChip}>
                  <SplitIcon size={11} color={t.colors.role.textPrimary} />
                  <NumericText style={styles.splitChipText}>{splits.length}</NumericText>
                </View>
              )}
              {effort !== null && <EffortBadge effort={effort} />}
            </View>
            {editing ? <TextBase style={styles.editingLabel}>EDITING</TextBase> : <DeltaBadge delta={delta} />}
          </TouchableOpacity>
          {!readOnly && (
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
          )}
        </View>
        {open && splits.length > 0 && (
          <View style={styles.splitList}>
            {splits.map((text, splitIndex) => (
              <NumericText key={splitIndex} style={styles.splitRow} numberOfLines={1}>
                {text}
              </NumericText>
            ))}
          </View>
        )}
        {open && (
          <View style={styles.strip}>
            <View style={styles.stripMarks} accessibilityRole="radiogroup" accessibilityLabel={`Mark set ${setNumber}`}>
              {EFFORTS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.stripOption, effort === option && styles.stripOptionSelected]}
                  onPress={() => {
                    setOpenSetId(null);
                    onSetEffort(set.id, toggleEffort(effort, option));
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: effort === option }}
                  accessibilityLabel={EFFORT_LABEL[option]}
                  accessibilityHint={effort === option ? "Tap again to clear" : undefined}
                >
                  <EffortBadge effort={option} size={18} />
                  <TextBase style={styles.stripText}>{EFFORT_LABEL[option]}</TextBase>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.stripOption}
              onPress={() => {
                setOpenSetId(null);
                onEdit(set.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Edit set ${setNumber}`}
            >
              <Ionicons name="pencil-outline" size={15} color={t.colors.role.textPrimary} />
              <TextBase style={styles.stripText}>Edit</TextBase>
            </TouchableOpacity>
          </View>
        )}
        {open && effort !== null && (
          <TextBase style={styles.stripHint}>Tap {EFFORT_LABEL[effort]} again to clear it</TextBase>
        )}
      </View>
    );
  });

  if (removed) {
    const at = Math.min(removed.index, rows.length);
    const values = setValuesText(exercise.fields, plannedSegment(removed.set));
    rows.splice(
      at,
      0,
      <View key="undo" style={[styles.row, at > 0 && styles.divider]}>
        <TextBase style={styles.undoText} numberOfLines={1}>
          Set <NumericText style={styles.undoNumber}>{removed.index + 1}</NumericText> removed
        </TextBase>
        {editingSetId !== null ? (
          <TextBase style={styles.undoLater}>Undo after this edit</TextBase>
        ) : (
          <TouchableOpacity
            style={styles.undo}
            onPress={() => {
              setOpenSetId(null);
              onUndo();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Undo: restore set ${removed.index + 1}, ${values.replace("×", "by")}`}
          >
            <TextBase style={styles.undoAction}>Undo</TextBase>
          </TouchableOpacity>
        )}
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
  splitChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
  },
  splitChipText: {
    fontSize: t.fonts.small,
    color: t.colors.role.textPrimary,
  },
  // Indented to the values, as the strip is.
  splitList: {
    paddingLeft: 13 + 22 + SPACING.medium,
    paddingRight: 13,
    paddingBottom: 2,
  },
  splitRow: {
    lineHeight: 30,
    fontSize: t.fonts.xMedium,
    color: t.colors.role.textPrimary,
  },
  rowOpen: {
    backgroundColor: t.colors.role.raised,
  },
  rowReadOnly: {
    // The remove control's slot stays, empty, so values do not shift sideways.
    paddingRight: HIT,
  },
  editingLabel: {
    fontSize: t.fonts.xSmall,
    fontWeight: "bold",
    letterSpacing: 1.2,
    color: t.colors.role.accent,
  },
  strip: {
    flexDirection: "row",
    gap: SPACING.small,
    paddingLeft: 13 + 22 + SPACING.medium,
    paddingRight: 13,
    paddingBottom: 11,
  },
  // Three equal buttons with the marks still grouped for the radiogroup role:
  // basis `gap` covers the gap inside the group, so after it the free width
  // splits 2:1 and each mark gets exactly Edit's width. Plain `flex: 2` left
  // each mark gap/2 narrower than Edit.
  stripMarks: {
    flexGrow: 2,
    flexShrink: 1,
    flexBasis: SPACING.small,
    flexDirection: "row",
    gap: SPACING.small,
  },
  stripHint: {
    fontSize: 12,
    color: t.colors.role.textSecondary,
    paddingLeft: 13 + 22 + SPACING.medium,
    paddingRight: 13,
    paddingBottom: 11,
    marginTop: -4,
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
  undoLater: {
    fontSize: 12,
    color: t.colors.role.textSecondary,
    paddingHorizontal: SPACING.medium,
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
