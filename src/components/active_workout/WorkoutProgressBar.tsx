import React from "react";
import { View, StyleSheet } from "react-native";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { ProgressSegment } from "../../utils/workoutProgress";

/** Beyond this many ticks the segment is full width anyway; stop drawing. */
const MAX_TICKS = 12;

/**
 * One segment per exercise. The three states differ in LIGHTNESS, so they read
 * without colour vision: `done` is the light accent, `untouched` is the dark
 * `raised` step, and `current` sits between on the `hairlineStrong` track with
 * accent showing how far through it the user is.
 *
 * What "done" and the current fill mean is pinned on `ProgressSegment`.
 */
export default function WorkoutProgressBar({ segments }: { segments: ProgressSegment[] }) {
  const { styles } = useThemeStyles(createStyles);

  const current = segments.findIndex((s) => s.state === "current");
  const done = segments.filter((s) => s.state === "done").length;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Exercise ${current + 1} of ${segments.length}, ${done} other ${done === 1 ? "exercise" : "exercises"} logged`}
    >
      {segments.map((segment, index) => {
        if (segment.state === "done") return <View key={index} style={[styles.segment, styles.done]} />;
        if (segment.state === "untouched") return <View key={index} style={[styles.segment, styles.untouched]} />;

        return (
          <View key={index} style={[styles.segment, styles.currentTrack]}>
            {segment.fill !== null ? (
              <View style={[styles.fill, { width: `${segment.fill * 100}%` }]} />
            ) : (
              // No denominator: one tick per logged set, a count rather than a ratio.
              <View style={styles.ticks}>
                {Array.from({ length: Math.min(segment.setsLogged, MAX_TICKS) }, (_, i) => (
                  <View key={i} style={styles.tick} />
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  done: {
    backgroundColor: t.colors.role.accent,
  },
  untouched: {
    backgroundColor: t.colors.role.raised,
  },
  currentTrack: {
    backgroundColor: t.colors.role.hairlineStrong,
  },
  fill: {
    height: "100%",
    backgroundColor: t.colors.role.accent,
  },
  ticks: {
    flexDirection: "row",
    height: "100%",
    gap: 2,
  },
  tick: {
    width: 3,
    height: "100%",
    backgroundColor: t.colors.role.accent,
  },
});
