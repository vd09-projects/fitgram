import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { useWorkoutStore } from "../hooks/useWorkoutStore";
import { LoggedExercise } from "../hooks/useWorkoutStore";

export default function ExerciseLogger({ exercise }: { exercise: LoggedExercise }) {
  const { addSetToExercise } = useWorkoutStore();
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");

  return (
    <View>
      <Text>{exercise.name}</Text>
      <TextInput placeholder="Weight" onChangeText={setWeight} keyboardType="numeric" />
      <TextInput placeholder="Reps" onChangeText={setReps} keyboardType="numeric" />
      <TouchableOpacity onPress={() => addSetToExercise(exercise.id, { id: Date.now(), fields: { weight, reps } })}>
        <Text>Log Set</Text>
      </TouchableOpacity>
    </View>
  );
}