import React, { useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import useWorkoutPlans from "../hooks/useWorkoutPlans";
import { WorkoutPlan } from "../types/workoutType";
import { COLORS } from "../constants/styles";

export default function StartWorkoutScreen() {
  const workoutPlans = useWorkoutPlans(true);  // Fetch workouts
  const [selectedWorkout, setSelectedWorkout] = useState<string | null>(null);

  const toggleWorkout = (workoutId: string) => {
    setSelectedWorkout(prev => (prev === workoutId ? null : workoutId));
  };

  const handleStartWorkout = (exerciseName: string) => {
    Alert.alert("Workout Started", `You started: ${exerciseName}`);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Select Your Workout</Text>

      {workoutPlans.length === 0 ? (
        <Text style={styles.noWorkouts}>No workouts available</Text>
      ) : (
        workoutPlans.map((workout: WorkoutPlan) => (
          <View key={workout.id} style={styles.workoutContainer}>
            {/* Workout Title (Accordion Toggle) */}
            <TouchableOpacity
              style={styles.workoutHeader}
              onPress={() => toggleWorkout(workout.id)}
            >
              <Text style={styles.workoutTitle}>{workout.name}</Text>
              <Ionicons
                name={selectedWorkout === workout.id ? "chevron-up" : "chevron-down"}
                size={24}
                color={COLORS.textPrimary}
              />
            </TouchableOpacity>

            {/* Exercise List (Visible when expanded) */}
            {selectedWorkout === workout.id && (
              <View style={styles.exerciseList}>
                {workout.exercises.map((exercise) => (
                  <View key={exercise.id} style={styles.exerciseCard}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>

                    {/* Start Workout Button */}
                    <TouchableOpacity
                      style={styles.startButton}
                      onPress={() => handleStartWorkout(exercise.name)}
                    >
                      <Text style={styles.startButtonText}>Start</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 20,
  },
  noWorkouts: {
    textAlign: "center",
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: 20,
  },
  workoutContainer: {
    backgroundColor: COLORS.secondary,
    borderRadius: 10,
    marginBottom: 15,
    padding: 10,
  },
  workoutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.textPrimary,
  },
  exerciseList: {
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  exerciseCard: {
    backgroundColor: COLORS.textPrimary,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.secondary,
  },
  startButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  startButtonText: {
    color: "white",
    fontWeight: "bold",
  },
});