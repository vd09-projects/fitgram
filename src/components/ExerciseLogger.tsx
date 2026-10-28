import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RemovedSet, useWorkoutStore } from "../stores/useWorkoutStore";
import { useRestPreferenceStore } from "../stores/restPreferenceStore";
import { SPACING } from "../constants/styles";
import { LoggedExercise } from "../types/zustandWorkoutType";
import { Effort } from "../types/workoutSession";
import { useExerciseHistory } from "../hooks/useExerciseHistory";
import {
  buildSetFields,
  editInputValues,
  ghostNotice,
  ghostValues,
  lastTimeText,
  repeatValues,
  resolveGhostTarget,
  withUnlistedFields,
} from "../utils/setLogger";
import { TextBase, NumericText } from "./TextBase";
import TodaySets from "./active_workout/TodaySets";
import ExerciseHistorySheet from "./active_workout/ExerciseHistorySheet";
import RestPanel from "./active_workout/RestPanel";
import EditRestLine from "./active_workout/EditRestLine";
import { ReturnTypeUseThemeTokens } from "./app_manager/ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";
import { MaybeTourStep } from "./guide_tour/MaybeTourStep";
import { ACTIVE_WORKOUT_STEP_NAMES } from "../tour_steps/activeWorkout";
import { EffortBadge } from "./active_workout/EffortBadge";
import { effortSpeech, lastTimeEffort } from "../utils/effort";
import { formatSessionDate, setValuesText } from "../utils/setDeltas";
import { buildLoggedSet, keptSplitRows, splitCountText, SplitRowValues } from "../utils/splits";
import SetRows from "./active_workout/SetRows";

const HIT = 44;
const ACTION_HEIGHT = 56;
const PILL_HEIGHT = 34;
const PILL_HIT_SLOP = { top: (HIT - PILL_HEIGHT) / 2, bottom: (HIT - PILL_HEIGHT) / 2 };

