import React, { useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RemovedSet, useWorkoutStore } from "../stores/useWorkoutStore";
import { SPACING } from "../constants/styles";
import { LoggedExercise } from "../types/zustandWorkoutType";
import { useExerciseHistory } from "../hooks/useExerciseHistory";
import {
  ghostNotice,
  ghostValues,
  lastTimeText,
  missingFields,
  missingFieldsMessage,
  repeatValues,
  resolveGhostTarget,
} from "../utils/setLogger";
import { TextBase, NumericText } from "./TextBase";
import SetField from "./active_workout/SetField";
import TodaySets from "./active_workout/TodaySets";
import ExerciseHistorySheet from "./active_workout/ExerciseHistorySheet";
import { ReturnTypeUseThemeTokens } from "./app_manager/ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";
import { MaybeTourStep } from "./guide_tour/MaybeTourStep";
import { ACTIVE_WORKOUT_STEP_NAMES } from "../tour_steps/activeWorkout";

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
 * - The sheet is a sibling overlay rendered here, not a screen: `inputValues`,
 *   the set number and `removed` live in this component and survive it opening
 *   and closing. It is modal; "logging is not blocked" means nothing is lost.
 * - The pill's visual height stays 34; `hitSlop` takes its target to 44 without
 *   moving the card's layout.
 */
export default function ExerciseLogger({ exercise }: { exercise: LoggedExercise }) {
  const { styles, t } = useThemeStyles(createStyles);
  const { addSetToExercise, removeSet, restoreSet } = useWorkoutStore();
  const history = useExerciseHistory(exercise.id);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [refusal, setRefusal] = useState<string | null>(null);
  const [removed, setRemoved] = useState<RemovedSet | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const setNumber = exercise.sets.length + 1;
  const target = resolveGhostTarget(history, setNumber);
  const ghosts = ghostValues(exercise.fields, target, history.numericFields);
  const repeat = repeatValues(ghosts);
  const pillText = lastTimeText(target);
  const notice = ghostNotice(target, history.status);
  const anyStepper = exercise.fields.some((field) => field.role === "weight" || field.role === "reps");

  const onChangeField = (name: string, text: string) => {
    setInputValues((prev) => ({ ...prev, [name]: text }));
    setRefusal(null);
  };

  const onRepeat = () => {
    if (!repeat) return;
    setInputValues((prev) => ({ ...prev, ...repeat }));
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

  const logSet = () => {
    const missing = missingFields(exercise.fields, inputValues);
    if (missing.length > 0) {
      setRefusal(missingFieldsMessage(missing, setNumber));
      return;
    }
    const fields: Record<string, string> = {};
    for (const [name, value] of Object.entries(inputValues)) {
      if (value.trim() !== "") fields[name] = value.trim();
    }
    // Only reachable when every field is optional (all `other`, or none at all).
    // An empty set is a record of nothing; refuse rather than store `{}`.
    if (Object.keys(fields).length === 0) {
      setRefusal(`Enter a value to log set ${setNumber}`);
      return;
    }
    // The store assigns the id; passing the set number keeps this call honest
    // about what that id will be.
    addSetToExercise(exercise.id, { id: setNumber, fields });
    setRemoved(null);
    setInputValues({});
    setRefusal(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.setTitle} accessible accessibilityRole="header" accessibilityLabel={`Set ${setNumber}`}>
            <TextBase style={styles.setTitleText}>SET </TextBase>
            <NumericText style={styles.setTitleText}>{setNumber}</NumericText>
          </View>
          <TouchableOpacity
            style={styles.pill}
            onPress={() => setHistoryOpen(true)}
            hitSlop={PILL_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={
              pillText !== null ? `Last time ${pillText.replace("×", "by")}. Show history` : "Show history"
            }
          >
            <TextBase style={styles.pillLabel}>{pillText !== null ? "LAST TIME" : "HISTORY"}</TextBase>
            {pillText !== null && <NumericText style={styles.pillValue}>{pillText}</NumericText>}
            <Ionicons name="chevron-up" size={14} color={t.colors.role.textSecondary} />
          </TouchableOpacity>
        </View>

        {notice !== null && <TextBase style={styles.notice}>{notice}</TextBase>}

        <MaybeTourStep stepId={ACTIVE_WORKOUT_STEP_NAMES.LOG_FIELDS}>
          {/* Plain View between the tour wrapper and the row: MultiTourSteps
             keeps only flexDirection/height/align on its child and moves the
             rest to its own wrapper, so the row lost its gap and wrap. */}
          <View>
            <View style={styles.fields}>
              {exercise.fields.map((field) => (
                <SetField
                  key={field.name}
                  field={field}
                  value={inputValues[field.name] ?? ""}
                  ghost={ghosts[field.name]}
                  onChange={(text) => onChangeField(field.name, text)}
                  reserveStepperRow={anyStepper}
                />
              ))}
            </View>
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
          {repeat !== null && (
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
                onPress={logSet}
                accessibilityRole="button"
                accessibilityLabel={`Log set ${setNumber}`}
              >
                <Ionicons name="checkmark" size={20} color={t.colors.role.ground} />
                <TextBase style={styles.logButtonText}>Log set </TextBase>
                <NumericText style={styles.logButtonText}>{setNumber}</NumericText>
              </TouchableOpacity>
            </View>
          </MaybeTourStep>
        </View>
      </View>

      <MaybeTourStep stepId={ACTIVE_WORKOUT_STEP_NAMES.LOG_HISTORY}>
        {/* Plain View: MultiTourSteps splits its child's style. */}
        <View>
          <TodaySets
            exercise={exercise}
            history={history}
            removed={removed}
            onRemove={onRemoveSet}
            onUndo={onUndoRemove}
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
  fields: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.medium,
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
