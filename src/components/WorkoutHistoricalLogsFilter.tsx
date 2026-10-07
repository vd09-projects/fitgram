import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import { useAuthUser } from "../hooks/useAuthUser";
import useWorkoutPlans from "../hooks/useWorkoutPlans";
import SearchableInputDropdown, { DropdownSelection } from "./SearchableInputDropdown";
import { Exercise, WorkoutPlan } from "../types/workoutType";
import show from "../utils/toastUtils";
import { getExerciseSessions } from "../services/db/workoutSessions";
import { TextBase } from "./TextBase";
import { BORDER_RADIUS, SPACING } from "../constants/styles";
import { WorkoutLog } from "../types/workoutLogs";
import { ExerciseSessionDoc } from "../types/workoutSession";
import { ReturnTypeUseThemeTokens } from "./app_manager/ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";

/**
 * Adapt stored, exercise-first sessions into the table view model. `SetLog.id`
 * is filled with the set's 1-based position, which is what "set 3" means.
 */
const toWorkoutLogs = (
  sessions: ExerciseSessionDoc[],
  userId: string
): WorkoutLog[] =>
  sessions.map((session) => ({
    id: session.sessionId,
    workoutId: session.workoutId,
    userId,
    exercises: [
      {
        exerciseId: session.exerciseId,
        exerciseName: session.exerciseName,
        timestamp: session.performedAt,
        sets: session.sets.map((fields, index) => ({
          id: index + 1,
          fields,
        })),
      },
    ],
  }));

export type WorkoutHistoricalDisplayLog = {
  displayType: "SetData" | "ExerciseData";
  WorkoutName: string;
  ExerciseName: string;
  SetNumber?: string;
  displayData: WorkoutLog[] | null;
};

type WorkoutHistoricalLogsFilterProps = {
  setWorkoutLogs1?: (logs: WorkoutLog[] | null) => void;
  setDisplayLog: (logs: WorkoutHistoricalDisplayLog | null) => void;
  isVisible?: boolean;
};

