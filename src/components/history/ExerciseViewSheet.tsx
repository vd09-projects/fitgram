import React from "react";
import { Modal, Pressable, StyleSheet, Switch, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPACING } from "../../constants/styles";
import { EXERCISE_VIEW_SESSION_CHOICES } from "../../config/display";
import { TextBase } from "../TextBase";
import { EffortMark } from "./EffortMark";
import { SetArrow } from "./SetArrow";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { measureLabel, type Measure } from "../../utils/exerciseLog";
import { sessionsLabel, type ExerciseShow, type ExerciseView } from "../../utils/exerciseView";

const MEASURES: Measure[] = ["average", "total"];
const SHOWS: { value: ExerciseShow; label: string }[] = [
  { value: "both", label: "Graph and list" },
  { value: "graph", label: "Graph" },
  { value: "list", label: "List" },
];
const SESSIONS: (number | null)[] = [...EXERCISE_VIEW_SESSION_CHOICES, null];

/**
 * The Exercise screen's view options (TICKET-084 stage 4, board HistExercise03): the measure, what to show, how many
 * sessions, and the two Details switches. A change applies at once (the screen is visible behind the scrim) and there is
 * no Apply: the view is only memory for the visit. A sheet over the screen as a `Modal`, as `MenuSheet`.
 * Type sizes, board px through the System board's table: title 16 → medium, choices and rows 14 → xMedium, section labels
 * and legends 12 → small.
 */
export function ExerciseViewSheet({
  visible,
  view,
  onChange,
  onClose,
}: {
  visible: boolean;
  view: ExerciseView;
  onChange: (view: ExerciseView) => void;
  onClose: () => void;
}) {
  const { styles, t } = useThemeStyles(createStyles);
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} importantForAccessibility="no" />
        <View style={[styles.sheet, { paddingBottom: SPACING.xLarge + insets.bottom }]} accessibilityViewIsModal testID="exercise-view-sheet">
          <View style={styles.handle} />
          <TextBase style={styles.title} accessibilityRole="header">
            View options
          </TextBase>

          <Section label="Measure">
            <Choices
              choices={MEASURES.map((value) => ({ key: value, label: measureLabel(value), on: view.measure === value }))}
              onPick={(key) => onChange({ ...view, measure: key as Measure })}
            />
          </Section>
          <Section label="Show">
            <Choices
              choices={SHOWS.map(({ value, label }) => ({ key: value, label, on: view.show === value }))}
              onPick={(key) => onChange({ ...view, show: key as ExerciseShow })}
            />
          </Section>
          <Section label="Sessions shown">
            <Choices
              choices={SESSIONS.map((value) => ({ key: String(value), label: sessionsLabel(value), on: view.sessions === value }))}
              onPick={(key) => onChange({ ...view, sessions: key === "null" ? null : Number(key) })}
            />
          </Section>

          <TextBase style={styles.sectionLabel}>Details</TextBase>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <TextBase style={styles.rowTitle}>Effort badges</TextBase>
              <View style={styles.legend}>
                <EffortMark effort="hard" />
                <TextBase style={styles.legendText}>hard</TextBase>
                <EffortMark effort="easy" />
                <TextBase style={styles.legendText}>easy</TextBase>
              </View>
            </View>
            <Switch
              value={view.effort}
              onValueChange={(effort) => onChange({ ...view, effort })}
              trackColor={{ true: t.colors.role.accent, false: t.colors.role.hairlineStrong }}
              accessibilityLabel="Effort badges"
            />
          </View>
          <View style={[styles.switchRow, styles.switchDivider]}>
            <View style={styles.switchText}>
              <TextBase style={styles.rowTitle}>Better / lower marks</TextBase>
              <View style={styles.legend}>
                <SetArrow arrow="up" />
                <TextBase style={styles.legendText}>better than last time</TextBase>
                <SetArrow arrow="down" />
                <TextBase style={styles.legendText}>lower</TextBase>
              </View>
            </View>
            <Switch
              value={view.marks}
              onValueChange={(marks) => onChange({ ...view, marks })}
              trackColor={{ true: t.colors.role.accent, false: t.colors.role.hairlineStrong }}
              accessibilityLabel="Better and lower marks"
            />
          </View>

          <TouchableOpacity style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <TextBase style={styles.closeText}>Close</TextBase>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const { styles } = useThemeStyles(createStyles);
  return (
    <View>
      <TextBase style={styles.sectionLabel}>{label}</TextBase>
      {children}
    </View>
  );
}

/** One row of equal choices, the chosen one filled (board HistExercise03). */
function Choices({ choices, onPick }: { choices: { key: string; label: string; on: boolean }[]; onPick: (key: string) => void }) {
  const { styles } = useThemeStyles(createStyles);
  return (
    <View style={styles.choices}>
      {choices.map((choice) => (
        <TouchableOpacity
          key={choice.key}
          style={[styles.choice, choice.on && styles.choiceOn]}
          // 36 dp is the board's height; Android's target is 48, so the touch area grows past the drawn button.
          hitSlop={{ top: 6, bottom: 6 }}
          onPress={() => onPick(choice.key)}
          accessibilityRole="radio"
          accessibilityState={{ selected: choice.on }}
          accessibilityLabel={choice.label}
        >
          <TextBase style={[styles.choiceText, choice.on && styles.choiceTextOn]} numberOfLines={1}>
            {choice.label}
          </TextBase>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
    sheet: {
      gap: SPACING.small,
      backgroundColor: t.colors.role.surface,
      borderTopWidth: 1,
      borderColor: t.colors.role.hairlineStrong,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingTop: 10,
      paddingHorizontal: SPACING.medium,
    },
    handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: t.colors.role.hairlineStrong },
    title: { fontSize: t.fonts.medium, fontWeight: "bold", color: t.colors.role.textPrimary, marginBottom: SPACING.small },
    sectionLabel: { fontSize: t.fonts.small, color: t.colors.role.textSecondary, marginTop: SPACING.small, marginBottom: 6 },
    choices: { flexDirection: "row", gap: SPACING.xSmall },
    choice: { flex: 1, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    choiceOn: { backgroundColor: t.colors.role.raised, borderWidth: 1, borderColor: t.colors.role.accent },
    choiceText: { fontSize: t.fonts.xMedium, color: t.colors.role.textSecondary },
    choiceTextOn: { fontWeight: "bold", color: t.colors.role.accent },
    switchRow: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.small },
    switchDivider: { borderTopWidth: 1, borderTopColor: t.colors.role.hairline },
    switchText: { flex: 1 },
    rowTitle: { fontSize: t.fonts.xMedium, color: t.colors.role.textPrimary },
    legend: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
    legendText: { fontSize: t.fonts.small, color: t.colors.role.textSecondary },
    close: {
      height: 50,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.role.hairlineStrong,
      marginTop: SPACING.small,
    },
    closeText: { fontSize: t.fonts.medium, fontWeight: "600", color: t.colors.role.textPrimary },
  });
