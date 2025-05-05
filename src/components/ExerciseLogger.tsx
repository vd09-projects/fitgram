import React, { useState, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { useWorkoutStore } from "../stores/useWorkoutStore";
import { Ionicons } from "@expo/vector-icons";
import Table from "./Table";
import { BORDER_RADIUS, BUTTON_SIZES, COLORS, FONT_SIZES, SHADOW, SPACING } from "../constants/styles";
import { LoggedExercise } from "../types/zustandWorkoutType";
import CollapsibleSection from "./CollapsibleSection";
import { TextBase } from "./TextBase";
import { getClearIcon, PrimaryInputField } from "./PrimaryInputField";

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

  const onChangeValueForField = (field: string, text: string) => {
    setInputValues((prev) => ({ ...prev, [field]: text }))
  }

  return (
    <View style={styles.container}>

      <CollapsibleSection
        collapsibleStyle={styles.exerciseContainer}
        collapsibleIconColor={COLORS.textPrimary}
        title={<TextBase style={styles.toggleButtonText}>Log History</TextBase>}
      >
        <Table key={exercise.id} headers={exercise.fields} data={exercise.sets.map((set) => set.fields)} />
      </CollapsibleSection>

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
        {/* <Ionicons name="barbell-outline" size={24} color={COLORS.textSecondary} style={{ marginLeft: SPACING.small }} /> */}
        <Ionicons name="checkmark-done" size={20} color={COLORS.textSecondary} style={{ marginLeft: SPACING.small }} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 15, borderBottomWidth: 1, borderColor: "#ddd" },
  exerciseName: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  toggleButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.dropdownBright, borderRadius: 5, marginBottom: SPACING.medium, marginLeft: SPACING.xSmall, padding: SPACING.medium, },
  toggleButtonText: {
    color: COLORS.textPrimary,
    fontWeight: "bold",
  },
  exerciseContainer: {
    backgroundColor: COLORS.dropdown,
    borderRadius: BORDER_RADIUS,
    marginBottom: SPACING.medium,
    padding: SPACING.large,
    ...SHADOW,
  },
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