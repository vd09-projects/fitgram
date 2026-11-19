import React, { useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View, type LayoutChangeEvent } from "react-native";
import { TextBase } from "../TextBase";
import { SPACING } from "../../constants/styles";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import type { ExerciseLog, Measure } from "../../utils/exerciseLog";
import {
  axisDate,
  graphInput,
  graphLayout,
  graphValueText,
  labelRect,
  LABEL_WIDTH,
  lineSegment,
  peekPosition,
  pointLabelRect,
  type GraphPoint,
  type LabelAnchor,
} from "../../utils/exerciseGraph";
import { EXERCISE_GRAPH_MIN_SESSIONS } from "../../config/display";

// The graph's height, in dp: the boards draw it at 116 beside the log, and taller on its own (HistExercise04).
const HEIGHT = 116;
export const GRAPH_ONLY_HEIGHT = 280;
const LINE = 1.5;
const DOT = 5;
const DOT_LATEST = 10;
// A dot is a small target: it is pressed through a box this wide.
const HIT = 28;
const PEEK = { width: 148, height: 32 };

/**
 * The graph of the Exercise screen (TICKET-084 stage 2, boards HistExercise01, 09, 10), drawn from Views: a thin rotated
 * View per line segment and a pressable View per dot, as decided in TICKET-087 (`react-native-svg` is not added). Every
 * position is `utils/exerciseGraph.ts`'s; this draws them. A tap on a dot opens a peek card with that session's date and
 * value (amber dot), a tap on the card opens its Session, a tap anywhere else closes it.
 * Type sizes, board px through the System board's table: labels and dates 12 → small, the card's date 14 → xMedium.
 * The card is one line pinned to a top corner (`peekPosition`): beside the dot it covered the line and the dot's own label.
 * The break between two units is drawn as a solid hairline where the board dashes it: a dashed border is not reliable on
 * Android.
 */
