import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TextBase } from "../TextBase";
import { MaybeTourStep } from "../guide_tour/MaybeTourStep";
import { SPACING } from "../../constants/styles";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { MANAGE_WOURKOUT_STEP_NAMES } from "../../tour_steps/manageWorkout";

/**
 * The hub's title row (TICKET-066): "Workout", then the Plans (Manage Workout)
 * and History (Workout Logs) pills. Plans carries the Manage tour's first step,
 * moved here from the old Add New Workout tile.
 *
 * Type sizes, board px through the System board's table: title 26 → xLarge
 * (screen title), pill 13 → xMedium.
 */
export function HubHeader({
  onPlans,
  onHistory,
  onHistoryNew,
}: {
  onPlans: () => void;
  onHistory: () => void;
  /** TEMPORARY (TICKET-085a): opens the new History home. 085b makes History open it and removes this. */
  onHistoryNew: () => void;
}) {
  const { styles } = useThemeStyles(createStyles);
  return (
    <View style={styles.wrap}>
    <View style={styles.header}>
      <TextBase style={styles.title} accessibilityRole="header">
        Workout
      </TextBase>
      <MaybeTourStep stepId={MANAGE_WOURKOUT_STEP_NAMES.NEW_AND_UPDATE_BUTTON}>
        {/* Plain View: MultiTourSteps splits its child's style (see ActiveWorkoutScreen). */}
        <View>
          <Pill icon="reader-outline" label="Plans" onPress={onPlans} />
        </View>
      </MaybeTourStep>
      <Pill icon="time-outline" label="History" onPress={onHistory} />
    </View>
    {/* TEMPORARY — remove in TICKET-085b, with this prop and the hub's onHistoryNew. Its own row: a third
        pill beside the title squeezed "Workout" to one letter a line (emulator, 2026-11-17). */}
    <View style={styles.tempRow}>
      <Pill icon="albums-outline" label="History (new)" onPress={onHistoryNew} />
    </View>
    </View>
  );
}

function Pill({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { styles, t } = useThemeStyles(createStyles);
  return (
    <TouchableOpacity style={styles.pill} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={15} color={t.colors.role.textPrimary} />
      <TextBase style={styles.pillText}>{label}</TextBase>
    </TouchableOpacity>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    wrap: { gap: SPACING.small },
    tempRow: { flexDirection: "row" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.small,
    },
    title: {
      flex: 1,
      fontSize: t.fonts.xLarge,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
    },
    pill: {
      height: 40,
      paddingHorizontal: SPACING.medium,
      borderRadius: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: t.colors.role.raised,
    },
    pillText: {
      fontSize: t.fonts.xMedium,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
    },
  });
