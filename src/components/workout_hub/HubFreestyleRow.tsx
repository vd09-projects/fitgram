import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TextBase } from "../TextBase";
import { SPACING } from "../../constants/styles";
import { FREESTYLE_NAME } from "../../constants/freestyle";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { useNow } from "../../hooks/useNow";
import { formatElapsed } from "../../utils/workoutProgress";

/**
 * Freestyle on the hub (TICKET-067): the dashed row under the tiles. It never
 * opens a card and is never greyed out; the screen decides what a tap does
 * (start, resume, or the blocked card).
 *
 * While the running workout is a Freestyle it reads as the live tile does:
 * accent edge, live dot, its own one-second clock (`useNow`), and the number
 * of exercises added so far.
 *
 * Type sizes: name 15 → medium, line 12 → small.
 */
export function HubFreestyleRow({
  running,
  onPress,
}: {
  running: { startTime: number; exerciseCount: number } | null;
  onPress: () => void;
}) {
  const { styles, t } = useThemeStyles(createStyles);
  return (
    <TouchableOpacity
      style={[styles.row, running && styles.rowRunning]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={running ? `Resume ${FREESTYLE_NAME}` : `Start ${FREESTYLE_NAME}`}
      testID="hub-freestyle"
    >
      <View style={[styles.badge, running && styles.badgeRunning]}>
        {running ? <View style={styles.liveDot} /> : <Ionicons name="add" size={18} color={t.colors.role.accent} />}
      </View>
      <View style={styles.text}>
        <TextBase style={styles.name}>{FREESTYLE_NAME}</TextBase>
        {running ? (
          <LiveLine startTime={running.startTime} exerciseCount={running.exerciseCount} />
        ) : (
          <TextBase style={styles.line}>No plan. Pick exercises as you go.</TextBase>
        )}
      </View>
    </TouchableOpacity>
  );
}

/** "12:40 · in progress · 2 exercises", ticking on its own. */
function LiveLine({ startTime, exerciseCount }: { startTime: number; exerciseCount: number }) {
  const { styles } = useThemeStyles(createStyles);
  const elapsed = formatElapsed(startTime, useNow(1000));
  return (
    <TextBase style={[styles.line, styles.lineRunning]}>
      {elapsed !== null && (
        <>
          <TextBase numeric style={[styles.line, styles.lineRunning]}>{elapsed}</TextBase>
          {" · "}
        </>
      )}
      in progress · <TextBase numeric style={[styles.line, styles.lineRunning]}>{exerciseCount}</TextBase>
      {exerciseCount === 1 ? " exercise" : " exercises"}
    </TextBase>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    row: {
      minHeight: 64,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.medium,
      paddingHorizontal: 14,
      paddingVertical: SPACING.small,
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: t.colors.role.fieldEdge,
    },
    rowRunning: {
      borderWidth: 1.5,
      borderStyle: "solid",
      borderColor: t.colors.role.accent,
      backgroundColor: t.colors.role.accentDeep,
    },
    badge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.role.accentDeep,
    },
    badgeRunning: {
      backgroundColor: t.colors.role.ground,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.colors.role.accent,
    },
    text: {
      flex: 1,
      minWidth: 0,
    },
    name: {
      fontSize: t.fonts.medium,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
    },
    line: {
      fontSize: t.fonts.small,
      color: t.colors.role.textSecondary,
    },
    lineRunning: {
      color: t.colors.role.textPrimary,
    },
  });
