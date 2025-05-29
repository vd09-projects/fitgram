import React from "react";
import {
  StyleSheet,
  Platform,
  UIManager,
} from "react-native";
import { BORDER_RADIUS, COLORS, FONT_SIZES, SPACING } from "../constants/styles";
import { WorkoutLog, SetsString, SetLog } from "../types/workoutLogs";
import { Column } from "./collapsible_table/CollapsibleTableParts";
import CollapsibleSection from "./CollapsibleSection";
import { TextBase } from "./TextBase";
import { CollapsibleTable } from "./collapsible_table/CollapsibleTable";
import { WorkoutHistoricalDisplayLog } from "./WorkoutHistoricalLogsFilter";
import { ReturnTypeUseThemeTokens } from "./ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";

type Props = {
  displayLog: WorkoutHistoricalDisplayLog;
  visibleHeaders?: string[];
};

// Enable layout animation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const extractFieldKeys = (logs: WorkoutLog[] | null, defaultKeys?: string[]): string[] => {
  const { styles } = useThemeStyles(createStyles);
  var keys = Array.from(new Set(
    logs?.flatMap((log) =>
      log.exercises
        .flatMap((exercise) =>
          exercise.sets.flatMap((set) => Object.keys(set.fields ?? {}))
        ) ?? []
    ) || []
  ));
  return defaultKeys ? [...defaultKeys, ...keys] : keys;
};

export default function ExerciseSetLogTable({
  displayLog,
  visibleHeaders = [],
}: Props) {
  const { styles } = useThemeStyles(createStyles);
  const workoutLog = displayLog?.displayData || null;
  if (!workoutLog || workoutLog.length === 0) return null;

  const allFieldKeys = extractFieldKeys(workoutLog, ["Date"]);
  const visibleHeadersArray = ["Date", ...visibleHeaders];

  const exerciseDetails = workoutLog.flatMap((log) => { return log.exercises; });
  const setDetails = exerciseDetails.flatMap((exerciseDetail) => {
    const set = exerciseDetail.sets;
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
      title={<TextBase style={styles.dateText}>Set nu. {displayLog.SetNumber} | {displayLog.WorkoutName} | {displayLog.ExerciseName}</TextBase>}
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

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  container: {
    backgroundColor: t.colors.collapsed,
    padding: SPACING.small,
    borderRadius: BORDER_RADIUS,
    marginBottom: SPACING.medium,
  },
  dateText: {
    fontSize: FONT_SIZES.medium,
    color: t.colors.collapsedTitleText,
  }
});