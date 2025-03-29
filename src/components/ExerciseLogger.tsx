import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import { useWorkoutStore } from "../hooks/useWorkoutStore";
import { LoggedExercise, ExerciseSet } from "../hooks/useWorkoutStore";

export default function ExerciseLogger({ exercise }: { exercise: LoggedExercise }) {
  const { addSetToExercise } = useWorkoutStore();

  // State for new set inputs
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  // Handle input change for new set
  const handleTextChange = (field: string, text: string) => {
    setInputValues((prev) => ({
      ...prev,
      [field]: text,
    }));
  };

  // Function to log new set
  const logSet = () => {
    if (Object.keys(inputValues).length === 0) return; // Prevent empty entries

    addSetToExercise(exercise.id, {
      id: Date.now(),
      fields: { ...inputValues },
    });

    // Clear input after logging
    setInputValues({});
  };

  return (
    <View style={styles.container}>
      <Text style={styles.exerciseName}>{exercise.name}</Text>

      {/* Show already logged sets */}
      <FlatList
        data={exercise.sets}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }: { item: ExerciseSet }) => (
          <View style={styles.loggedSet}>
            {Object.entries(item.fields).map(([key, value], index) => (
              <Text key={index} style={styles.loggedSetText}>
                {key}: {value}
              </Text>
            ))}
          </View>
        )}
        scrollEnabled={false}
        ListEmptyComponent={<Text style={styles.noSetsText}>No sets logged yet.</Text>}
      />

      {/* Input fields for new set */}
      <View style={styles.inputContainer}>
        {exercise.fields.map((field, index) => (
          <TextInput
            key={index}
            style={styles.input}
            placeholder={field}
            value={inputValues[field] || ""}
            onChangeText={(text) => handleTextChange(field, text)}
            keyboardType="numeric"
          />
        ))}
      </View>

      {/* Button to log new set */}
      <TouchableOpacity style={styles.logButton} onPress={logSet}>
        <Text style={styles.logButtonText}>Log Set</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 15, borderBottomWidth: 1, borderColor: "#ddd" },
  exerciseName: { fontSize: 18, fontWeight: "bold", marginBottom: 5 },
  loggedSet: { padding: 10, backgroundColor: "#f8f8f8", marginVertical: 5, borderRadius: 5 },
  loggedSetText: { fontSize: 14 },
  noSetsText: { fontStyle: "italic", color: "gray", marginBottom: 10 },
  inputContainer: { marginBottom: 10 },
  input: { 
    padding: 8, 
    borderWidth: 1, 
    borderColor: "#ccc", 
    borderRadius: 5, 
    marginVertical: 5,
  },
  logButton: { backgroundColor: "#28a745", padding: 10, borderRadius: 5, alignItems: "center" },
  logButtonText: { color: "#fff", fontWeight: "bold" },
});