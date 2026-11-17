import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TextBase } from "../TextBase";
import { SPACING } from "../../constants/styles";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { verdictText, type RailRow } from "../../utils/historyRail";
import { OLDER_WORKOUTS_PAGE_SIZE } from "../../config/display";
import type { OlderWorkouts } from "../../stores/useRecentWorkoutsStore";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * One row of the Workouts rail (TICKET-085a, boards HistHome01 to 25), drawn from `buildRail`'s rows. It owns no
 * rule: which rows exist, their counts and their order are `utils/historyRail.ts`; this only draws them.
 *
 * Type sizes, board px through the System board's table: day number 20 → large, name 17 → large, weekday and
 * month-row meta 12 → small, verdict, capsule and month label 13 → xMedium.
 * `joined`: the next row is a workout too, so the rail's line runs down to it.
 * Memoized: opening the filter sheet or the retry state re-renders the screen, not every row. The screen passes
 * stable callbacks, and `olderRead` only to the Older workouts row. Not measured on a device (TICKET-085a proof).
 */
export const HistoryRailRow = React.memo(function HistoryRailRow({
  row,
  joined,
  olderRead,
  onOpenWorkout,
  onToggleMonth,
  onLoadOlder,
}: {
  row: RailRow;
  joined: boolean;
  /** The last ask for older workouts, for the Older workouts row. */
  olderRead: OlderWorkouts["read"];
  onOpenWorkout: (sessionId: string, workoutName: string, startedAt: number) => void;
  onToggleMonth: (month: string) => void;
  onLoadOlder: () => void;
}) {
  const { styles, t } = useThemeStyles(createStyles);

  switch (row.kind) {
    case "monthLabel":
      return <TextBase style={styles.monthLabel}>{row.label}</TextBase>;

    case "earlier":
      return <TextBase style={styles.earlier}>Earlier</TextBase>;

    case "gap":
      return <TextBase style={styles.gap}>{row.text}</TextBase>;

    case "end":
      return <TextBase style={styles.end}>{row.onlyOne ? "The next one gets compared." : row.text}</TextBase>;

    case "monthRow":
      return (
        <TouchableOpacity
          style={styles.monthRow}
          onPress={() => onToggleMonth(row.month)}
          accessibilityRole="button"
          accessibilityState={{ expanded: row.open }}
          accessibilityLabel={`${row.label}, ${row.count} ${row.cut ? "more " : ""}workout${row.count === 1 ? "" : "s"}`}
        >
          <TextBase style={styles.monthRowName}>{row.label}</TextBase>
          <TextBase style={styles.monthRowCount}>
            {row.count} {row.cut ? "more " : ""}workout{row.count === 1 ? "" : "s"}
          </TextBase>
          <Ionicons name={row.open ? "chevron-up" : "chevron-down"} size={16} color={t.colors.role.textSecondary} />
        </TouchableOpacity>
      );

    case "olderMore": {
      const loading = olderRead?.status === "loading";
      const detail =
        olderRead?.status === "loading"
          ? olderRead.waitOver
            ? "Needs a connection, still trying"
            : "Loading…"
          : olderRead?.status === "offline"
            ? "Needs a connection"
            : olderRead?.status === "failed"
              ? "Could not load · try again"
              : `Show ${OLDER_WORKOUTS_PAGE_SIZE}`;
      return (
        <TouchableOpacity
          style={styles.monthRow}
          // A read inside its wait is joined by the store; disabled here too, so a tap shows no change.
          disabled={loading && !olderRead.waitOver}
          onPress={onLoadOlder}
          accessibilityRole="button"
          accessibilityLabel={`Older workouts, ${detail}`}
        >
          <TextBase style={styles.monthRowName}>Older workouts</TextBase>
          <TextBase style={styles.monthRowCount}>{detail}</TextBase>
        </TouchableOpacity>
      );
    }

    case "workout": {
      const { session, state } = row.workout;
      const date = new Date(session.startedAt);
      const word = state === "uploaded" ? verdictText(row.verdict) : null;
      const amber = row.verdict?.amber === true && state === "uploaded";
      return (
        <TouchableOpacity
          testID={`history-row-${session.sessionId}`}
          style={styles.workout}
          onPress={() => onOpenWorkout(session.sessionId, session.workoutName, session.startedAt)}
          accessibilityRole="button"
        >
          {joined && <View style={styles.line} />}
          <View style={styles.dayColumn}>
            <TextBase numeric style={styles.day}>
              {String(date.getDate()).padStart(2, "0")}
            </TextBase>
            <TextBase style={styles.weekday}>{WEEKDAYS[date.getDay()]}</TextBase>
          </View>
          <View style={styles.dotColumn}>
            <View
              style={[
                styles.dot,
                amber && styles.dotAmber,
                !amber && styles.dotPlain,
                state === "waiting" && styles.dotWaiting,
                state === "failed" && styles.dotFailed,
              ]}
            />
          </View>
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <TextBase style={styles.name} numberOfLines={1}>
                {session.workoutName}
              </TextBase>
              {state === "waiting" ? (
                <TextBase style={styles.verdictMuted}>Not uploaded yet</TextBase>
              ) : state === "failed" ? (
                <TextBase style={styles.verdictFailed}>Didn’t upload</TextBase>
              ) : session.liftsUnreadable ? (
                <TextBase style={styles.verdictMuted}>Details not available</TextBase>
              ) : word ? (
                <TextBase style={[styles.verdict, amber ? styles.verdictAmber : styles.verdictMuted]}>{word}</TextBase>
              ) : null}
            </View>
            <View style={styles.capsules}>
              {session.lifts.map((lift) => (
                <View key={`${lift.id}-${lift.name}`} style={styles.capsule}>
                  {lift.verdict === "better" && state === "uploaded" && (
                    <Ionicons name="caret-up" size={11} color={t.colors.role.signal} />
                  )}
                  {lift.verdict === "lower" && state === "uploaded" && (
                    <Ionicons name="caret-down" size={11} color={t.colors.role.textSecondary} />
                  )}
                  <TextBase style={styles.capsuleText}>{lift.name}</TextBase>
                </View>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      );
    }
  }
});

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    monthLabel: { marginTop: SPACING.small, marginBottom: SPACING.medium, fontSize: t.fonts.xMedium, color: t.colors.role.textSecondary },
    earlier: { marginTop: SPACING.large, marginBottom: SPACING.small, fontSize: t.fonts.xMedium, fontWeight: "bold", color: t.colors.role.textSecondary },
    gap: { paddingVertical: SPACING.medium, fontSize: t.fonts.xMedium, color: t.colors.role.textSecondary },
    end: { paddingVertical: SPACING.large, textAlign: "center", fontSize: t.fonts.xMedium, color: t.colors.role.textSecondary },
    monthRow: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.small,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.role.hairline,
    },
    monthRowName: { fontSize: t.fonts.medium, fontWeight: "bold", color: t.colors.role.textPrimary },
    monthRowCount: { flex: 1, fontSize: t.fonts.small, color: t.colors.role.textSecondary },
    workout: { flexDirection: "row", gap: SPACING.medium, paddingBottom: SPACING.xLarge },
    line: { position: "absolute", left: 50, top: 24, bottom: -2, width: 2, backgroundColor: t.colors.role.hairline },
    dayColumn: { width: 40, alignItems: "flex-end" },
    day: { fontSize: t.fonts.large, lineHeight: 22, fontWeight: "bold", color: t.colors.role.textPrimary },
    weekday: { fontSize: t.fonts.small, color: t.colors.role.textSecondary },
    dotColumn: { width: 12, alignItems: "center", paddingTop: 5 },
    dot: { width: 12, height: 12, borderRadius: 6 },
    dotAmber: { backgroundColor: t.colors.role.signal },
    dotPlain: { borderWidth: 2, borderColor: t.colors.role.hairlineStrong, backgroundColor: t.colors.role.ground },
    dotWaiting: { borderStyle: "dashed", borderColor: t.colors.role.textSecondary },
    dotFailed: { borderStyle: "solid", borderColor: t.colors.role.danger },
    body: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: SPACING.small },
    name: { flexShrink: 1, fontSize: t.fonts.large, fontWeight: "bold", color: t.colors.role.textPrimary },
    verdict: { fontSize: t.fonts.xMedium, fontWeight: "bold" },
    verdictAmber: { color: t.colors.role.signal },
    verdictMuted: { fontSize: t.fonts.xMedium, fontWeight: "bold", color: t.colors.role.textSecondary },
    verdictFailed: { fontSize: t.fonts.xMedium, fontWeight: "bold", color: t.colors.role.danger },
    capsules: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: SPACING.small },
    capsule: {
      height: 28,
      paddingHorizontal: SPACING.medium - 1,
      borderRadius: 14,
      backgroundColor: t.colors.role.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    capsuleText: { fontSize: t.fonts.xMedium, color: t.colors.role.textPrimary },
  });