export function ExerciseGraph({
  log,
  now,
  measure,
  limit,
  height = HEIGHT,
  onOpen,
}: {
  log: ExerciseLog;
  now: number;
  /** What each point is: the average weight, or the total lifted. */
  measure: Measure;
  /** The newest this many sessions are drawn; null: every one loaded. */
  limit: number | null;
  height?: number;
  onOpen: (point: Pick<GraphPoint, "sessionId" | "workoutName" | "startedAt">) => void;
}) {
  const { styles, t } = useThemeStyles(createStyles);
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const input = useMemo(() => graphInput(log, measure), [log, measure]);
  const layout = useMemo(
    () =>
      width === 0
        ? null
        : graphLayout(input, { width, height }, { limit, minSessions: EXERCISE_GRAPH_MIN_SESSIONS, now, measure }),
    [input, width, height, limit, now, measure]
  );
  const onLayout = (event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width));

  if (layout?.kind === "few") {
    return <TextBase style={styles.note}>{`The graph starts after ${layout.need} sessions. ${layout.have} so far.`}</TextBase>;
  }
  if (layout?.kind === "no_value") {
    return <TextBase style={styles.note}>There is no weight in these sessions to graph.</TextBase>;
  }

  const chosen = layout?.kind === "graph" ? layout.points.find((point) => point.key === selected && point.y !== null) : undefined;
  return (
    <View style={styles.wrap} onLayout={onLayout} testID="exercise-graph">
      {layout?.kind === "graph" && (
        <>
          <View style={[styles.plot, { height }]}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSelected(null)} accessibilityLabel="Close the card" />
            {[...layout.breaks, ...layout.points.filter((p) => p.latest).map((p) => p.x)].map((x, i) => (
              <View key={`rule${i}`} pointerEvents="none" style={[styles.rule, { left: x, height: height - 28 }]} />
            ))}
            {layout.lines.map(([a, b]) => {
              const { left, top, length, angle } = lineSegment({ x: a.x, y: a.y as number }, { x: b.x, y: b.y as number }, LINE);
              return (
                <View
                  key={`${a.key}-${b.key}`}
                  pointerEvents="none"
                  style={[styles.line, { left, top, width: length, transform: [{ rotate: `${angle}deg` }] }]}
                />
              );
            })}
            {layout.unitLabels.map((label) => (
              <TextBase key={label.text + label.x} style={[styles.label, styles.unit, labelBox(label.x, label.anchor, 0)]}>
                {label.text}
              </TextBase>
            ))}
            {layout.points.map((point) => {
              if (point.y === null) return null;
              const on = point.key === selected;
              const size = point.latest || on ? DOT_LATEST : DOT;
              return (
                <React.Fragment key={point.key}>
                  <TouchableOpacity
                    style={[styles.hit, { left: point.x - HIT / 2, top: point.y - HIT / 2 }]}
                    onPress={() => setSelected(on ? null : point.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`${axisDate(point.startedAt, now)}, ${graphValueText(point.value as number, measure)} ${point.unit ?? ""}`.trim()}
                    testID={`graph-dot-${point.key}`}
                  >
                    <View
                      style={{
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: on ? t.colors.role.signal : point.latest ? t.colors.role.accent : t.colors.role.textSecondary,
                      }}
                    />
                  </TouchableOpacity>
                  {point.label && (
                    <TextBase numeric style={[styles.label, labelBox(point.x, point.label.anchor, point.y - 24)]}>
                      {point.label.text}
                    </TextBase>
                  )}
                </React.Fragment>
              );
            })}
            {chosen && chosen.y !== null && (
              <TouchableOpacity
                style={[
                  styles.peek,
                  PEEK,
                  peekPosition({ x: chosen.x, y: chosen.y }, PEEK, { width, height }, {
                    lines: layout.lines.map(([a, b]) => [{ x: a.x, y: a.y as number }, { x: b.x, y: b.y as number }] as const),
                    labels: layout.points.flatMap((point) => pointLabelRect(point) ?? []),
                  }),
                ]}
                onPress={() => onOpen(chosen)}
                accessibilityRole="button"
                accessibilityLabel={`${axisDate(chosen.startedAt, now)}, open this workout`}
                testID="graph-peek"
              >
                <TextBase style={styles.peekDate}>{axisDate(chosen.startedAt, now)}</TextBase>
                <TextBase numeric style={styles.peekValue}>
                  {`${graphValueText(chosen.value as number, measure)} ${chosen.unit ?? ""}`.trim()}
                </TextBase>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.axis}>
            <TextBase style={styles.axisText}>{layout.from}</TextBase>
            <TextBase style={styles.axisText}>{`last ${layout.points.length} sessions`}</TextBase>
            <TextBase style={styles.axisText}>{layout.to}</TextBase>
          </View>
        </>
      )}
    </View>
  );
}

/** A label's place and alignment: its box (`labelRect`) with the text aligned to the side it is anchored on. */
const labelBox = (x: number, anchor: LabelAnchor, top: number) => ({
  top,
  left: labelRect(x, anchor, top).left,
  textAlign: anchor === "start" ? ("left" as const) : anchor === "end" ? ("right" as const) : ("center" as const),
});

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    wrap: { marginHorizontal: SPACING.xMedium, marginTop: 6 },
    plot: {},
    rule: { position: "absolute", top: 20, width: 1, backgroundColor: t.colors.role.hairlineStrong },
    line: { position: "absolute", height: LINE, backgroundColor: t.colors.role.textSecondary },
    hit: { position: "absolute", width: HIT, height: HIT, alignItems: "center", justifyContent: "center" },
    // A label sits over its dot's hit box: it must not take the press.
    label: { position: "absolute", pointerEvents: "none", width: LABEL_WIDTH, fontSize: t.fonts.small, color: t.colors.role.textPrimary },
    unit: { color: t.colors.role.textSecondary },
    axis: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
    axisText: { fontSize: t.fonts.small, color: t.colors.role.textSecondary },
    note: { marginHorizontal: SPACING.medium, marginVertical: SPACING.small + 2, fontSize: t.fonts.xMedium, color: t.colors.role.textSecondary },
    peek: {
      position: "absolute",
      paddingHorizontal: SPACING.medium,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.small,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.role.hairlineStrong,
      backgroundColor: t.colors.role.raised,
    },
    peekDate: { fontSize: t.fonts.xMedium, fontWeight: "bold", color: t.colors.role.textPrimary },
    peekValue: { fontSize: t.fonts.small, color: t.colors.role.textSecondary },
  });
