import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING } from "../../constants/styles";
import { TextBase, NumericText } from "../TextBase";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { formatElapsed } from "../../utils/workoutProgress";
import { MaybeTourStep } from "../guide_tour/MaybeTourStep";
import { ACTIVE_WORKOUT_STEP_NAMES } from "../../tour_steps/activeWorkout";

const HIT = 44;

/**
 * Re-reads the clock once a second and formats from `startTime`. The interval
 * only triggers a re-render; it holds no count, so unmounting (navigating away)
 * loses nothing and the value is right the moment the screen comes back.
 */
function ElapsedTime({ startTime }: { startTime: number }) {
  const { styles } = useThemeStyles(createStyles);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = formatElapsed(startTime, now);
  if (elapsed === null) return null;

  return (
    <View style={styles.elapsedRow} accessibilityLabel={`${elapsed} elapsed`}>
      <View style={styles.liveDot} />
      <NumericText style={styles.elapsedValue}>{elapsed}</NumericText>
      <TextBase style={styles.elapsedLabel}>elapsed</TextBase>
    </View>
  );
}

type Props = {
  workoutName: string;
  startTime: number;
  onBack: () => void;
  onOpenMenu: () => void;
};

export default function WorkoutHeader({ workoutName, startTime, onBack, onOpenMenu }: Props) {
  const { styles, t } = useThemeStyles(createStyles);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={22} color={t.colors.role.textSecondary} />
      </TouchableOpacity>

      <View style={styles.titleBlock}>
        <TextBase style={styles.workoutName} numberOfLines={1}>{workoutName}</TextBase>
        <ElapsedTime startTime={startTime} />
      </View>

      <MaybeTourStep stepId={ACTIVE_WORKOUT_STEP_NAMES.CANCEL_CURRENT_WORKOUT_LOGER}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onOpenMenu}
          accessibilityRole="button"
          accessibilityLabel="Workout options"
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={t.colors.role.textSecondary} />
        </TouchableOpacity>
      </MaybeTourStep>
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: SPACING.large,
    paddingHorizontal: SPACING.medium,
    gap: SPACING.xSmall,
  },
  iconButton: {
    width: HIT,
    height: HIT,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  titleBlock: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },
  workoutName: {
    fontSize: t.fonts.xMedium,
    fontWeight: "bold",
    color: t.colors.role.textPrimary,
  },
  elapsedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: t.colors.role.accent,
  },
  elapsedValue: {
    fontSize: t.fonts.small,
    color: t.colors.role.textSecondary,
  },
  elapsedLabel: {
    fontSize: t.fonts.small,
    color: t.colors.role.textSecondary,
  },
});
