import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useWorkoutStore } from "../hooks/useWorkoutStore";
import useWorkoutPlans from "../hooks/useWorkoutPlans";

export default function TestWorkoutScreen() {
  const {
    activeWorkout,
    startWorkout,
    endWorkout,
    loadWorkoutFromStorage,
    addSetToExercise,
  } = useWorkoutStore();

  const workoutPlans = useWorkoutPlans(true);

  useEffect(() => {
    loadWorkoutFromStorage(); // Load saved workout when the screen opens
  }, [loadWorkoutFromStorage]);

  // 🔹 Function to Add a Test Set to the First Exercise
  const handleAddSet = () => {
    if (!activeWorkout || activeWorkout.exercises.length === 0) {
      console.warn("No active workout or exercises available!");
      return;
    }

    const firstExercise = activeWorkout.exercises[0]; // Get the first exercise

    // Example Set (Adjust fields based on exercise type)
    const newSet = {
      id: firstExercise.sets.length > 0
        ? firstExercise.sets[firstExercise.sets.length - 1].id + 1
        : 1,
      fields: {
        reps: Math.floor(Math.random() * 15) + 1, // Random reps (1-15)
        weight: Math.floor(Math.random() * 50) + 10, // Random weight (10-50)
      },
    };

    addSetToExercise(firstExercise.id, newSet);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Test Workout Storage</Text>

      {activeWorkout ? (
        <>
          <Text style={styles.activeWorkout}>Active Workout: {activeWorkout.name}</Text>

          {/* 🔹 Show Exercises and Sets */}
          {activeWorkout.exercises.length > 0 ? (
            activeWorkout.exercises.map((exercise) => (
              <View key={exercise.id} style={styles.exerciseContainer}>
                <Text style={styles.exerciseTitle}>{exercise.name}</Text>

                {exercise.sets.length > 0 ? (
                  exercise.sets.map((set) => (
                    <Text key={set.id} style={styles.setText}>
                      Set {set.id}: Reps: {set.fields.reps}, Weight: {set.fields.weight} kg
                    </Text>
                  ))
                ) : (
                  <Text style={styles.noSetsText}>No sets recorded yet.</Text>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>No exercises found in this workout.</Text>
          )}

          {/* 🔹 Add Set Button */}
          <TouchableOpacity onPress={handleAddSet} style={[styles.button, styles.addButton]}>
            <Text style={styles.buttonText}>Add Set to First Exercise</Text>
          </TouchableOpacity>

          {/* 🔹 End Workout Button */}
          <TouchableOpacity onPress={endWorkout} style={[styles.button, styles.endButton]}>
            <Text style={styles.buttonText}>End Workout</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text>No Active Workout</Text>
          <TouchableOpacity
            onPress={() => {
              if (workoutPlans.length > 0) {
                startWorkout(workoutPlans[0]);
              } else {
                console.warn("No available workout plans!");
              }
            }}
            style={[styles.button, styles.startButton]}
          >
            <Text style={styles.buttonText}>Start Workout</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// 🔹 Styles for UI
const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 20,
    marginBottom: 10,
    fontWeight: "bold",
  },
  activeWorkout: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#007BFF",
  },
  exerciseContainer: {
    marginTop: 10,
    padding: 10,
    borderRadius: 5,
    backgroundColor: "#f5f5f5",
  },
  exerciseTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  setText: {
    fontSize: 14,
    marginBottom: 3,
  },
  noSetsText: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#888",
  },
  noDataText: {
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 10,
    color: "#888",
  },
  button: {
    padding: 10,
    marginTop: 10,
    alignItems: "center",
    borderRadius: 5,
  },
  startButton: {
    backgroundColor: "green",
  },
  endButton: {
    backgroundColor: "red",
  },
  addButton: {
    backgroundColor: "blue",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
});