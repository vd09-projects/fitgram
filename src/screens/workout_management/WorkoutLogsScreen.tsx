import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import ScrollableScreen from "../../components/ScrollableScreen";
import SearchableInputDropdown, { DropdownSelection } from "../../components/SearchableInputDropdown";
import { BORDER_RADIUS, BUTTON_SIZES, SPACING } from "../../constants/styles";
import { WorkoutLog } from "../../types/workoutLogs";
import ExerciseLogTableFlatList from "../../components/ExerciseLogTableFlatList";
import ExerciseSetLogTable from "../../components/ExerciseSetLogTable";
import { TextBase } from "../../components/TextBase";
import TableControls from "../../components/TableControl";
import WorkoutHistoricalLogsFilter, { WorkoutHistoricalDisplayLog } from "../../components/WorkoutHistoricalLogsFilter";
import { Ionicons } from '@expo/vector-icons';
import { ReturnTypeUseThemeTokens } from '../../components/app_manager/ThemeContext';
import { useThemeStyles } from '../../utils/useThemeStyles';

export default function WorkoutLogsScreen() {
  const { styles, t } = useThemeStyles(createStyles);

  // const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[] | null>(null);
  const [displayLog, setDisplayLog] = useState<WorkoutHistoricalDisplayLog | null>(null);
  const workoutLogs = displayLog?.displayData || null;

  const extractFieldKeys = (logs: WorkoutLog[] | null): string[] => {
    return Array.from(new Set(
      logs?.flatMap((log) =>
        log.exercises
          .flatMap((exercise) =>
            exercise.sets.flatMap((set) => Object.keys(set.fields ?? {}))
          ) ?? []
      ) || []
    ));
  };
  var allFieldKeys: string[] = extractFieldKeys(workoutLogs);
  const [visibleHeaders, setVisibleHeaders] = useState<string[]>(allFieldKeys);
  useEffect(() => {
    setVisibleHeaders(extractFieldKeys(workoutLogs));
  }, [workoutLogs]);

  // const toggleHeader = (header: string) => {
  //   setVisibleHeaders((prev) =>
  //     prev.includes(header)
  //       ? prev.filter((h) => h !== header)
  //       : [...prev, header]
  //   );
  // };
  const toggleHeader = (header: string) => {
    setVisibleHeaders((prev) => {
      if (prev.includes(header)) {
        return prev.filter((h) => h !== header);
      } else {
        const newHeaders = [...prev, header];
        return allFieldKeys.filter((h) => newHeaders.includes(h));
      }
    });
  };

  const [isFilterTabEnabled, setIsFilterTabEnabled] = useState<boolean>(true);
  const toggleFilterTab = () => { setIsFilterTabEnabled((prev) => !prev) };

  return (
    <ScrollableScreen
      title={<View style={styles.titleContainer}>
        <TextBase style={styles.title}>Workout Logs</TextBase>
        {workoutLogs && workoutLogs.length > 0 && <TouchableOpacity style={styles.filterIcon} onPress={toggleFilterTab}>
          <Ionicons name="filter" size={BUTTON_SIZES.medium} color={isFilterTabEnabled ? t.colors.textSecondary : t.colors.textPrimary} />
        </TouchableOpacity>}
      </View>}
    >

      <WorkoutHistoricalLogsFilter isVisible={isFilterTabEnabled} setDisplayLog={setDisplayLog} />

      {/* 🔽 Workout Logs */}
      {displayLog && workoutLogs &&
        <View>
          {workoutLogs.length === 0 && (
            <TextBase style={styles.noLogsTitle}>
              No logs found for <TextBase style={{ fontWeight: "bold" }}>{displayLog.ExerciseName}</TextBase>
            </TextBase>
          )}

          {workoutLogs.length !== 0 && (<>
            <TableControls
              selectedFields={visibleHeaders}
              onSelectFields={setVisibleHeaders}
              headers={allFieldKeys}
              toggleFieldSelection={toggleHeader}
            />

            {displayLog.displayType === "SetData" ?
              <ExerciseSetLogTable
                displayLog={displayLog}
                visibleHeaders={visibleHeaders}
              />
              :
              workoutLogs.flatMap((log, logIndex) =>
                log.exercises.map((exercise, exerciseIndex) => (
                  <ExerciseLogTableFlatList
                    key={logIndex + "_" + exerciseIndex}
                    log={exercise}
                    visibleHeaders={visibleHeaders}
                    enableVerticalScroll={false}
                  />
                )))}
          </>)}
        </View>
      }

    </ScrollableScreen>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  titleContainer: { width: '100%', alignItems: 'center', position: 'relative' },
  title: {
    fontSize: t.fonts.xLarge,
    fontWeight: "bold",
    color: t.colors.textPrimary,
    textAlign: "center",
  },
  filterIcon: {
    position: 'absolute',
    right: 0,
    top: '30%',
    transform: [{ translateY: -12 }],
    color: t.colors.textPrimary,
  },
  filtersContainer: {
    marginBottom: SPACING.medium,
  },
  noLogsTitle: {
    fontSize: t.fonts.large,
    color: t.colors.textPrimary,
    textAlign: "center",
    marginTop: SPACING.medium,
  },

  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.medium,
  },
  pageButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: t.colors.button,
    borderRadius: 6,
  },
  pageButtonText: {
    color: t.colors.primary,
    fontWeight: "bold",
  },
  pageText: {
    color: t.colors.textPrimary,
    fontSize: t.fonts.medium,
  },
});