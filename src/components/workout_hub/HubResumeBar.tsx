import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TextBase } from "../TextBase";
import { SPACING } from "../../constants/styles";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { useNow } from "../../hooks/useNow";
import { formatElapsed } from "../../utils/workoutProgress";

/**
 * The running workout, on top of the hub (TICKET-066): name, elapsed, sets
 * logged, and Resume. The whole bar is the button.
 *
 * Its own one-second clock (`useNow`), not the screen's, so the timer ticking
 * re-renders this bar alone. Elapsed is derived from `startTime` on every
 * tick (`formatElapsed`), so it is right after the hub was left and returned to.
 *
 * No Discard, as on the board (unlike Start's `ResumeBanner`): discarding is
 * done from the logger.
 *
 * Type sizes: name 15 → medium, meta 12 → small, Resume 14 → xMedium.
 */
export function HubResumeBar({
  workoutName,
  startTime,
  setsLogged,
  onResume,
}: {
  workoutName: string;
  startTime: number;
  setsLogged: number;
  onResume: () => void;
}) {
  const { styles, t } = useThemeStyles(createStyles);
  const elapsed = formatElapsed(startTime, useNow(1000));

  return (
    <TouchableOpacity
      style={styles.bar}
      onPress={onResume}
      accessibilityRole="button"
      accessibilityLabel={`Resume ${workoutName}`}
      testID="hub-resume-bar"
    >
      <View style={styles.dot} />
      <View style={styles.text}>
        <TextBase style={styles.title} numberOfLines={1}>
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
      <View style={styles.button}>
        <Ionicons name="play" size={15} color={t.colors.role.ground} />
        <TextBase style={styles.buttonText}>Resume</TextBase>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    bar: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.small,
      paddingLeft: SPACING.medium,
      paddingRight: SPACING.small,
      paddingVertical: SPACING.small,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.role.accent,
      backgroundColor: t.colors.role.surface,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.colors.role.accent,
    },
    text: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: t.fonts.medium,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
    },
    meta: {
      fontSize: t.fonts.small,
      color: t.colors.role.textSecondary,
    },
    button: {
      height: 40,
      paddingHorizontal: SPACING.large,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: t.colors.role.accent,
    },
    buttonText: {
      fontSize: t.fonts.xMedium,
      fontWeight: "bold",
      color: t.colors.role.ground,
    },
  });
