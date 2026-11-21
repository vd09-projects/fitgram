import React from "react";
import { View, StyleSheet } from "react-native";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { ProgressSegment } from "../../utils/workoutProgress";

// The current segment is bigger than the rest (TICKET-100, board "Progress mark"):
// the bar's row is as tall as it is, and the thin segments sit in the middle.
const SEGMENT_HEIGHT = 4;
const CURRENT_HEIGHT = 14;
const CURRENT_OUTLINE = 2;

/**
 * One segment per exercise. `done` is the light accent, thin and solid;
 * `untouched` is the dark `raised` step, thin; `current` is a bigger capsule
 * outlined in the accent with accent showing how far through it the user is.
 *
 * Why the current one is a capsule, not another shade: it was the `hairlineStrong`
 * track, 1.5:1 from an untouched segment in a thin bar, and with no set logged
 * it read as a slightly lighter grey. Rejected: only taller or only wider (the
 * grey stays 1.8:1 against the screen, so shape alone), a number inside (the
 * fill covers it once sets are logged), a pointer above (more height for the
 * same cue).
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
        if (segment.state === "done") return <View key={index} testID="progress-done" style={[styles.segment, styles.done]} />;
        if (segment.state === "untouched") return <View key={index} style={[styles.segment, styles.untouched]} />;

        return (
          <View key={index} testID="progress-current" style={[styles.segment, styles.currentTrack]}>
            <View
              testID="progress-fill"
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
    alignItems: "center",
    height: CURRENT_HEIGHT,
    gap: 4,
  },
  segment: {
    flex: 1,
    height: SEGMENT_HEIGHT,
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
    height: CURRENT_HEIGHT,
    borderRadius: CURRENT_HEIGHT / 2,
    borderWidth: CURRENT_OUTLINE,
    borderColor: t.colors.role.accent,
    backgroundColor: t.colors.role.ground,
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