/**
 * The set card: one large field per exercise field, last session's matching
 * set as ghost placeholders, steppers, repeat, and Log set.
 *
 * Decisions (TICKET-018):
 * - An untouched field is incomplete, not "log the ghost". Log set refuses and
 *   names the missing fields; repeat is the explicit way to take the target.
 *   Role `other` fields are optional (see `missingFields`).
 * - The pill opens the history sheet (TICKET-020; was inert until then). See
 *   the TICKET-020 notes below.
 * - Ghosts come from `setAt(sets.length + 1)`. Set ids are 1-based sequential
 *   (`addSetToExercise` assigns them), so the next set's number, its id and the
 *   `setAt` index all agree.
 *
 * Decisions (TICKET-019):
 * - The Today list sits below the card, always visible, replacing the
 *   collapsed log-history table that sat above it.
 * - One undoable removal at a time, held here. It is cleared by logging a set
 *   (the list has moved on), and by changing exercise or a successful Finish,
 *   both of which unmount this component. A refused Finish keeps it: nothing
 *   was saved and the workout is still open, so the undo is still accurate.
 *
 * Decisions (TICKET-020):
 * - The pill is a button with the design's chevron, and it is always shown:
 *   "LAST TIME 65 × 8" when there is a target, "HISTORY" otherwise. Shown only
 *   with a target, a first-time exercise, a plank or a unit change could never
 *   reach the sheet, whose empty state and notices exist for exactly those.
 * - The sheet is a sibling overlay rendered here, not a screen: `rows`,
 *   the set number and `removed` live in this component and survive it opening
 *   and closing. It is modal; "logging is not blocked" means nothing is lost.
 * - The pill's visual height stays 34; `hitSlop` takes its target to 44 without
 *   moving the card's layout.
 *
 * Decisions (TICKET-021):
 * - Logging a set starts a rest, and `RestPanel` takes the card's slot until
 *   Skip. It is rendered in place of the card, not around it: `rows`,
 *   `removed` and the set number stay in this component, and the Today list's
 *   position in the tree does not change, so nothing below is remounted.
 * - The rest shows only on the exercise that started it (`rest.exerciseId`).
 *   Moving to another exercise shows that one's card, so a superset is not
 *   blocked; coming back shows the same rest, still counting from its start.
 * - The rest starts after the store has the set, not before: the banner is
 *   derived from the last set in the list and would otherwise judge the
 *   previous one for a frame.
 *
 * Decisions (TICKET-034, canvas board 7):
 * - Last time's mark for this set rides on the pill beside its numbers, and a
 *   line under the header spells it out with the date. The pill alone is easy
 *   to miss; the line alone loses the pairing with the numbers.
 * - From the last session only (`lastTimeEffort`). It records and shows: the
 *   ghost target and the rest duration do not read it.
 *
 * Decisions (TICKET-040, canvas boards 10-12):
 * - Edit, not remove + re-log: ids are positions and every comparison reads
 *   them, so an edit never moves a set. Re-logging would start a rest, drop the
 *   effort mark, and need a reorder.
 * - The card itself switches to edit mode: "EDIT SET N", inputs prefilled with
 *   the set's values, Cancel in the repeat button's place, "Save set N".
 *   Ghosts, the pill and "felt … last time" are last session's set N, the set
 *   being corrected, not the next one.
 * - The edit's values are held apart from `rows`, so whatever was typed
 *   for the next set comes back after Save or Cancel.
 * - Log and Save share `buildSetFields`: an edit is refused for exactly what
 *   logging is refused for, worded "save".
 * - Saving touches no rest. During a rest the card takes the rest panel's slot
 *   and `EditRestLine` says it keeps counting; Save or Cancel shows the panel
 *   again at the time actually left, its banner re-derived from the edit.
 * - While editing, TodaySets is read-only (see there): no remove or undo can
 *   renumber the set under the edit. The pending undo is kept, not cleared.
 * - Changing exercise unmounts this component and drops an open edit, as it
 *   drops typed values. Finish saves what is stored; an unsaved edit is lost.
 *
 * Decisions (TICKET-033, canvas boards S1–S3):
 * - A third column beside the fields holds split. The fields are `SetRows`, one
 *   row per segment, for a normal set, a split set and an edit alike. Once
 *   split, repeat is hidden, as on the boards: repeat fills one set's targets,
 *   and a split is past that point.
 * - One list of rows is the whole draft: `rows[0]` is the set as typed, and a
 *   normal set is just one row. Splitting adds rows; removing rows down to one
 *   is a normal set again. Rejected: the first row held apart from the split
 *   rows, which made removing the first row a special case.
 * - The rows are this component's state: an app kill loses them as it loses
 *   typed values (user, 2026-10-29). Rejected: storing the card's draft, which
 *   would change how every card persists for one feature.
 * - One Log for the whole set. The first row is the set (`fields`); the rest go
 *   to `splits`; a blank last row is dropped (`buildLoggedSet`). The rest
 *   starts once, after the store has the set.
 * - No split while editing a logged set: changing a set's rows is TICKET-033-3.
 *   An edit keeps the set's rows as they were (`updateSet` replaces `fields`
 *   only), and the rows being typed for the next set wait.
 */
