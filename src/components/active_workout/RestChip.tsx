import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TextBase, NumericText } from "../TextBase";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { isRestingExercise, restChipEndsAt, restChipState } from "../../utils/restChip";
import { RestTimer } from "../../utils/restTimer";

type Props = {
  rest: RestTimer | null;
  /** The exercise on screen. The chip stays out on the resting one, where the card is. */
  viewingExerciseId: string | null;
  /** Name of the exercise the rest belongs to, for the label. */
  exerciseName: string;
  /** Go to the exercise the rest belongs to. Does not touch the timer. */
  onPress: () => void;
};

/**
 * The rest running on another exercise, in the header under the elapsed time
 * (TICKET-099, boards "Rest chip 1" and "Rest chip 2"). It fills left to right
 * as the rest runs, reads "Rest over" for a few seconds at the end, then clears;
 * all of that is `restChipState`.
 *
 * The clock lives in the inner component, and it stops once the chip has nothing
 * left to show (the end of the "Rest over" window), though `rest` itself stays in
 * the store until the user acts on it.
 */
export default function RestChip({ rest, viewingExerciseId, exerciseName, onPress }: Props) {
  // The same test as `restChipState`'s, asked here first so the resting
  // exercise, where the card is, mounts no clock at all.
  if (rest === null || isRestingExercise(rest, viewingExerciseId)) return null;
  return <TickingChip rest={rest} viewingExerciseId={viewingExerciseId} exerciseName={exerciseName} onPress={onPress} />;
}

function TickingChip({ rest, viewingExerciseId, exerciseName, onPress }: Props) {
  const { styles, t } = useThemeStyles(createStyles);
  // Ticks every half second, as the card does, until the chip's last moment, then
  // stops: `useNow` has no off switch, and a finished rest can sit in the store
  // for minutes. Add-time moves `endsAt`, which restarts the clock.
  const [now, setNow] = useState(() => Date.now());
  const endsAt = restChipEndsAt(rest);
  useEffect(() => {
    if (Date.now() >= endsAt) {
      setNow(Date.now());
      return;
    }
    const id = setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      if (tick >= endsAt) clearInterval(id);
    }, 500);
    return () => clearInterval(id);
  }, [endsAt]);
  const chip = restChipState(rest, viewingExerciseId, now);
  if (chip === null) return null;

  const done = chip.kind === "done";
  const label = done
    ? `Rest over on ${exerciseName}. Go to ${exerciseName}`
    : `Rest ${chip.remaining} left on ${exerciseName}. Go to ${exerciseName}`;

  return (
    <TouchableOpacity
      style={[styles.chip, done && styles.chipDone]}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {chip.kind === "running" && <View style={[styles.fill, { width: `${chip.elapsedFraction * 100}%` }]} />}
      {done ? (
        <>
          <Ionicons name="checkmark" size={14} color={t.colors.role.ground} />
          <TextBase style={styles.doneText}>Rest over</TextBase>
        </>
      ) : (
        <>
          <Ionicons name="timer-outline" size={14} color={t.colors.role.accent} />
          <TextBase style={styles.restLabel}>REST</TextBase>
          <NumericText style={styles.time}>{chip.remaining}</NumericText>
        </>
      )}
    </TouchableOpacity>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  chip: {
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 9,
    paddingRight: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.colors.role.accent,
    backgroundColor: t.colors.role.surface,
    overflow: "hidden",
  },
  chipDone: {
    backgroundColor: t.colors.role.accent,
  },
  // Board: #2B5560, which has no token; the accent at this opacity is the nearest.
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: t.colors.role.accent,
    opacity: 0.35,
  },
  restLabel: {
    fontSize: t.fonts.xSmall,
    letterSpacing: 1,
    color: t.colors.role.textSecondary,
  },
  // Type sizes map from the board by the System board's table: the time is 13
  // (xMedium), "Rest over" 12.5 (small), the REST label 10.5 (xSmall).
  time: {
    fontSize: t.fonts.xMedium,
    fontWeight: "bold",
    color: t.colors.role.textPrimary,
  },
  doneText: {
    fontSize: t.fonts.small,
    fontWeight: "bold",
    color: t.colors.role.ground,
  },
});
