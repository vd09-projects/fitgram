import React, { useState, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { useWorkoutStore } from "../stores/useWorkoutStore";
import { Ionicons } from "@expo/vector-icons";
import Table from "./Table";
import { COLORS, SPACING } from "../constants/styles";
import { LoggedExercise } from "../types/zustandWorkoutType";

export default function ExerciseLogger({ exercise }: { exercise: LoggedExercise }) {
  const { addSetToExercise } = useWorkoutStore();
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [isCollapsed, setIsCollapsed] = useState(true);
  const rotation = useRef(new Animated.Value(0)).current;

  const logSet = () => {
    if (Object.keys(inputValues).length === 0) return;
    addSetToExercise(exercise.id, {
      id: Date.now(),
      fields: { ...inputValues },
    });
    setInputValues({});
  };

  const toggleCollapse = () => {
    Animated.timing(rotation, {
      toValue: isCollapsed ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setIsCollapsed((prev) => !prev));
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={toggleCollapse}
        activeOpacity={0.7}
        accessibilityLabel="Toggle Log History"
      >
        <Text style={styles.toggleButtonText}>Log History</Text>
        <Animated.View
          style={{
            transform: [
              {
                rotate: rotation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", "180deg"],
                }),
              },
            ],
          }}
        >
          <Ionicons name="chevron-down" size={20} color="#fff" />
        </Animated.View>
      </TouchableOpacity>

      {!isCollapsed && (
        <Table key={exercise.id} headers={exercise.fields} data={exercise.sets.map((set) => set.fields)} />
      )}

      <View style={styles.inputContainer}>
        {exercise.fields.map((field, index) => (
          <TextInput
            key={index}
            style={styles.input}
            placeholder={field}
            placeholderTextColor="#888"
            value={inputValues[field] || ""}
            onChangeText={(text) => setInputValues((prev) => ({ ...prev, [field]: text }))}
            keyboardType="numeric"
          />
        ))}
      </View>

      <TouchableOpacity style={styles.logButton} onPress={logSet} accessibilityLabel="Log Set">
        <Text style={styles.logButtonText}>Save Set</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 15, borderBottomWidth: 1, borderColor: "#ddd" },
  exerciseName: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  toggleButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.dropdownBright, borderRadius: 5, marginBottom: SPACING.medium, marginLeft: SPACING.xSmall, padding: SPACING.medium,},
  toggleButtonText: { color: "#fff", fontWeight: "bold" },
  inputContainer: { marginBottom: SPACING.medium },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 5, backgroundColor: COLORS.textSecondary, margin: SPACING.xSmall, padding: SPACING.medium },
  logButton: { backgroundColor: COLORS.buttonSecondary, padding: 10, borderRadius: 5, alignItems: "center" },
  logButtonText: { color: "#fff", fontWeight: "bold" },
});