export default function ExerciseLogger({ exercise }: { exercise: LoggedExercise }) {
  const { styles, t } = useThemeStyles(createStyles);
  const {
    addSetToExercise,
    updateSet,
    removeSet,
    restoreSet,
    setSetEffort,
    rest,
    startRest,
    addRestTime,
    endRest,
  } = useWorkoutStore();
  const history = useExerciseHistory(exercise.id);
  /** The next set as typed: the first segment, then any split rows. Never empty. */
  const [rows, setRows] = useState<SplitRowValues[]>([{}]);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [removed, setRemoved] = useState<RemovedSet | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  /** The set being edited (its id, read fresh) and the edit's own values. */
  const [editing, setEditing] = useState<{ setId: number; values: Record<string, string> } | null>(null);

  const nextSetNumber = exercise.sets.length + 1;
  const editedSet = editing ? exercise.sets.find((set) => set.id === editing.setId) ?? null : null;
  // Ids are ordinals, so the edited set's id is its number.
  const setNumber = editedSet ? editedSet.id : nextSetNumber;
  const splitting = !editedSet && rows.length > 1;
  // What Log would store, not the rows on screen: a blank last row is dropped
  // on Log, so counting it would promise a split that is not saved. None while
  // editing: the rows typed for the next set are waiting, not shown.
  const splitCount = splitting ? keptSplitRows(exercise.fields, rows.slice(1)).length : 0;
  const splitText = splitCount > 0 ? splitCountText(splitCount) : null;

  // An edit whose set is gone is over. Without this, `editing` would outlive
  // its set and reopen with old values if a set with that id came back. No path
  // reaches it today (the list is read-only while editing); this keeps the next
  // path that changes sets from finding it.
  useEffect(() => {
    if (editing && !editedSet) setEditing(null);
  }, [editing, editedSet]);
  const target = resolveGhostTarget(history, setNumber);
  const ghosts = ghostValues(exercise.fields, target, history.numericFields);
  const repeat = repeatValues(ghosts);
  const pillText = lastTimeText(target);
  const notice = ghostNotice(target, history.status);
  const lastEffort = lastTimeEffort(history, setNumber);
  const onSetEffort = (setId: number, effort: Effort | null) => setSetEffort(exercise.id, setId, effort);

  const onAddSplit = () => {
    // Empty, every field (user, 2026-10-29): the app does not guess what the
    // next row was. Rejected: weight one step down from the row before, and
    // `other` fields copied from it; both put a number the user never chose in
    // a real value, one stray Log from being stored.
    setRows((prev) => [...prev, {}]);
    setRefusal(null);
  };

  // While editing, the card shows the edit's one row, so index 0 is the edit.
  const onChangeRow = (index: number, name: string, text: string) => {
    if (editedSet) {
      setEditing((prev) => prev && { ...prev, values: { ...prev.values, [name]: text } });
    } else {
      setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [name]: text } : row)));
    }
    setRefusal(null);
  };

  // The last row is never removed: `SetRows` offers × only with two or more.
  const onRemoveRow = (index: number) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
    setRefusal(null);
  };

  const onRepeat = () => {
    if (!repeat) return;
    setRows((prev) => [{ ...prev[0], ...repeat }, ...prev.slice(1)]);
    setRefusal(null);
  };

  // A second removal replaces the first: the first is already committed, and
  // its undo is gone. That keeps the list to one undo row.
  const onRemoveSet = async (setId: number) => {
    setRemoved(await removeSet(exercise.id, setId));
  };

  const onUndoRemove = async () => {
    if (!removed) return;
    setRemoved(null);
    await restoreSet(exercise.id, removed);
  };

  const logSet = async () => {
    const result = buildLoggedSet(exercise.fields, rows, setNumber);
    if (result.kind === "refused") {
      setRefusal(result.message);
      return;
    }
    // The store assigns the id; passing the set number keeps this call honest
    // about what that id will be.
    setRemoved(null);
    setRows([{}]);
    setRefusal(null);
    await addSetToExercise(exercise.id, { id: setNumber, ...result.set });
    startRest(exercise.id, useRestPreferenceStore.getState().restDurationMs, setNumber);
  };

  const onEdit = (setId: number) => {
    const set = exercise.sets.find((s) => s.id === setId);
    if (!set) return;
    setEditing({ setId, values: editInputValues(set) });
    setRefusal(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setRefusal(null);
  };

  // No rest call and no `setRemoved`: an edit leaves the rest and a pending
  // undo as they were. Closed after the store write, so a failed write leaves
  // the edit open with its values and says so.
  const saveEdit = async () => {
    if (!editedSet || !editing) return;
    const result = buildSetFields(exercise.fields, editing.values, setNumber, "save");
    if (result.kind === "refused") {
      setRefusal(result.message);
      return;
    }
    try {
      await updateSet(exercise.id, editedSet.id, withUnlistedFields(exercise.fields, editedSet.fields, result.fields));
    } catch {
      setRefusal(`Couldn't save set ${setNumber}`);
      return;
    }
    cancelEdit();
  };

  const resting = rest !== null && rest.exerciseId === exercise.id;

  return (
    <View style={styles.container}>
      {resting && !editedSet ? (
        <RestPanel
          rest={rest}
          exercise={exercise}
          history={history}
          onSkip={endRest}
          onAddTime={addRestTime}
          onOpenHistory={() => setHistoryOpen(true)}
          onSetEffort={onSetEffort}
        />
      ) : (
        <View style={[styles.card, editedSet && styles.cardEditing]}>
          <View style={styles.header}>
            <View
              style={styles.setTitle}
              accessible
              accessibilityRole="header"
              accessibilityLabel={
                editedSet
                  ? `Edit set ${setNumber}`
                  : `Set ${setNumber}${splitText ? `, ${splitText}` : ""}`
              }
            >
              <TextBase style={[styles.setTitleText, editedSet && styles.editTitleText]}>
                {editedSet ? "EDIT SET " : "SET "}
              </TextBase>
              <NumericText style={[styles.setTitleText, editedSet && styles.editTitleText]}>{setNumber}</NumericText>
              {splitText && <TextBase style={styles.splitCount}>{` · ${splitText}`}</TextBase>}
            </View>
            <TouchableOpacity
              style={styles.pill}
              onPress={() => setHistoryOpen(true)}
              hitSlop={PILL_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={
                pillText !== null
                  ? `Last time ${pillText.replace("×", "by")}${effortSpeech(lastEffort?.effort)}. Show history`
                  : "Show history"
              }
            >
              <TextBase style={styles.pillLabel}>{pillText !== null ? "LAST TIME" : "HISTORY"}</TextBase>
              {pillText !== null && <NumericText style={styles.pillValue}>{pillText}</NumericText>}
              {pillText !== null && lastEffort !== null && <EffortBadge effort={lastEffort.effort} />}
              <Ionicons name="chevron-up" size={14} color={t.colors.role.textSecondary} />
            </TouchableOpacity>
          </View>

          {editedSet && (
            <TextBase style={styles.notice}>
              Logged <NumericText style={styles.notice}>{setValuesText(exercise.fields, editedSet.fields)}</NumericText>
              {" · mark and position stay"}
            </TextBase>
          )}
          {editedSet && resting && <EditRestLine rest={rest} />}
          {lastEffort !== null && (
            <TextBase style={styles.notice}>
              Felt {lastEffort.effort} last time ·{" "}
              <NumericText style={styles.notice}>{formatSessionDate(lastEffort.performedAt)}</NumericText>
            </TextBase>
          )}
          {notice !== null && <TextBase style={styles.notice}>{notice}</TextBase>}

          <MaybeTourStep stepId={ACTIVE_WORKOUT_STEP_NAMES.LOG_FIELDS}>
            {/* Plain View between the tour wrapper and the row: MultiTourSteps
               keeps only flexDirection/height/align on its child and moves the
               rest to its own wrapper, so the row lost its gap and wrap. */}
            <View>
              <SetRows
                fields={exercise.fields}
                setNumber={setNumber}
                rows={editedSet && editing ? [editing.values] : rows}
                ghosts={ghosts}
                onChange={onChangeRow}
                onAddSplit={editedSet ? undefined : onAddSplit}
                onRemove={onRemoveRow}
              />
            </View>
          </MaybeTourStep>

          {refusal !== null && (
            <TextBase style={styles.refusal} accessibilityLiveRegion="polite" accessibilityRole="alert">
              {refusal}
            </TextBase>
          )}

          <View style={styles.actions}>
            {/* Hidden, not disabled, when there is nothing to repeat: a dimmed
               icon-only button gave no hint why, and the notice line already
               says why there is no target. Log set takes the width. */}
            {editedSet ? (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={cancelEdit}
                accessibilityRole="button"
                accessibilityLabel={`Cancel editing set ${setNumber}`}
              >
                <TextBase style={styles.cancelText}>Cancel</TextBase>
              </TouchableOpacity>
            ) : repeat !== null && !splitting && (
              <TouchableOpacity
                style={styles.repeatButton}
                onPress={onRepeat}
                accessibilityRole="button"
                accessibilityLabel={
                  pillText
                    ? `Repeat last session's set ${setNumber}: ${pillText.replace("×", "by")}`
                    : `Repeat last session's set ${setNumber}`
                }
              >
                <Ionicons name="refresh" size={22} color={t.colors.role.textSecondary} />
              </TouchableOpacity>
            )}

            <MaybeTourStep stepId={ACTIVE_WORKOUT_STEP_NAMES.SAVE_EXERCISE_SET}>
              {/* Plain View between the tour wrapper and the button: MultiTourSteps
                 splits its child's style and would leave the touchable shrink-wrapped
                 to its content, so taps off-centre missed. */}
              <View style={styles.logWrap}>
                <TouchableOpacity
                  style={styles.logButton}
                  onPress={editedSet ? saveEdit : logSet}
                  accessibilityRole="button"
                  accessibilityLabel={`${editedSet ? "Save" : "Log"} set ${setNumber}`}
                >
                  <Ionicons name="checkmark" size={20} color={t.colors.role.ground} />
                  <TextBase style={styles.logButtonText}>{editedSet ? "Save set " : "Log set "}</TextBase>
                  <NumericText style={styles.logButtonText}>{setNumber}</NumericText>
                </TouchableOpacity>
              </View>
            </MaybeTourStep>
          </View>
        </View>
      )}

      <MaybeTourStep stepId={ACTIVE_WORKOUT_STEP_NAMES.LOG_HISTORY}>
        {/* Plain View: MultiTourSteps splits its child's style. */}
        <View>
          <TodaySets
            exercise={exercise}
            history={history}
            removed={removed}
            onRemove={onRemoveSet}
            onUndo={onUndoRemove}
            onSetEffort={onSetEffort}
            onEdit={onEdit}
            editingSetId={editedSet ? editedSet.id : null}
          />
        </View>
      </MaybeTourStep>

      <ExerciseHistorySheet
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        exercise={exercise}
        history={history}
        setNumber={setNumber}
      />
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  container: {
    paddingVertical: 15,
    gap: SPACING.xMedium,
  },
  card: {
    backgroundColor: t.colors.role.surface,
    borderWidth: 1,
    borderColor: t.colors.role.hairline,
    borderRadius: 16,
    paddingHorizontal: SPACING.xMedium,
    paddingTop: SPACING.xMedium,
    paddingBottom: SPACING.large,
    gap: SPACING.large,
  },
  cardEditing: {
    borderColor: t.colors.role.accent,
  },
  editTitleText: {
    color: t.colors.role.accent,
  },
  cancelButton: {
    width: 104,
    height: ACTION_HEIGHT,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
  },
  cancelText: {
    fontSize: t.fonts.medium,
    fontWeight: "600",
    color: t.colors.role.textPrimary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 34,
  },
  setTitle: {
    flexDirection: "row",
    alignItems: "center",
  },
  setTitleText: {
    fontSize: t.fonts.small,
    fontWeight: "bold",
    letterSpacing: 1.7,
    color: t.colors.role.textPrimary,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: PILL_HEIGHT,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: t.colors.role.raised,
    borderWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
  },
  pillLabel: {
    fontSize: t.fonts.xSmall,
    letterSpacing: 1,
    color: t.colors.role.textSecondary,
  },
  pillValue: {
    fontSize: 13,
    color: t.colors.role.textPrimary,
  },
  notice: {
    // textSecondary, not textGhost: textGhost is cleared for large numerals only.
    fontSize: t.fonts.small,
    color: t.colors.role.textSecondary,
    marginTop: -SPACING.small,
  },
  splitCount: {
    fontSize: t.fonts.small,
    color: t.colors.role.textSecondary,
  },
  refusal: {
    fontSize: t.fonts.small,
    color: t.colors.role.textPrimary,
    marginTop: -SPACING.small,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  repeatButton: {
    width: ACTION_HEIGHT,
    height: ACTION_HEIGHT,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
  },
  logWrap: {
    flex: 1,
  },
  logButton: {
    height: ACTION_HEIGHT,
    minHeight: HIT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.small,
    borderRadius: 15,
    backgroundColor: t.colors.role.accent,
  },
  logButtonText: {
    fontSize: t.fonts.medium,
    fontWeight: "bold",
    color: t.colors.role.ground,
  },
});
