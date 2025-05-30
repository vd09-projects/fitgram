import React, { useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { useWorkoutStore } from "../stores/useWorkoutStore";
import { Ionicons } from "@expo/vector-icons";
import { BORDER_RADIUS, FONT_SIZES, SPACING } from "../constants/styles";
import { LoggedExercise } from "../types/zustandWorkoutType";
import { TextBase } from "./TextBase";
import { getClearIcon, PrimaryInputField } from "./PrimaryInputField";
import ActiveExerciseLogHistory from "./ActiveExerciseLogHistory";
import { ReturnTypeUseThemeTokens } from "./ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";

export default function ExerciseLogger({ exercise }: { exercise: LoggedExercise }) {
  const { styles, t } = useThemeStyles(createStyles);
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
            // placeholderTextColor={t.colors.inputPrimaryBackground}
            value={inputValues[field] || ""}

            onChangeText={(text) => onChangeValueForField(field, text)}
            container={[styles.primaryInputContainer]}
            right={getClearIcon(inputValues[field], (text) => onChangeValueForField(field, text))}
          />
        ))}
      </View>

      <TouchableOpacity style={styles.logButton} onPress={logSet} accessibilityLabel="Log Set">
        <Ionicons name="barbell-outline" size={24} color={t.colors.textSecondary} style={{ marginRight: SPACING.small }} />
        <TextBase style={styles.logButtonText}>Save Set</TextBase>
        <Ionicons name="checkmark-done" size={20} color={t.colors.textSecondary} style={{ marginLeft: SPACING.small }} />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  container: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: "#ddd"
  },
  inputContainer: { marginBottom: SPACING.medium },
  logButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: t.colors.buttonSecondary,
    padding: SPACING.large,
    borderRadius: BORDER_RADIUS,
    ...t.shadows.shadowSmall,
  },
  logButtonText: {
    color: t.colors.buttonText,
    fontWeight: "bold",
    fontSize: FONT_SIZES.large,
  },
  primaryInputContainer: {
    flex: 1,
    borderRadius: BORDER_RADIUS,
    paddingLeft: 0,
    paddingBottom: 2,
    height: 48,
    marginBottom: SPACING.xSmall,
    fontSize: FONT_SIZES.medium,
    // ...t.shadows.shadowSmall,
  },
});