import React, { useState } from "react";
import { View, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { useWorkoutStore } from "../stores/useWorkoutStore";
import { Ionicons } from "@expo/vector-icons";
import { BORDER_RADIUS, COLORS, FONT_SIZES, SHADOW, SPACING } from "../constants/styles";
import { LoggedExercise } from "../types/zustandWorkoutType";
import { TextBase } from "./TextBase";
import { getClearIcon, PrimaryInputField } from "./PrimaryInputField";
import ActiveExerciseLogHistory from "./ActiveExerciseLogHistory";

export default function ExerciseLogger({ exercise }: { exercise: LoggedExercise }) {
  const { addSetToExercise } = useWorkoutStore();
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  const logSet = () => {
    if (Object.keys(inputValues).length === 0) return;
    addSetToExercise(exercise.id, {
      id: Date.now(),
      fields: { ...inputValues },
    });
    setInputValues({});
  };

  const onChangeValueForField = (field: string, text: string) => {
    setInputValues((prev) => ({ ...prev, [field]: text }))
  }

  return (
    <View style={styles.container}>

      <ActiveExerciseLogHistory key={exercise.id} exercise={exercise} />

      <View style={styles.inputContainer}>
        {exercise.fields.map((field, index) => (
          <PrimaryInputField
            key={index}
            label={inputValues[field] ? field : ""}

            placeholder={field}
            placeholderTextColor={COLORS.textPrimaryPlaceholder}
            value={inputValues[field] || ""}

            onChangeText={(text) => onChangeValueForField(field, text)}
            container={[styles.primaryInputContainer]}
            right={getClearIcon(inputValues[field], (text) => onChangeValueForField(field, text))}
          />
        ))}
      </View>

      <TouchableOpacity style={styles.logButton} onPress={logSet} accessibilityLabel="Log Set">
        <Ionicons name="barbell-outline" size={24} color={COLORS.textSecondary} style={{ marginRight: SPACING.small }} />
        <TextBase style={styles.logButtonText}>Save Set</TextBase>
        <Ionicons name="checkmark-done" size={20} color={COLORS.textSecondary} style={{ marginLeft: SPACING.small }} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 15, borderBottomWidth: 1, borderColor: "#ddd" },
  inputContainer: { marginBottom: SPACING.medium },
  logButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.buttonSecondary,
    padding: SPACING.large,
    borderRadius: BORDER_RADIUS,
    ...SHADOW,
  },
  logButtonText: {
    color: COLORS.textSecondary,
    fontWeight: "bold",
    fontSize: FONT_SIZES.large,
  },
  primaryInputContainer: {
    flex: 1,
    backgroundColor: COLORS.textSecondary,
    borderRadius: BORDER_RADIUS,
    paddingLeft: 0,
    paddingBottom: 2,
    height: 46,
    marginBottom: SPACING.xSmall,
    fontSize: FONT_SIZES.medium,
    // ...SHADOW,
  },
});