import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import { useAuthUser } from "../hooks/useAuthUser";
import useWorkoutPlans from "../hooks/useWorkoutPlans";
import SearchableInputDropdown, { DropdownSelection } from "./SearchableInputDropdown";
import { Exercise, WorkoutPlan } from "../types/workoutType";
import show from "../utils/toastUtils";
import { getWorkoutLogs } from "../services/db/userDB";
import { TextBase } from "./TextBase";
import { BORDER_RADIUS, COLORS, FONT_SIZES, SPACING } from "../constants/styles";
import { WorkoutLog } from "../types/workoutLogs";

type WorkoutHistoricalLogsFilterProps = {
  setWorkoutLogs: (logs: WorkoutLog[] | null) => void;
  isVisible?: boolean;
};

export default function WorkoutHistoricalLogsFilter({
  setWorkoutLogs,
  isVisible = true,
}: WorkoutHistoricalLogsFilterProps) {
  const { user } = useAuthUser();
  const workoutPlans = useWorkoutPlans(true);

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

  const [loadingLogs, setLoadingLogs] = useState(false);

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

  const fetchLogs = async () => {
    if (!selectedWorkout?.value || !selectedExercises?.value) {
      show.warn("Please select a workout and an exercise");
      return;
    }
    if (!user) {
      show.alert("User is not Logined in");
      return;
    }

    setLoadingLogs(true);
    try {
      const logs = await getWorkoutLogs(
        user?.uid,
        selectedWorkout.value.id,
        {
          exerciseId: selectedExercises.value.id,
          page: 1,
          limit: 10,
        }
      );
      console.log("Fetched logs:", logs.length, logs);
      setWorkoutLogs(logs);
    } catch (error) {
      setWorkoutLogs(null);
      console.error("Error fetching logs:", error);
      show.alert("Error fetching logs", "Please try again.");
    } finally {
      setLoadingLogs(false);
    }
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
        />

        {/* Multi-select Exercise Dropdown (to be implemented later) */}
        <SearchableInputDropdown<Exercise>
          placeholder="Select Exercises"
          data={convertedExercises ?? []}
          value={selectedExercises}
          onChange={setSelectedExercises}
          title="Exercises"
          allowCustomInput={false}
        />
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

const styles = StyleSheet.create({
  filtersContainer: {
    marginBottom: SPACING.medium,
  },
  toggleButton: {
    backgroundColor: COLORS.button,
    padding: SPACING.medium,
    borderRadius: BORDER_RADIUS,
    alignItems: "center",
    marginVertical: SPACING.medium,
    flexGrow: 1,
  },
  toggleText: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.textSecondary,
  },
});