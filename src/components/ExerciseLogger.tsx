import React, { useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useWorkoutStore } from "../stores/useWorkoutStore";
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
import ActiveExerciseLogHistory from "./ActiveExerciseLogHistory";
import { ReturnTypeUseThemeTokens } from "./app_manager/ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";
import { MaybeTourStep } from "./guide_tour/MaybeTourStep";
import { ACTIVE_WORKOUT_STEP_NAMES } from "../tour_steps/activeWorkout";

const HIT = 44;
const ACTION_HEIGHT = 56;

/**
 * The set card: one large field per exercise field, last session's matching
 * set as ghost placeholders, steppers, repeat, and Log set.
 *
 * Decisions (TICKET-018):
 * - An untouched field is incomplete, not "log the ghost". Log set refuses and
 *   names the missing fields; repeat is the explicit way to take the target.
 *   Role `other` fields are optional (see `missingFields`).
 * - The "Last time" pill is inert until TICKET-020 builds the history sheet it
 *   opens. It is drawn without the design's chevron and without a button role,
 *   so it does not offer an action that does nothing.
 * - Ghosts come from `setAt(sets.length + 1)`. Set ids are 1-based sequential
 *   (`addSetToExercise` assigns them), so the next set's number, its id and the
 *   `setAt` index all agree.
 */
export default function ExerciseLogger({ exercise }: { exercise: LoggedExercise }) {
  const { styles, t } = useThemeStyles(createStyles);
  const { addSetToExercise } = useWorkoutStore();
  const history = useExerciseHistory(exercise.id);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [refusal, setRefusal] = useState<string | null>(null);

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
    setInputValues({});
    setRefusal(null);
  };

  return (
    <View style={styles.container}>
      <MaybeTourStep stepId={ACTIVE_WORKOUT_STEP_NAMES.LOG_HISTORY}>
        <ActiveExerciseLogHistory key={exercise.id} exercise={exercise} />
      </MaybeTourStep>

      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.setTitle} accessible accessibilityRole="header" accessibilityLabel={`Set ${setNumber}`}>
            <TextBase style={styles.setTitleText}>SET </TextBase>
            <NumericText style={styles.setTitleText}>{setNumber}</NumericText>
          </View>
          {pillText !== null && (
            <View style={styles.pill} accessible accessibilityLabel={`Last time ${pillText.replace("×", "by")}`}>
              <TextBase style={styles.pillLabel}>LAST TIME</TextBase>
              <NumericText style={styles.pillValue}>{pillText}</NumericText>
            </View>
          )}
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
    height: 34,
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
