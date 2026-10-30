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
  ghostNotice,
  ghostValues,
  lastTimeText,
  repeatValues,
  resolveGhostTarget,
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
import {
  buildEditedSegments,
  buildLoggedSet,
  canAddSplit,
  EditRow,
  editRows,
  keptSplitRows,
  lastTimeSplit,
  lastTimeSplitLine,
  repeatedSplitLine,
  repeatSplitRows,
  splitCountText,
  SplitLine,
  SplitRowValues,
} from "../utils/splits";
import { plannedSegment, splitSegments } from "../utils/storedSets";
import SetRows, { SplitIcon } from "./active_workout/SetRows";
import ExerciseMenu, { ExerciseMenuItem } from "./active_workout/ExerciseMenu";
import { useExerciseName } from "../hooks/useExerciseNames";

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
 * - Log and Save share one check (`buildLoggedSet`, via `buildEditedSegments`
 *   since TICKET-033-3): an edit is refused for exactly what logging is
 *   refused for, worded "save".
 * - Saving touches no rest. During a rest the card takes the rest panel's slot
 *   and `EditRestLine` says it keeps counting; Save or Cancel shows the panel
 *   again at the time actually left, its banner re-derived from the edit.
 * - While editing, TodaySets is read-only (see there): no remove or undo can
 *   renumber the set under the edit. The pending undo is kept, not cleared.
 * - Changing exercise unmounts this component and drops an open edit, as it
 *   drops typed values. Finish saves what is stored; an unsaved edit is lost.
 *
 * Decisions (TICKET-033, canvas boards S1–S3):
 * - The fields are `SetRows`, one
 *   row per segment, for a normal set, a split set and an edit alike. Repeat
 *   is hidden once the card has two rows or more, as on the boards: repeat
 *   builds the rows from one (TICKET-033-3), so there is nothing to replace.
 * - One list of rows is the whole draft: `rows[0]` is the set as typed, and a
 *   normal set is just one row. Splitting adds rows; removing rows down to one
 *   is a normal set again. Rejected: the first row held apart from the split
 *   rows, which made removing the first row a special case.
 * - The rows are this component's state: an app kill loses them as it loses
 *   typed values (user, 2026-10-29). Rejected: storing the card's draft, which
 *   would change how every card persists for one feature.
 * - One Log for the whole set. The rows are stored as they are, one segment
 *   each (`ExerciseSet.segments`); a blank last row is dropped
 *   (`buildLoggedSet`). The rest starts once, after the store has the set.
 * - While editing, the rows being typed for the next set wait, untouched.
 *
 * Decisions (TICKET-033-2, canvas boards S5–S6):
 * - Last time's split rides on the pill as `20 × 5 ⑂2`, and a line under the
 *   header lists the rows (`lastTimeSplit`). The pill's numbers stay the first
 *   segment, the one the ghosts and the delta compare.
 * - After repeat, that line reads "Repeated …" instead. The swap lasts until
 *   the card's rows change (typing, split, ×) or the set is logged: after
 *   that "Repeated" would describe values the user has since changed. It is
 *   held for the set number repeated, not as a flag: removing a set in Today
 *   renumbers the card, and the line would then name the new number's
 *   values, which the inputs do not hold (PR #29 review). Undo brings the
 *   number, and the line, back.
 *
 * Decisions (TICKET-033-3, canvas boards S6, S8):
 * - Repeat copies last time's whole set: row 1 from the ghosts as before, then
 *   one row per later segment (`repeatSplitRows`), and the line lists the
 *   chain with "remove rows you didn't do" (user, 2026-10-29). Replaced:
 *   first segment only, "splits not copied". Cost: a row not done this time
 *   logs as a split unless removed; the header count and Today chip show it,
 *   and the edit card fixes it.
 * - The edit card shows every segment of the set as rows, with the same third
 *   column as logging: split adds a row, × removes one, the first included
 *   (user, 2026-10-29: one rule on the card; removing row 1 makes the next row
 *   what today's delta and records compare, as retyping row 1 would). Save
 *   replaces the set's segments whole (`updateSet`); id, mark and rest stay.
 * - Each edit row carries the stored segment it came from (`EditRow`), so
 *   Save keeps that segment's unlisted keys on the right row after a remove.
 *
 * Decisions (TICKET-058, boards MenuLogger–MenuSplitWait):
 * - A split starts from the exercise ⋯ menu, which this component renders (it
 *   owns the rows and the edit the item acts on); the screen owns the ⋯ in the
 *   nav header and whether the menu is open. The one-row card has no third
 *   column. Once split, the card's last row offers split again when filled
 *   (`splitSlot`), and so does the menu's "Split set N again".
 * - The item's set is `setNumber`, the card's: the set being edited while
 *   editing, otherwise the next set, during rest too. A split added during
 *   rest goes on the next set's rows, behind the rest panel; the rest keeps
 *   running. `onAddSplit` is unchanged: only its entry point moved.
 */
export default function ExerciseLogger({
  exercise,
  menuOpen,
  onCloseMenu,
}: {
  exercise: LoggedExercise;
  /** The exercise ⋯ menu, opened from the screen's nav header. */
  menuOpen: boolean;
  onCloseMenu: () => void;
}) {
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
  const name = useExerciseName(exercise);
  /** The next set as typed: the first segment, then any split rows. Never empty. */
  const [rows, setRows] = useState<SplitRowValues[]>([{}]);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [removed, setRemoved] = useState<RemovedSet | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  /** The set being edited (its id, read fresh) and the edit's own rows, one per segment. */
  const [editing, setEditing] = useState<{ setId: number; rows: EditRow[] } | null>(null);
  /** The set number repeat filled, while nothing was typed since (board S6). */
  const [repeatedFor, setRepeatedFor] = useState<number | null>(null);

  const nextSetNumber = exercise.sets.length + 1;
  const editedSet = editing ? exercise.sets.find((set) => set.id === editing.setId) ?? null : null;
  const editedSplitCount = editedSet ? splitSegments(editedSet).length : 0;
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
  const split = history.lastSession ? lastTimeSplit(target, history.lastSession.fields) : null;
  const repeatChain = repeatSplitRows(target, history.numericFields);
  const splitLine: SplitLine | null =
    split === null
      ? null
      : repeatedFor === setNumber && !editedSet && pillText !== null
        ? repeatedSplitLine(pillText, split.rows.slice(0, repeatChain.rows.length), repeatChain.incomplete)
        : lastTimeSplitLine(split);
  const onSetEffort = (setId: number, effort: Effort | null) => setSetEffort(exercise.id, setId, effort);

  // While editing, the card's rows are the edit's; otherwise the next set's.
  const cardRows = editedSet && editing ? editing.rows.map((row) => row.values) : rows;

  const onAddSplit = () => {
    // Empty, every field (user, 2026-10-29): the app does not guess what the
    // next row was. Rejected: weight one step down from the row before, and
    // `other` fields copied from it; both put a number the user never chose in
    // a real value, one stray Log from being stored. In an edit, a new row has
    // no stored segment behind it.
    if (editedSet) {
      setEditing((prev) => prev && { ...prev, rows: [...prev.rows, { values: {}, source: null }] });
    } else {
      setRows((prev) => [...prev, {}]);
      setRepeatedFor(null);
    }
    setRefusal(null);
  };

  const onChangeRow = (index: number, name: string, text: string) => {
    if (editedSet) {
      setEditing(
        (prev) =>
          prev && {
            ...prev,
            rows: prev.rows.map((row, i) => (i === index ? { ...row, values: { ...row.values, [name]: text } } : row)),
          }
      );
    } else {
      setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [name]: text } : row)));
      setRepeatedFor(null);
    }
    setRefusal(null);
  };

  // The only row is never removed: `SetRows` offers × only with two or more.
  const onRemoveRow = (index: number) => {
    if (editedSet) {
      setEditing(
        (prev) => prev && { ...prev, rows: prev.rows.length > 1 ? prev.rows.filter((_, i) => i !== index) : prev.rows }
      );
    } else {
      setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
      setRepeatedFor(null);
    }
    setRefusal(null);
  };

  // Always in the menu, so the menu is never empty. Once split it reads
  // "again" and waits for the last row, the same gate as the card's slot.
  const splitItem: ExerciseMenuItem =
    cardRows.length === 1
      ? {
          key: "split",
          renderIcon: (color) => <SplitIcon size={20} color={color} />,
          title: `Split set ${setNumber}`,
          // The pinned line only where it is true: split is field-generic, and a
          // plank or band set has no weight (PR #32 review, finding 3; user,
          // 2026-10-30). Rejected: one neutral line for all, which loses the
          // clearer wording on the common case.
          detail: exercise.fields.some((field) => field.role === "weight")
            ? "Change the weight partway through this set"
            : "Log this set in parts",
          disabledReason: null,
          onPress: onAddSplit,
        }
      : {
          key: "split",
          renderIcon: (color) => <SplitIcon size={20} color={color} />,
          title: `Split set ${setNumber} again`,
          detail: "Add another row to this set",
          disabledReason: canAddSplit(exercise.fields, cardRows) ? null : "Fill the last row first",
          onPress: onAddSplit,
        };

  // Shown on a one-row card only (hidden once split), so there are no split
  // rows to replace: the chain is added after row 1.
  const onRepeat = () => {
    if (!repeat) return;
    setRows((prev) => [{ ...prev[0], ...repeat }, ...repeatChain.rows]);
    setRepeatedFor(setNumber);
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
    setRepeatedFor(null);
    setRefusal(null);
    await addSetToExercise(exercise.id, { id: setNumber, ...result.set });
    startRest(exercise.id, useRestPreferenceStore.getState().restDurationMs, setNumber);
  };

  const onEdit = (setId: number) => {
    const set = exercise.sets.find((s) => s.id === setId);
    if (!set) return;
    setEditing({ setId, rows: editRows(set.segments) });
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
    const result = buildEditedSegments(exercise.fields, editing.rows, setNumber);
    if (result.kind === "refused") {
      setRefusal(result.message);
      return;
    }
    try {
      await updateSet(exercise.id, editedSet.id, result.segments);
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
                  ? `Last time ${pillText.replace("×", "by")}${
                      split !== null && split.count > 0 ? `, then ${splitCountText(split.count)}` : ""
                    }${effortSpeech(lastEffort?.effort)}. Show history`
                  : "Show history"
              }
            >
              <TextBase style={styles.pillLabel}>{pillText !== null ? "LAST TIME" : "HISTORY"}</TextBase>
              {pillText !== null && <NumericText style={styles.pillValue}>{pillText}</NumericText>}
              {split !== null && split.count > 0 && (
                <View style={styles.pillSplit} testID="pill-split">
                  <SplitIcon size={11} color={t.colors.role.textPrimary} />
                  <NumericText style={styles.pillSplitText}>{split.count}</NumericText>
                </View>
              )}
              {pillText !== null && lastEffort !== null && <EffortBadge effort={lastEffort.effort} />}
              <Ionicons name="chevron-up" size={14} color={t.colors.role.textSecondary} />
            </TouchableOpacity>
          </View>

          {editedSet && (
            <TextBase style={styles.notice}>
              Logged <NumericText style={styles.notice}>{setValuesText(exercise.fields, plannedSegment(editedSet))}</NumericText>
              {editedSplitCount > 0 && ` + ${splitCountText(editedSplitCount)}`}
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
          {splitLine !== null && (
            <TextBase style={styles.notice} testID="split-line">
              {splitLine.lead}
              {splitLine.values !== "" && (
                <NumericText style={[styles.notice, styles.splitLineValues]}>{splitLine.values}</NumericText>
              )}
              {splitLine.tail}
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
                rows={cardRows}
                ghosts={ghosts}
                onChange={onChangeRow}
                onAddSplit={onAddSplit}
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

      <ExerciseMenu visible={menuOpen} title={name.title} items={[splitItem]} onClose={onCloseMenu} />

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
  // Board S5: the count beside the pill's numbers, the Today chip's icon.
  pillSplit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  pillSplitText: {
    fontSize: t.fonts.small,
    color: t.colors.role.textPrimary,
  },
  splitLineValues: {
    color: t.colors.role.textPrimary,
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
