import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING } from "../../constants/styles";
import { TextBase } from "../TextBase";
import { useExerciseName } from "../../hooks/useExerciseNames";
import { LoggedExercise } from "../../types/zustandWorkoutType";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

/**
 * The one Undo for a removed exercise (TICKET-069, board RemoveLanded), under
 * the workout header: away from Finish, so a stray tap cannot hit the wrong
 * one. Rejected on the canvas: the bar above Finish.
 *
 * Text (board RM8, option G): ⊖, the name in bold white, "removed" in grey.
 * Rejected: grey "Removed" before a white name, where colour and weight change
 * at once (user); one colour throughout; a gradient, which needs native
 * dependencies for one line.
 *
 * The name is its own line-clamped Text and "removed" a sibling, so a long
 * name is cut and "removed" never is. The name is the header's title, which
 * for a catalog exercise includes its version ("Bench Press · Dumbbell");
 * the boards drew it shorter. Same name as the header, so the bar names the
 * exercise the user just saw. When the bar goes is the screen's call.
 */
export default function RemovedExerciseBar({ slot, onUndo }: { slot: LoggedExercise; onUndo: () => void }) {
  const { styles, t } = useThemeStyles(createStyles);
  const name = useExerciseName(slot);

  return (
    <View style={styles.bar} testID="removed-exercise-bar">
      <View
        style={styles.message}
        accessible
        accessibilityLabel={`${name.title} removed`}
        accessibilityLiveRegion="polite"
      >
        <Ionicons name="remove-circle-outline" size={18} color={t.colors.role.textSecondary} />
        <View style={styles.words}>
          <TextBase style={styles.name} numberOfLines={1}>{name.title}</TextBase>
          <TextBase style={styles.removed}>removed</TextBase>
        </View>
      </View>
      <TouchableOpacity style={styles.undo} onPress={onUndo} accessibilityRole="button" accessibilityLabel="Undo">
        <TextBase style={styles.undoText}>Undo</TextBase>
      </TouchableOpacity>
    </View>
  );
}

// Board px → tokens: text 14 → xMedium.
const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.small,
    minHeight: 48,
    marginHorizontal: SPACING.xMedium,
    marginTop: SPACING.medium,
    paddingLeft: 12,
    paddingRight: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
    backgroundColor: t.colors.role.surface,
  },
  message: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.small,
  },
  words: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    flexShrink: 1,
    fontSize: t.fonts.xMedium,
    fontWeight: "700",
    color: t.colors.role.textPrimary,
  },
  removed: {
    marginLeft: SPACING.xSmall,
    fontSize: t.fonts.xMedium,
    fontWeight: "700",
    color: t.colors.role.textSecondary,
  },
  undo: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  undoText: {
    fontSize: t.fonts.xMedium,
    fontWeight: "700",
    color: t.colors.role.accent,
  },
});
