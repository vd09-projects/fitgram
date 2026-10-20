import React, { useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { TextBase } from "../TextBase";
import { SPACING } from "../../constants/styles";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { formatElapsed } from "../../utils/workoutProgress";

const HIT = 44;

/**
 * The in-progress workout, inline (TICKET-022). Replaces the modal that met the
 * user on mount: same information — name, elapsed time, sets logged — and the
 * same two ways out, without blocking the screen.
 *
 * Elapsed is derived from `startTime` on every tick, never accumulated, so it is
 * right after navigating away and back (`formatElapsed`).
 *
 * Discard is a request, not the action: the screen confirms first.
 */
export function ResumeBanner({
  workoutName,
  startTime,
  setsLogged,
  onResume,
  onDiscard,
}: {
  workoutName: string;
  startTime: number;
  setsLogged: number;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const { styles } = useThemeStyles(createStyles);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = formatElapsed(startTime, now);

  return (
    <View style={styles.banner} accessibilityRole="summary" testID="resume-banner">
      <View style={styles.top}>
        <View style={styles.dot} />
        <View style={styles.text}>
          <TextBase style={styles.title} numberOfLines={2}>
            {workoutName} in progress
          </TextBase>
          <TextBase style={styles.meta}>
            {elapsed !== null && (
              <>
                <TextBase numeric style={styles.meta}>{elapsed}</TextBase>
                {" · "}
              </>
            )}
            <TextBase numeric style={styles.meta}>{setsLogged}</TextBase>
            {setsLogged === 1 ? " set logged" : " sets logged"}
          </TextBase>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.discard} onPress={onDiscard} accessibilityRole="button">
          <TextBase style={styles.discardText}>Discard</TextBase>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resume} onPress={onResume} accessibilityRole="button">
          <TextBase style={styles.resumeText}>Resume</TextBase>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    banner: {
      padding: SPACING.medium,
      gap: SPACING.medium,
      borderRadius: 14,
      backgroundColor: t.colors.role.accentDeep,
      borderWidth: 1,
      borderColor: t.colors.role.accent,
    },
    top: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.medium,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.colors.role.accent,
    },
    text: {
      flex: 1,
    },
    title: {
      fontSize: t.fonts.xMedium,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
    },
    meta: {
      marginTop: 2,
      fontSize: t.fonts.small,
      color: t.colors.role.textPrimary,
    },
    actions: {
      flexDirection: "row",
      gap: SPACING.small,
    },
    // Text-only danger, not a fill: the screen's one filled action is the
    // bottom bar, and Discard is the destructive choice — it should not draw the eye.
    discard: {
      flex: 1,
      minHeight: HIT,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.role.surface,
    },
    discardText: {
      fontSize: t.fonts.xMedium,
      fontWeight: "bold",
      color: t.colors.role.danger,
    },
    resume: {
      flex: 1,
      minHeight: HIT,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.role.accent,
    },
    resumeText: {
      fontSize: t.fonts.xMedium,
      fontWeight: "bold",
      color: t.colors.role.ground,
    },
  });
