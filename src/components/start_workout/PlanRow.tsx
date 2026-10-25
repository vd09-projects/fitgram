import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TextBase } from "../TextBase";
import { PartsText } from "./PartsText";
import { SPACING } from "../../constants/styles";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { useExerciseHistory } from "../../hooks/useExerciseHistory";
import { useExerciseName } from "../../hooks/useExerciseNames";
import { Exercise } from "../../types/workoutType";
import {
  PlanRow as PlanRowModel,
  TextPart,
  formatSince,
  formatTopSet,
  formatVolume,
  lastTopSet,
} from "../../utils/startWorkout";
import { MaybeTourStep } from "../guide_tour/MaybeTourStep";

const HIT = 44;

/** "6 exercises · last done 7 days ago · 4,980 kg · not uploaded yet" */
function summaryParts(row: PlanRowModel, now: number): TextPart[] {
  const parts: TextPart[] = [
    { text: String(row.exerciseCount), numeric: true },
    { text: row.exerciseCount === 1 ? " exercise" : " exercises" },
  ];
  if (row.lastDoneAt !== null) {
    parts.push({ text: " · last done " }, ...formatSince(row.lastDoneAt, now));
    const volume = formatVolume(row.volume, true);
    if (volume.length > 0) parts.push({ text: " · " }, ...volume);
    // The design has no slot for this; a bare date for a workout that only
    // exists on this phone would overstate what is saved.
    if (row.lastDoneSource === "pending") parts.push({ text: " · not uploaded yet" });
  }
  return parts;
}

/**
 * One plan. Collapsed: name and summary. Expanded (selected): each exercise
 * with its last top set.
 *
 * Exercise names render from the plan immediately; top sets fill in from the
 * history cache once the selection's prefetch lands. Nothing here fetches —
 * `useExerciseHistory` is cache-only.
 */
export function PlanRow({
  row,
  exercises,
  expanded,
  now,
  onPress,
  exerciseListTourStepId,
}: {
  row: PlanRowModel;
  exercises: Exercise[];
  expanded: boolean;
  now: number;
  onPress: () => void;
  exerciseListTourStepId: string;
}) {
  const { styles, t } = useThemeStyles(createStyles);

  return (
    <View style={[styles.card, expanded && styles.cardExpanded]}>
      <TouchableOpacity
        style={styles.header}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ expanded, selected: expanded }}
        accessibilityLabel={row.name}
      >
        <View style={styles.headerText}>
          <TextBase style={styles.name}>{row.name}</TextBase>
          <PartsText parts={summaryParts(row, now)} style={styles.summary} testID={`plan-summary-${row.id}`} />
        </View>
        {expanded ? (
          <View style={styles.check}>
            <Ionicons name="checkmark" size={14} color={t.colors.role.ground} />
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={18} color={t.colors.role.textSecondary} />
        )}
      </TouchableOpacity>

      {expanded && (
        <MaybeTourStep stepId={exerciseListTourStepId} positionType="above">
          <View style={styles.list}>
            <View style={styles.listHeader}>
              <TextBase style={styles.columnLabel}>EXERCISE</TextBase>
              <TextBase style={styles.columnLabel}>LAST TOP SET</TextBase>
            </View>
            {exercises.length === 0 ? (
              <TextBase style={styles.empty}>No exercises in this plan yet</TextBase>
            ) : (
              exercises.map((exercise) => <ExerciseLine key={exercise.id} exercise={exercise} />)
            )}
          </View>
        </MaybeTourStep>
      )}
    </View>
  );
}

function ExerciseLine({ exercise }: { exercise: Exercise }) {
  const { styles } = useThemeStyles(createStyles);
  const history = useExerciseHistory(exercise.id, { fields: exercise.fields });
  const name = useExerciseName(exercise);

  // Idle (not prefetched yet) and loading both mean "not known yet", which is
  // not the same as "never done" — so neither says "not done yet".
  const value: TextPart[] =
    history.status === "idle" || history.status === "loading"
      ? [{ text: "…" }]
      : history.status === "error"
        ? [{ text: "unavailable" }]
        : formatTopSet(lastTopSet(history));

  return (
    <View style={styles.exercise}>
      <View style={styles.nameBlock}>
        {/* Wraps to two lines, never cut (TICKET-041 board B1). */}
        <TextBase style={styles.exerciseName} numberOfLines={2}>
          {name.title}
        </TextBase>
        {name.subtitle !== null && <TextBase style={styles.topSet}>{name.subtitle}</TextBase>}
      </View>
      <PartsText parts={value} style={styles.topSet} testID={`top-set-${exercise.id}`} />
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    card: {
      borderRadius: 16,
      backgroundColor: t.colors.role.surface,
      borderWidth: 1,
      borderColor: t.colors.role.hairline,
      overflow: "hidden",
    },
    cardExpanded: {
      borderColor: t.colors.role.accent,
    },
    header: {
      minHeight: HIT,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.medium,
      paddingVertical: SPACING.medium,
      paddingHorizontal: SPACING.xMedium,
    },
    headerText: {
      flex: 1,
    },
    name: {
      fontSize: t.fonts.medium,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
    },
    summary: {
      marginTop: 3,
      fontSize: t.fonts.small,
      color: t.colors.role.textSecondary,
    },
    check: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.role.accent,
    },
    list: {
      paddingHorizontal: SPACING.xMedium,
      paddingBottom: SPACING.medium,
    },
    listHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingBottom: 7,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.role.hairline,
    },
    columnLabel: {
      fontSize: t.fonts.xSmall,
      letterSpacing: 1.4,
      color: t.colors.role.textSecondary,
    },
    exercise: {
      minHeight: 33,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.small,
    },
    nameBlock: { flex: 1 },
    exerciseName: {
      fontSize: t.fonts.xMedium,
      color: t.colors.role.textPrimary,
    },
    topSet: {
      fontSize: t.fonts.xMedium,
      color: t.colors.role.textSecondary,
    },
    empty: {
      paddingTop: SPACING.small,
      fontSize: t.fonts.xMedium,
      color: t.colors.role.textSecondary,
    },
  });
