import React from "react";
import { StyleSheet, View } from "react-native";
import AlertBase from "../AlertBase";
import { TextBase } from "../TextBase";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { SPACING } from "../../constants/styles";
import type { FinishSummary } from "../../utils/finishSummary";

const HIT = 44;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The one question before a workout is finished (TICKET-096). A finished workout cannot be edited, so a stray
 * tap on Finish was costly.
 *
 * Says what will be saved. Exercises with no sets are one count, never a list: ten of them would make the dialog
 * taller than the question deserves, and the count is enough to tell a mistaken tap from a missed exercise.
 * Chosen over naming them and over a sentence; boards "Finish confirm" on the Workout Flow canvas.
 *
 * Finish is the accent fill, not danger: nothing is destroyed. Danger is Discard's alone, and the signal colour
 * marks beating last session in the logger.
 *
 * Not shown with no sets at all: the store already refuses that Finish ("Nothing to save"), and a confirmation
 * would lead into an error. The caller skips it; see `ActiveWorkoutScreen`.
 */
export function FinishWorkoutDialog({
  visible,
  summary,
  onKeep,
  onFinish,
}: {
  visible: boolean;
  summary: FinishSummary;
  onKeep: () => void;
  onFinish: () => void;
}) {
  const { styles } = useThemeStyles(createStyles);
  const saved = `${plural(summary.sets, "set", "sets")} · ${plural(summary.exercisesWithSets, "exercise", "exercises")}`;
  const hasLeftOut = summary.exercisesWithoutSets > 0;
  const cantEdit = "A finished workout can't be edited.";

  return (
    <AlertBase
      visible={visible}
      title="Finish this workout?"
      message={
        hasLeftOut
          ? cantEdit
          : `${plural(summary.sets, "set", "sets")} in ${plural(summary.exercisesWithSets, "exercise", "exercises")} will be saved.\n${cantEdit}`
      }
      onRequestClose={onKeep}
      containerStyle={styles.card}
      titleStyle={styles.title}
      messageStyle={styles.message}
      buttons={[
        { text: "Keep logging", onPress: onKeep, style: styles.keep, textStyle: styles.keepText },
        { text: "Finish", onPress: onFinish, style: styles.finish, textStyle: styles.finishText },
      ]}
    >
      {hasLeftOut && (
        <View style={styles.summary}>
          <View style={styles.row}>
            <TextBase style={styles.label}>Will be saved</TextBase>
            <TextBase style={styles.value}>{saved}</TextBase>
          </View>
          <View style={[styles.row, styles.rowDivider]}>
            <TextBase style={styles.label}>No sets, left out</TextBase>
            <TextBase style={[styles.value, styles.valueMuted]}>
              {plural(summary.exercisesWithoutSets, "exercise", "exercises")}
            </TextBase>
          </View>
        </View>
      )}
    </AlertBase>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.colors.role.surface,
      borderWidth: 1,
      borderColor: t.colors.role.hairline,
    },
    title: {
      color: t.colors.role.textPrimary,
    },
    message: {
      color: t.colors.role.textSecondary,
    },
    summary: {
      backgroundColor: t.colors.role.raised,
      borderWidth: 1,
      borderColor: t.colors.role.hairline,
      borderRadius: 12,
      marginBottom: 12,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      // The gap and both shrinks: at a 393 dp phone with the system font at 1.3 the label and the value touched
      // ("Will be saved1 set · 1 exercise"); now the longer of the two wraps instead.
      gap: SPACING.medium,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: t.colors.role.hairline,
    },
    label: {
      flexShrink: 1,
      fontSize: t.fonts.xMedium,
      color: t.colors.role.textSecondary,
    },
    value: {
      flexShrink: 1,
      textAlign: "right",
      fontSize: t.fonts.xMedium,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
    },
    valueMuted: {
      color: t.colors.role.textSecondary,
    },
    // Filled, not outlined: same reason as the Discard dialog (a 1dp outline at a fractional position renders uneven on Android).
    keep: {
      minHeight: HIT,
      backgroundColor: t.colors.role.raised,
    },
    keepText: {
      color: t.colors.role.textPrimary,
    },
    finish: {
      minHeight: HIT,
      backgroundColor: t.colors.role.accent,
    },
    finishText: {
      color: t.colors.role.ground,
    },
  });
