import React from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import { useWorkoutStore } from "../hooks/useWorkoutStore";
import ExerciseLogger from "../components/ExerciseLogger";

export default function ActiveWorkoutScreen() {
  const { activeWorkout, endWorkout } = useWorkoutStore();

  if (!activeWorkout) {
    return <Text>No active workout. Start a new one.</Text>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{activeWorkout.name}</Text>
      
      <FlatList
        data={activeWorkout.exercises}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ExerciseLogger exercise={item} />}
      />

      <TouchableOpacity style={styles.endButton} onPress={endWorkout}>
        <Text>End Workout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: "bold" },
  endButton: { backgroundColor: "red", padding: 15, marginTop: 20 },
});