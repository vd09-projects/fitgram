import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import { useAuthUser } from "../hooks/useAuthUser";
import { useWorkoutPlansOnFocus } from "../hooks/useWorkoutPlansOnFocus";
import SearchableInputDropdown, { DropdownSelection } from "./SearchableInputDropdown";
import { Exercise, WorkoutPlan } from "../types/workoutType";
import show from "../utils/toastUtils";
import { getExerciseSessions, getWorkoutSessions } from "../services/db/workoutSessions";
import { TextBase } from "./TextBase";
import { BORDER_RADIUS, SPACING } from "../constants/styles";
import { WorkoutLog } from "../types/workoutLogs";
import { ExerciseSessionDoc } from "../types/workoutSession";
import { ReturnTypeUseThemeTokens } from "./app_manager/ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";
import { useExerciseNames } from "../hooks/useExerciseNames";
import { useCatalogStore } from "../stores/useCatalogStore";
import { exerciseDisplayName, type CatalogIndex } from "../utils/catalog";
import { decodeStoredSets, plannedSegment } from "../utils/storedSets";
import { FREESTYLE_HISTORY_WINDOW, freestyleHistoryEntry } from "../utils/freestyleHistory";
import { FREESTYLE_ID } from "../constants/freestyle";
import { WorkoutSessionDoc } from "../types/workoutSession";

/**
 * Adapt stored, exercise-first sessions into the table view model. `SetLog.id`
 * is filled with the set's 1-based position, which is what "set 3" means.
 */
const toWorkoutLogs = (
  sessions: ExerciseSessionDoc[],
  userId: string,
  catalogIndex: CatalogIndex | null
): WorkoutLog[] =>
  sessions.map((session) => ({
    id: session.sessionId,
    workoutId: session.workoutId,
    userId,
    exercises: [
      {
        exerciseId: session.exerciseId,
        // Built from the session's own version id; its stored name is the
        // fallback (TICKET-042).
        exerciseName: exerciseDisplayName(
          { id: session.exerciseId, nameSnapshot: session.exerciseName },
          catalogIndex
        ).title,
        timestamp: session.performedAt,
        // Each set's first segment only, through the decoder: this older log
        // view has one row per set, its id the position, so a split set's
        // later segments and its mark are not shown here (as before
        // TICKET-055). Showing them is a change to this screen, not to the
        // stored shape.
        sets: decodeStoredSets(session.sets).map((set, index) => ({
          id: index + 1,
          fields: plannedSegment(set),
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
  const { workoutPlans, loadingWorkoutPlans } = useWorkoutPlansOnFocus();

  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[] | null>(null);

  // Freestyle (TICKET-067): its recent sessions, for the entry and its
  // exercises (`freestyleHistoryEntry`). Read on every focus, not on mount:
  // History is a single copy that stays mounted under the other tabs, so a
  // mount-only read never saw a Freestyle finished after History was first
  // opened, and the first one ever had no entry at all (PR #46 review). One
  // read per visit. A failed read says so rather than leaving the entry out
  // silently, which would read as "never done a Freestyle"; the next visit
  // retries. The filter's plans come from the plans store (TICKET-070), checked
  // on focus too: `WorkoutLogsScreen` is `singleCopy`, so it mounts once.
  const uid = user?.uid;
  const [freestyleSessions, setFreestyleSessions] = useState<WorkoutSessionDoc[]>([]);
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let live = true;
      getWorkoutSessions(uid, { workoutId: FREESTYLE_ID, pageSize: FREESTYLE_HISTORY_WINDOW })
        .then(({ sessions }) => live && setFreestyleSessions(sessions))
        .catch((error) => {
          console.error("Error fetching Freestyle sessions:", error);
          if (live) show.warn("Freestyle history did not load", "Plans are unaffected. Open History again to retry.");
        });
      return () => {
        live = false;
      };
    }, [uid])
  );
  // Left out until the plans have loaded, for two reasons (PR #46 review):
  // the entry is listed after the plans so the first plan stays the default
  // selection, and a Freestyle read landing first would otherwise be the only
  // entry and be selected; and a custom exercise takes its name from the plans.
  const freestyleEntry = useMemo(
    () => (loadingWorkoutPlans ? null : freestyleHistoryEntry(freestyleSessions, workoutPlans)),
    [loadingWorkoutPlans, freestyleSessions, workoutPlans]
  );

  const convertedWorkoutPlans = useMemo(() =>
    [...workoutPlans, ...(freestyleEntry ? [freestyleEntry] : [])].map((plan) => ({
      label: plan.name,
      value: plan,
      isCustom: false,
    })),
    [workoutPlans, freestyleEntry]
  );
  const [selectedWorkout, setSelectedWorkout] = useState<DropdownSelection<WorkoutPlan> | undefined>(convertedWorkoutPlans[0]);
  // The selection as currently listed, looked up by id. Each focus re-read
  // builds a new Freestyle entry, and the dropdown matches its value by deep
  // equality, so a selection holding the old entry showed "Choose Select
  // Workout" and kept the old exercise list (device run, 2026-11-04). By id,
  // the dropdown and the exercise list always read the fresh entry, and the
  // chosen exercise is kept. Plans' ids are unique, and Freestyle's cannot
  // collide with them (FREESTYLE_ID).
  const currentWorkout = useMemo(
    () => convertedWorkoutPlans.find((option) => option.value.id === selectedWorkout?.value?.id) ?? selectedWorkout,
    [convertedWorkoutPlans, selectedWorkout]
  );

  const catalogIndex = useCatalogStore((s) => s.catalog?.index ?? null);
  const planExercises = useMemo(() => currentWorkout?.value?.exercises ?? [], [currentWorkout]);
  const exerciseNames = useExerciseNames(planExercises);
  const convertedExercises = useMemo(() => {
    return planExercises.map((exercise, index) => ({
      label: exerciseNames[index].title,
      value: exercise,
      isCustom: false,
    }));
  }, [planExercises, exerciseNames]);
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
        // workout this exercise was done in (TICKET-020's job). Freestyle's
        // entry carries FREESTYLE_ID, so the same match keeps Freestyle only.
        const logs = toWorkoutLogs(
          sessions.filter(
            (session) => session.workoutId === selectedWorkout.value!.id
          ),
          user.uid,
          catalogIndex
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
      ExerciseName: selectedExercises.label,
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
          value={currentWorkout}
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