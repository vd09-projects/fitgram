import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { LoggedExercise, useWorkoutStore } from "../hooks/useWorkoutStore";
import ExerciseLogger from "../components/ExerciseLogger";
import SearchableInputDropdown, { DropdownSelection, DropdownItem } from "../components/SearchableInputDropdown";
import ScrollableScreen from "../components/ScrollableScreen";
import { BORDER_RADIUS, COLORS, FONT_SIZES } from "../constants/styles";

export default function ActiveWorkoutScreen() {
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

  if (!activeWorkout) {
    return <Text>No active workout. Start a new one.</Text>;
  }

  // ❌ Don't return early before hooks. Instead, render conditionally inside JSX.
  return (
    <ScrollableScreen
      style={styles.container}
      title={<Text style={styles.title}>{activeWorkout.name}</Text>}
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
        <TouchableOpacity style={[styles.endButton, {backgroundColor:COLORS.cancelButton}]} onPress={cancelWorkout}>
          <Text style={styles.buttonText}>Cancel Workout</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.endButton} onPress={endWorkout}>
          <Text style={styles.buttonText}>Save Workout</Text>
        </TouchableOpacity>
      </View>
    </ScrollableScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingBottom: 0 },
  title: { fontSize: FONT_SIZES.xLarge, fontWeight: "bold", marginBottom: 10, color: COLORS.textPrimary },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  endButton: {
    backgroundColor: COLORS.button,
    padding: 10,
    paddingVertical: 18,
    alignItems: "center",
    borderRadius: BORDER_RADIUS,
    flex: 1,
    marginHorizontal: 5,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
});