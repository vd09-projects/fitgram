// src/components/active_workout/UnitsSheet.tsx
//
// The Units sheet (TICKET-091, boards UnitSheet, UnitCarrySheet,
// UnitSheetLogged): one block per field that has a unit, each a single row of
// chips. A tap changes the exercise's unit at once, the card behind follows,
// and Done only closes: there is nothing to apply or undo, and the next tap
// changes it back. Reps has no unit and no block; a custom exercise with more
// unit fields gets more blocks and the card never grows.
//
// Type sizes, from the boards' px (System board table): title 18 → large;
// field name, last time, hint, notes 12-13 → small; chip and Done 15 → medium.
//
// A `Modal`, as `MenuSheet`: it opens over the screen, the footer included.

import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPACING } from "../../constants/styles";
import type { ExerciseHistory } from "../../types/exerciseHistory";
import type { LoggedExercise } from "../../types/zustandWorkoutType";
import { relabelLine, unitBlocks } from "../../utils/unitChange";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { useExerciseName } from "../../hooks/useExerciseNames";
import { NumericText, TextBase } from "../TextBase";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import type { FieldUnit } from "../../constants/units";
import { useWorkoutStore } from "../../stores/useWorkoutStore";
import show from "../../utils/toastUtils";

type Props = {
  visible: boolean;
  onClose: () => void;
  exercise: LoggedExercise;
  /** Last time's fields, for the "Last time: plates" marker; absent with no session. */
  history: ExerciseHistory;
};

export default function UnitsSheet({ visible, onClose, exercise, history }: Props) {
  const { styles, t } = useThemeStyles(createStyles);
  const insets = useSafeAreaInsets();
  const name = useExerciseName(exercise);
  const setExerciseUnits = useWorkoutStore((state) => state.setExerciseUnits);

  const lastFields = history.lastSession?.fields;
  const blocks = unitBlocks(exercise.fields, lastFields);
  const relabel = relabelLine(exercise.fields, lastFields, exercise.sets);

  // A refusal gives its reason; a failed write to the phone says so, as the other
  // workout actions do. Nothing changes on screen until the store has written.
  const choose = async (field: string, unit: FieldUnit) => {
    try {
      const result = await setExerciseUnits(exercise.id, { [field]: unit });
      if (result.status === "refused") show.alert("Couldn't change the unit", result.reason);
    } catch {
      show.alert("Couldn't change the unit", "It could not be stored on this phone. Please try again.");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} importantForAccessibility="no" />
        <View
          style={[styles.sheet, { paddingBottom: SPACING.xxLarge + insets.bottom }]}
          accessibilityViewIsModal
          testID="units-sheet"
        >
          <View style={styles.handle} />
          <View style={styles.titleBlock}>
            <TextBase style={styles.title} accessibilityRole="header">
              Units
            </TextBase>
            <TextBase style={styles.subtitle} numberOfLines={1}>
              {name.title}
              {name.subtitle ? ` · ${name.subtitle}` : ""}
            </TextBase>
          </View>

          <ScrollView bounces={false} contentContainerStyle={styles.blocks}>
            {blocks.map((block, index) => (
              <View
                key={block.name}
                style={[styles.block, index > 0 && styles.blockDivider]}
                accessibilityRole="radiogroup"
                accessibilityLabel={`${block.name} unit`}
              >
                <View style={styles.blockHeader}>
                  <TextBase style={styles.blockName}>{block.name.toUpperCase()}</TextBase>
                  {block.lastUnit !== null && (
                    <TextBase style={styles.muted}>Last time: {block.lastUnit}</TextBase>
                  )}
                </View>
                <View style={styles.chips}>
                  {block.options.map((unit) => {
                    const selected = unit === block.unit;
                    return (
                      <TouchableOpacity
                        key={unit}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() => choose(block.name, unit)}
                        accessibilityRole="radio"
                        accessibilityLabel={unit}
                        accessibilityState={{ checked: selected }}
                      >
                        <TextBase style={[styles.chipText, !selected && styles.chipTextIdle]}>{unit}</TextBase>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {block.hint !== null && <TextBase style={styles.hint}>{block.hint}</TextBase>}
              </View>
            ))}
          </ScrollView>

          {relabel !== null && (
            <View style={styles.relabel} testID="units-relabel">
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={t.colors.role.textSecondary}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
              <TextBase style={styles.relabelText}>
                A new unit also relabels today's <NumericText style={styles.relabelText}>{relabel.count}</NumericText>{" "}
                {relabel.count === 1 ? "set" : "sets"}. The numbers stay as typed:{" "}
                <NumericText style={styles.relabelText}>{relabel.before}</NumericText> becomes{" "}
                <NumericText style={styles.relabelText}>{relabel.after}</NumericText>.
              </TextBase>
            </View>
          )}

          <TextBase style={styles.footnote}>For this workout only. Earlier workouts keep their own unit.</TextBase>
          <TouchableOpacity style={styles.done} onPress={onClose} accessibilityRole="button" accessibilityLabel="Done">
            <TextBase style={styles.doneText}>Done</TextBase>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    gap: 14,
    maxHeight: "92%",
    backgroundColor: t.colors.role.surface,
    borderTopWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    paddingHorizontal: SPACING.large,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.colors.role.hairlineStrong,
  },
  titleBlock: { gap: 4 },
  title: { fontSize: t.fonts.large, fontWeight: "bold", color: t.colors.role.textPrimary },
  subtitle: { fontSize: t.fonts.small, color: t.colors.role.textSecondary },
  blocks: { gap: 14 },
  block: { gap: 8 },
  blockDivider: {
    borderTopWidth: 1,
    borderTopColor: t.colors.role.hairline,
    paddingTop: 14,
  },
  blockHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  blockName: {
    fontSize: t.fonts.small,
    fontWeight: "bold",
    letterSpacing: 1.4,
    color: t.colors.role.textPrimary,
  },
  muted: { fontSize: t.fonts.small, color: t.colors.role.textSecondary },
  chips: { flexDirection: "row", gap: 6 },
  chip: {
    flex: 1,
    minWidth: 0,
    maxWidth: "33%",
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: t.colors.role.hairline,
  },
  chipSelected: {
    borderWidth: 1.5,
    borderColor: t.colors.role.accent,
    backgroundColor: t.colors.role.raised,
  },
  chipText: { fontSize: t.fonts.medium, fontWeight: "bold", color: t.colors.role.textPrimary },
  chipTextIdle: { color: t.colors.role.textSecondary },
  hint: { fontSize: t.fonts.small, color: t.colors.role.textSecondary },
  relabel: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: t.colors.role.raised,
    borderWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
  },
  relabelText: { flex: 1, fontSize: t.fonts.small, color: t.colors.role.textPrimary },
  footnote: {
    fontSize: t.fonts.small,
    color: t.colors.role.textSecondary,
    borderTopWidth: 1,
    borderTopColor: t.colors.role.hairline,
    paddingTop: 12,
  },
  done: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
  },
  doneText: { fontSize: t.fonts.medium, fontWeight: "bold", color: t.colors.role.textPrimary },
});
