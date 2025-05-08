import React from "react";
import {
  StyleSheet,
  Platform,
  UIManager,
} from "react-native";
import { BORDER_RADIUS, COLORS, FONT_SIZES, SPACING } from "../constants/styles";
import { WorkoutLog, SetsString, SetLog } from "../types/workoutLogs";
import { Exercise } from "../types/workoutType";
import { Column } from "./collapsible_table/CollapsibleTableParts";
import CollapsibleSection from "./CollapsibleSection";
import { TextBase } from "./TextBase";
import { CollapsibleTable } from "./collapsible_table/CollapsibleTable";

type Props = {
  workoutLog: WorkoutLog[];
  visibleHeaders?: string[];
  selectedSetNumber: string | undefined;
  selectedExercise: Exercise | undefined;
};

// Enable layout animation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ExerciseSetLogTable({
  workoutLog,
  visibleHeaders = [],
  selectedSetNumber,
  selectedExercise,
}: Props) {
  if (!workoutLog || workoutLog.length === 0) return null;
  if (!selectedExercise) return null;
  if (!selectedSetNumber) return null;

  const allFieldKeys = Array.from(
    new Set(
      workoutLog.flatMap((log) => {
        const selectedExerciseDetails = log.exercises
          .find((exercise) => exercise.exerciseId === selectedExercise.id);
        var fieldKeys = selectedExerciseDetails?.sets
          .flatMap((set) => Object.keys(set.fields ?? {})) ?? [];
        return ["Date", ...fieldKeys];
      })
    )
  );
  // .filter((key) => key !== "Sets");
  const visibleHeadersArray = [...visibleHeaders, "Date"];

  const exerciseDetails = workoutLog.flatMap((log) => {
    return log.exercises
      .filter((exercise) => exercise.exerciseId === selectedExercise.id);
  });
  const setDetails = exerciseDetails.flatMap((exerciseDetail) => {
    const set = exerciseDetail.sets
      .filter((set) => set.fields[SetsString] === selectedSetNumber);
    return set.map((set) => {
      const fields = { ...set.fields };
      fields['Date'] = new Date(exerciseDetail.timestamp).toLocaleDateString() + " " + new Date(exerciseDetail.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return fields;
    });
  });

  // const data = log.sets.map((set) => set.fields);
  const columns: Column<SetLog['fields']>[] = allFieldKeys.map((header) => ({
    key: header,
    label: header.charAt(0).toUpperCase() + header.slice(1),
    align: "center",
    style: header === "Date" ? { width: 100 } : undefined,
  }));
  const visibleColumns: Column<SetLog['fields']>[] = columns.filter((column) =>
    visibleHeadersArray.includes(column.key as string)
  );

  return (
    <CollapsibleSection
      title={<TextBase style={styles.dateText}>Set nu. {selectedSetNumber} - {selectedExercise.name}</TextBase>}
      defaultCollapsed={false}
      collapsibleStyle={styles.container}
    >
      <CollapsibleTable<SetLog['fields']>
        data={setDetails}
        columns={columns}
        visibleColumns={visibleColumns}
      />
    </CollapsibleSection>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.collapsed,
    padding: SPACING.small,
    borderRadius: BORDER_RADIUS,
    marginBottom: SPACING.medium,
  },
  dateText: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.collapsedTitleText,
  }
});