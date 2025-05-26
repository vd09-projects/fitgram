import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useWorkoutStore } from "../../stores/useWorkoutStore";
import ExerciseLogger from "../../components/ExerciseLogger";
import SearchableInputDropdown, { DropdownSelection, DropdownItem } from "../../components/SearchableInputDropdown";
import ScrollableScreen from "../../components/ScrollableScreen";
import { BORDER_RADIUS, COLORS, FONT_SIZES, SHADOW_4, SPACING } from "../../constants/styles";
import { LoggedExercise } from "../../types/zustandWorkoutType";
import { useAuthUser } from "../../hooks/useAuthUser";
import show from "../../utils/toastUtils";
import { WorkoutScreenNavigationProp } from "../../navigation/WorkoutNavigator";
import { LayoutRoutes, WorkoutRoutes } from "../../constants/routes";
import { useNavigation } from "@react-navigation/native";
import { TextBase } from "../../components/TextBase";

type workoutScreenNavigationProp = WorkoutScreenNavigationProp<typeof WorkoutRoutes.LogWorkout>;
type layoutScreenNavigationProp = WorkoutScreenNavigationProp<typeof LayoutRoutes.LogWorkout>;

export default function ActiveWorkoutScreen() {
  const navigation = useNavigation<workoutScreenNavigationProp>();
  const layoutNavigation = useNavigation<layoutScreenNavigationProp>();

  const { user } = useAuthUser();
  const { activeWorkout, endWorkout, cancelWorkout } = useWorkoutStore();

  // State to track selected exercise
  const [selectedExercise, setSelectedExercise] = useState<LoggedExercise | null>(activeWorkout?.exercises?.[activeWorkout?.currentExerciseIndex ?? 0] ?? null);

  // ✅ Fix: Always call hooks first, before conditional rendering
  useEffect(() => {
    if (activeWorkout && activeWorkout.exercises.length > 0) {
      setSelectedExercise(activeWorkout?.exercises?.[activeWorkout?.currentExerciseIndex ?? 0] ?? null);
    }
  }, [activeWorkout]);

  // ✅ Fix: Make sure dropdown data is always defined
  const exerciseOptions: DropdownItem<LoggedExercise>[] = activeWorkout
    ? activeWorkout.exercises.map((exercise) => ({
      label: exercise.name,
      value: exercise, // Store full exercise object
    }))
    : [];

  // Handle exercise selection
  const handleSelectExercise = (selected: DropdownSelection<LoggedExercise>) => {
    setSelectedExercise(selected.value || null);
  };

  const handleSaveWorkout = async () => {
    if (activeWorkout) {
      await endWorkout(user?.uid);
    } else {
      show.alert("No active workout to save.");
    }
  };

  if (!activeWorkout) {
    return (
      <View style={styles.noWorkoutContainer}>
        <TextBase style={styles.noWorkoutText}>No active workout</TextBase>
        <TouchableOpacity
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          onPress={() => navigation.navigate(WorkoutRoutes.StartWorkout)}>
          <TextBase style={styles.switchText}>click to select a new one</TextBase>
        </TouchableOpacity>
      </View>
    );
  }

  // ❌ Don't return early before hooks. Instead, render conditionally inside JSX.
  return (
    <ScrollableScreen
      style={styles.container}
      title={<TextBase style={styles.title}>{activeWorkout.name}</TextBase>}
    >

      {/* Dropdown for selecting exercise */}
      <SearchableInputDropdown<LoggedExercise>
        allowCustomInput={false}
        data={exerciseOptions}
        placeholder="Exercise"
        value={
          selectedExercise
            ? { label: selectedExercise.name, value: selectedExercise, isCustom: false }
            : undefined
        }
        onChange={handleSelectExercise}
        title="Exercises"
      />

      {/* Show the selected exercise details */}
      {selectedExercise && <ExerciseLogger exercise={selectedExercise} />}

      {/* Buttons for ending/canceling workout */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={[styles.endButton, { backgroundColor: COLORS.cancelButton }]} onPress={cancelWorkout}>
          <TextBase style={styles.buttonText}>Cancel Workout</TextBase>
        </TouchableOpacity>
        <TouchableOpacity style={styles.endButton} onPress={handleSaveWorkout}>
          <TextBase style={styles.buttonText}>Save Workout</TextBase>
        </TouchableOpacity>
      </View>
    </ScrollableScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: FONT_SIZES.xLarge,
    fontWeight: "bold",
    color: COLORS.textPrimary
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACING.large,
  },
  endButton: {
    backgroundColor: COLORS.button,
    padding: 10,
    paddingVertical: 18,
    alignItems: "center",
    borderRadius: BORDER_RADIUS,
    flex: 1,
    marginHorizontal: 5,
    ...SHADOW_4,
  },
  buttonText: {
    color: COLORS.buttonText,
    fontWeight: "bold",
    fontSize: 16,
  },
  noWorkoutContainer: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 90,
    backgroundColor: COLORS.primary,
  },
  noWorkoutText: {
    fontSize: FONT_SIZES.large,
    color: COLORS.textPrimary,
    textAlign: "center",
    fontWeight: "bold",
    opacity: 0.9,
  },
  switchText: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.textPrimary,
    textAlign: 'center',
    fontWeight: "bold",
    textDecorationLine: 'underline',
    fontStyle: 'italic',
    paddingVertical: SPACING.small,
    opacity: 0.8,
  },
});