export default function WorkoutHistoricalLogsFilter({
  setDisplayLog,
  isVisible = true,
}: WorkoutHistoricalLogsFilterProps) {
  const { styles, t } = useThemeStyles(createStyles);
  const { user } = useAuthUser();
  const { workoutPlans, loadingWorkoutPlans } = useWorkoutPlans(true);

  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[] | null>(null);

  const convertedWorkoutPlans = useMemo(() =>
    workoutPlans.map((plan) => ({
      label: plan.name,
      value: plan,
      isCustom: false,
    })),
    [workoutPlans]
  );
  const [selectedWorkout, setSelectedWorkout] = useState<DropdownSelection<WorkoutPlan> | undefined>(convertedWorkoutPlans[0]);

  const convertedExercises = useMemo(() => {
    return selectedWorkout?.value?.exercises.map((exercise) => ({
      label: exercise.name,
      value: exercise,
      isCustom: false,
    })) || [];
  }, [selectedWorkout]);
  const [selectedExercises, setSelectedExercises] = useState<DropdownSelection<Exercise> | undefined>(convertedExercises ? convertedExercises[0] : undefined);

  const setNumberAllLabel = "All";
  const convertedSetNumber = useMemo(() => {
    const result = [{
      label: setNumberAllLabel,
      value: setNumberAllLabel,
      isCustom: false,
    }];
    if (!workoutLogs) return result;

    // Set number is the set's position. The old "Sets" field was never a set
    // number — it was a per-set column that happened to be seeded into the
    // exercise catalog.
    let maxSets = 0;
    workoutLogs.forEach((log) => {
      log.exercises.forEach((exercise) => {
        maxSets = Math.max(maxSets, exercise.sets.length);
      });
    });
    for (let setNumber = 1; setNumber <= maxSets; setNumber += 1) {
      result.push({
        label: String(setNumber),
        value: String(setNumber),
        isCustom: false,
      });
    }
    return result;
  }, [workoutLogs]);
  const [selectedSetNumber, setSelectedSetNumber] = useState<DropdownSelection<string> | undefined>(convertedSetNumber[0]);

  const [loadingLogs, setLoadingLogs] = useState(false);
  const [FetchNewData, setFetchNewData] = useState(false);

  useEffect(() => {
    if (convertedWorkoutPlans.length > 0 && !selectedWorkout) {
      setSelectedWorkout(convertedWorkoutPlans[0]);
    }
  });
  useEffect(() => {
    if (convertedExercises && convertedExercises.length > 0) {
      setSelectedExercises(convertedExercises[0]);
    }
  }, [selectedWorkout]);
  useEffect(() => {
    setFetchNewData(true);
  }, [selectedExercises]);

  const fetchLogs = async () => {
    if (!selectedWorkout?.value || !selectedExercises?.value) {
      show.warn("Please select a workout and an exercise");
      return;
    }
    if (!user) {
      show.alert("User is not Logined in");
      return;
    }

    let workoutLogsForDisplay = workoutLogs;
    if (FetchNewData) {
      setLoadingLogs(true);
      try {
        const { sessions } = await getExerciseSessions(
          user.uid,
          selectedExercises.value.id,
          50
        );
        // The query is cross-workout now. Narrowing to the selected plan keeps
        // this screen's existing meaning; dropping that filter would show every
        // workout this exercise was done in (TICKET-020's job).
        const logs = toWorkoutLogs(
          sessions.filter(
            (session) => session.workoutId === selectedWorkout.value!.id
          ),
          user.uid
        );
        setWorkoutLogs(logs);
        workoutLogsForDisplay = logs;
      } catch (error) {
        setWorkoutLogs(null);
        console.error("Error fetching logs:", error);
        // Surface the real message: a missing composite index is the likely
        // cause and "Please try again" hides that forever.
        show.alert(
          "Error fetching logs",
          error instanceof Error ? error.message : "Please try again."
        );
      } finally {
        setLoadingLogs(false);
      }
    }

    applyFiltersAndSetLogs(workoutLogsForDisplay);
  };

  const applyFiltersAndSetLogs = (workoutLogsForDisplay: WorkoutLog[] | null) => {
    if (!workoutLogsForDisplay) return;
    if (!selectedWorkout?.value || !selectedExercises?.value) {
      show.warn("Please select a workout and an exercise");
      return;
    }

    let filteredLogs = workoutLogsForDisplay;
    let isExerciseDisplayType = true;

    if (selectedSetNumber && selectedSetNumber.value !== setNumberAllLabel) {
      filteredLogs = filteredLogs
        .map((log) => ({
          ...log,
          exercises: log.exercises.map((exercise) => ({
            ...exercise,
            sets: exercise.sets.filter(
              (set) =>
                String(set.id) === String(selectedSetNumber.value).trim()
            ),
          })),
        }))
        .filter((log) =>
          log.exercises.some((exercise) => exercise.sets.length > 0)
        );
      isExerciseDisplayType = false;
    }

    const displayLog: WorkoutHistoricalDisplayLog = {
      displayType: isExerciseDisplayType ? "ExerciseData" : "SetData",
      WorkoutName: selectedWorkout.value.name,
      ExerciseName: selectedExercises.value.name,
      SetNumber: selectedSetNumber?.value,
      displayData: filteredLogs,
    };

    setDisplayLog(displayLog);
  };


  if (!isVisible) return <></>;
  return (
    <>
      {/* 🔽 Filters */}
      <View style={styles.filtersContainer}>
        <SearchableInputDropdown<WorkoutPlan>
          placeholder="Select Workout"
          data={convertedWorkoutPlans}
          value={selectedWorkout}
          onChange={setSelectedWorkout}
          title="Workout Plan"
          allowCustomInput={false}
          isDataLoading={loadingWorkoutPlans}
        />

        {/* Multi-select Exercise Dropdown (to be implemented later) */}
        <SearchableInputDropdown<Exercise>
          placeholder="Select Exercises"
          data={convertedExercises ?? []}
          value={selectedExercises}
          onChange={setSelectedExercises}
          title="Exercises"
          allowCustomInput={false}
          isDataLoading={loadingWorkoutPlans}
        />

        {workoutLogs && workoutLogs.length > 0 && <View style={styles.filtersContainer}>
          <SearchableInputDropdown<string>
            placeholder="Sets"
            data={convertedSetNumber ?? []}
            value={selectedSetNumber}
            onChange={setSelectedSetNumber}
            title="Sets"
            allowCustomInput={false}
          />
        </View>
        }
      </View>

      {/* 🔘 Show Data Button */}
      <TouchableOpacity style={styles.toggleButton} onPress={fetchLogs}>
        <TextBase style={styles.toggleText}>
          {loadingLogs ? "Loading..." : "Show Data"}
        </TextBase>
      </TouchableOpacity>
    </>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  filtersContainer: {
    marginBottom: SPACING.medium,
  },
  toggleButton: {
    backgroundColor: t.colors.button,
    padding: SPACING.medium,
    borderRadius: BORDER_RADIUS,
    alignItems: "center",
    marginVertical: SPACING.medium,
    flexGrow: 1,
  },
  toggleText: {
    fontSize: t.fonts.medium,
    color: t.colors.textSecondary,
  },
});