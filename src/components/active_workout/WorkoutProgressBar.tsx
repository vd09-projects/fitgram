import React from "react";
import { View, StyleSheet } from "react-native";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { ProgressSegment } from "../../utils/workoutProgress";

/**
 * One segment per exercise. The three states differ in LIGHTNESS, so they read
 * without colour vision: `done` is the light accent, `untouched` is the dark
 * `raised` step, and `current` sits between on the `hairlineStrong` track with
 * accent showing how far through it the user is.
 *
 * What "done" and the current fill mean is pinned on `ProgressSegment`.
 *
 * The current fill is drawn dimmer while its target is assumed
 * (`targetSource: "default"`, no history known yet). History can arrive after
 * sets are logged — on resume the fetch waits for sign-in — and the target then
 * changes, say from 3 to 5, so 2 sets go from 67% to 40%. The fill switching to
 * full strength at that moment shows the target became known, instead of
 * looking like lost progress. Rejected: holding or only-growing the target,
 * which would keep showing a ratio against a number now known to be wrong.
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
            <View
              style={[
                styles.fill,
                segment.targetSource === "default" && styles.fillAssumed,
                { width: `${segment.fill * 100}%` },
              ]}
            />
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
  // Same hue, lower lightness: reads as "estimated" without relying on colour.
  fillAssumed: {
    opacity: 0.55,
  },
});
