import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { TextBase } from "../TextBase";
import { SPACING } from "../../constants/styles";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

/**
 * The debug screens' way in, at the end of the hub (TICKET-066). The hub
 * renders it only when `showDebugScreens` is on; the routes exist only then
 * too (WorkoutNavigator). Each button goes with its TEMPORARY screen.
 */
export function HubDebugRow({
  onHistoryDebug,
  onPendingUploads,
  onPlansStore,
}: {
  onHistoryDebug: () => void;
  onPendingUploads: () => void;
  onPlansStore: () => void;
}) {
  const { styles } = useThemeStyles(createStyles);
  return (
    <View style={styles.row}>
      {/* TEMPORARY — remove with ExerciseHistoryDebugScreen. */}
      <TouchableOpacity style={styles.button} onPress={onHistoryDebug}>
        <TextBase style={styles.text}>History Debug</TextBase>
      </TouchableOpacity>
      {/* TEMPORARY — remove with PendingUploadsDebugScreen. */}
      <TouchableOpacity style={styles.button} onPress={onPendingUploads}>
        <TextBase style={styles.text}>Pending Uploads</TextBase>
      </TouchableOpacity>
      {/* TEMPORARY — remove with PlansStoreDebugScreen (TICKET-070). */}
      <TouchableOpacity style={styles.button} onPress={onPlansStore}>
        <TextBase style={styles.text}>Plans Store</TextBase>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: SPACING.small,
      marginTop: SPACING.large,
    },
    button: {
      flex: 1,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.role.hairlineStrong,
    },
    text: {
      fontSize: t.fonts.small,
      color: t.colors.role.textSecondary,
    },
  });
