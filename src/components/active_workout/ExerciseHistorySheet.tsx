import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPACING } from "../../constants/styles";
import { ExerciseHistory } from "../../types/exerciseHistory";
import { LoggedExercise } from "../../types/zustandWorkoutType";
import {
  sheetBest,
  SheetBest,
  SheetRow,
  sheetSession,
  sheetStatusMessage,
  sheetTrend,
  SheetTrend,
} from "../../utils/historySheet";
import { formatSessionDate, formatVolume, setCountText } from "../../utils/setDeltas";
import { formatStepValue, resolveGhostTarget } from "../../utils/setLogger";
import { withUnit } from "../../utils/exerciseFields";
import { TextBase, NumericText } from "../TextBase";
import { DeltaBadge, deltaSpeech } from "./DeltaBadge";
import { EffortBadge } from "./EffortBadge";
import { effortSpeech } from "../../utils/effort";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { useExerciseName } from "../../hooks/useExerciseNames";

const HIT = 44;
const TREND_HEIGHT = 46;
/** Below this the table scrolls sideways inside its box, not the sheet. */
const TABLE_MIN_WIDTH = 320;

type Props = {
  visible: boolean;
  onClose: () => void;
  exercise: LoggedExercise;
  history: ExerciseHistory;
  /** The set about to be logged. */
  setNumber: number;
};

/**
 * The exercise's history, opened from the set card's pill (TICKET-020): pick
 * one of the last few sessions and see it set by set beside today's, the best
 * set, and the volume trend.
 *
 * Decisions:
 * - **Modal, not a sheet you can log behind.** The ticket's "logging is not
 *   blocked" means dismissing returns to the same set with nothing lost. This
 *   is a sibling of the card inside `ExerciseLogger`, so opening and closing it
 *   never remounts the card: typed values, set number and the Today list stay.
 *   A `Modal` also renders outside the pager's horizontal fling, so the two
 *   cannot fight over a gesture.
 * - RN `Modal` with `slide`, no bottom-sheet library: no native dependency and
 *   no dev-client rebuild. No drag-to-dismiss as a result; the labelled close
 *   control, the backdrop and Android back dismiss it.
 * - The trend is a row of bars, not the design board's sparkline: a polyline
 *   needs `react-native-svg`, and six bars read better than a 46px line.
 * - The scrim is `rgba(0,0,0,0.5)`, as `AlertBase` and the tour overlay. There
 *   is no role token for it.
 */
export default function ExerciseHistorySheet({ visible, onClose, exercise, history, setNumber }: Props) {
  const { styles, t } = useThemeStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(0);
  const name = useExerciseName(exercise);

  const status = sheetStatusMessage(history);
  const sessions = history.sessions;
  const index = Math.min(selected, sessions.length - 1);
  const session =
    status === null && index >= 0
      ? sheetSession(
          history,
          sessions[index],
          exercise.sets.map((set) => set.segments[0]),
          exercise.fields
        )
      : null;

  const target = resolveGhostTarget(history, setNumber);
  const best = sheetBest(history, target.kind === "available" ? target.set.reps : null);
  const trend = sheetTrend(history);
  const unit = history.numericFields?.weight.unit;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* A convenience only: the close button is the labelled way out. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no"
          testID="history-backdrop"
        />
        <View
          style={[styles.sheet, { paddingBottom: SPACING.xLarge + insets.bottom }]}
          accessibilityViewIsModal
          testID="history-sheet"
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              {/* Wraps to two lines, never cut (TICKET-041 board B1). */}
              <TextBase style={styles.title} accessibilityRole="header" numberOfLines={2}>
                {name.title}
              </TextBase>
              {name.subtitle !== null && <TextBase style={styles.subtitle}>{name.subtitle}</TextBase>}
              <TextBase style={styles.subtitle}>History · pick a session to compare</TextBase>
            </View>
            <TouchableOpacity
              style={styles.close}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close history"
            >
              <Ionicons name="close" size={20} color={t.colors.role.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {status !== null ? (
              <TextBase style={styles.status}>{status}</TextBase>
            ) : (
              <>
                <View style={styles.chips}>
                  {sessions.map((s, i) => {
                    const isSelected = i === index;
                    return (
                      <TouchableOpacity
                        key={s.sessionId}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() => setSelected(i)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={`${formatSessionDate(s.performedAt)}, ${s.workoutName}`}
                      >
                        <NumericText style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {formatSessionDate(s.performedAt)}
                        </NumericText>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {session !== null && (
                  <>
                    <TextBase style={styles.caption} numberOfLines={2}>
                      {session.workoutName}
                      {" · "}
                      <NumericText style={styles.caption}>
                        {setCountText(session.setCount)}
                        {session.volume !== null && ` · ${session.volume}`}
                        {session.effort !== null && ` · ${session.effort}`}
                      </NumericText>
                    </TextBase>
                    {session.notice !== null && <TextBase style={styles.notice}>{session.notice}</TextBase>}
                    <SessionTable
                      rows={session.rows}
                      dateLabel={formatSessionDate(session.performedAt)}
                      styles={styles}
                    />
                  </>
                )}

                <BestCard
                  best={best}
                  show={history.numericComparisonAvailable}
                  unit={unit}
                  iconColor={t.colors.role.signal}
                  styles={styles}
                />
                <TrendBars trend={trend} unit={unit} styles={styles} />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

type Styles = ReturnType<typeof createStyles>;

function SessionTable({ rows, dateLabel, styles }: { rows: SheetRow[]; dateLabel: string; styles: Styles }) {
  return (
    <View style={styles.table}>
      <ScrollView horizontal contentContainerStyle={styles.tableScroll} testID="history-table">
        <View style={styles.tableInner}>
          <View style={[styles.tableRow, styles.tableHead]}>
            <TextBase style={[styles.headText, styles.colSet]}>SET</TextBase>
            <NumericText style={[styles.headText, styles.colPast]}>{dateLabel.toUpperCase()}</NumericText>
            <TextBase style={[styles.headText, styles.colFelt]}>FELT</TextBase>
            <TextBase style={[styles.headText, styles.colToday]}>TODAY</TextBase>
          </View>
          {rows.map((row) => (
            <View
              key={row.setNumber}
              style={[styles.tableRow, styles.divider, row.isNext && styles.nextRow]}
              accessible
              accessibilityLabel={rowSpeech(row, dateLabel)}
            >
              <NumericText style={[styles.setNumber, styles.colSet, row.isNext && styles.nextText]}>
                {row.setNumber}
              </NumericText>
              <NumericText style={[styles.past, styles.colPast]} numberOfLines={1}>
                {row.past ?? "—"}
              </NumericText>
              <View style={[styles.colFelt, styles.feltCell]}>
                {row.pastEffort !== null && <EffortBadge effort={row.pastEffort} />}
              </View>
              <View style={[styles.colToday, styles.todayCell]}>
                {row.today !== null ? (
                  <>
                    <NumericText style={styles.today} numberOfLines={1}>
                      {row.today}
                    </NumericText>
                    <DeltaBadge delta={row.delta} />
                  </>
                ) : row.isNext ? (
                  // Today's next set, not a status of the past session beside it.
                  // Not "Logging": with the sheet open nothing is being logged, and
                  // beside an older date it read as that session's state.
                  <TextBase style={styles.logging}>UP NEXT</TextBase>
                ) : (
                  <NumericText style={styles.absent}>—</NumericText>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** "Set 2: 26 Sep 65 kg by 10; today 65 kg by 10, matched". */
function rowSpeech(row: SheetRow, dateLabel: string): string {
  const past =
    row.past !== null
      ? `${dateLabel} ${row.past.replace("×", "by")}${effortSpeech(row.pastEffort)}`
      : `not done on ${dateLabel}`;
  const today =
    row.today !== null
      ? `today ${row.today.replace("×", "by")}${deltaSpeech(row.delta)}`
      : row.isNext
        ? "up next today"
        : "not logged today";
  return `Set ${row.setNumber}: ${past}; ${today}`;
}

function BestCard({
  best,
  show,
  unit,
  iconColor,
  styles,
}: {
  best: SheetBest;
  show: boolean;
  unit: string | undefined;
  iconColor: string;
  styles: Styles;
}) {
  // A plank has no best set at all; the session notice already says why.
  if (!show) return null;
  if (best === null) return <TextBase style={styles.notice}>No best set recorded yet</TextBase>;
  const weight = withUnit(formatStepValue(best.set.weight), unit);
  const date = formatSessionDate(best.set.performedAt);
  const title =
    best.kind === "atReps" ? (
      <>
        Best <NumericText style={styles.bestTitle}>{best.set.reps}</NumericText>-rep set
      </>
    ) : (
      "Heaviest set"
    );
  const value = best.kind === "atReps" ? `${weight} · ${date}` : `${weight} × ${best.set.reps} · ${date}`;
  return (
    <View
      style={styles.best}
      accessible
      accessibilityLabel={
        best.kind === "atReps"
          ? `Best ${best.set.reps}-rep set: ${weight}, ${date}`
          : `Heaviest set: ${weight} by ${best.set.reps}, ${date}`
      }
      testID="history-best"
    >
      <Ionicons name="star-outline" size={18} color={iconColor} />
      <View style={styles.bestText}>
        <TextBase style={styles.bestTitle}>{title}</TextBase>
        <NumericText style={styles.bestValue}>{value}</NumericText>
      </View>
    </View>
  );
}

function TrendBars({ trend, unit, styles }: { trend: SheetTrend; unit: string | undefined; styles: Styles }) {
  if (trend.kind === "none") {
    return trend.reason === null ? null : <TextBase style={styles.notice}>{trend.reason}</TextBase>;
  }
  const { bars, newest } = trend;
  const speech = bars
    .map(
      (bar) =>
        `${formatSessionDate(bar.performedAt)} ${
          bar.volume === null ? "unavailable" : withUnit(formatVolume(bar.volume), unit)
        }`
    )
    .join(", ");
  return (
    <View style={styles.trend}>
      <TextBase style={styles.trendHead}>
        VOLUME · LAST <NumericText style={styles.trendHead}>{bars.length}</NumericText>{" "}
        {bars.length === 1 ? "SESSION" : "SESSIONS"}
      </TextBase>
      <View
        style={styles.bars}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Volume, oldest to newest: ${speech}`}
        testID="history-trend"
      >
        {bars.map((bar) => (
          <View key={bar.sessionId} style={styles.barSlot}>
            {bar.ratio !== null ? (
              // A 0 volume keeps a 2px stub so it reads as a bar, not a gap.
              <View
                style={[styles.bar, { height: Math.max(2, Math.round(bar.ratio * TREND_HEIGHT)) }]}
                testID="trend-bar"
              />
            ) : (
              <View style={styles.barGap} testID="trend-gap" />
            )}
          </View>
        ))}
      </View>
      <View style={styles.trendFoot}>
        <NumericText style={styles.trendFootText}>{formatSessionDate(bars[0].performedAt)}</NumericText>
        <NumericText style={styles.trendFootText}>
          {newest !== null
            ? `${withUnit(formatVolume(newest.volume), unit)} · ${formatSessionDate(newest.performedAt)}`
            : `unavailable · ${formatSessionDate(bars[bars.length - 1].performedAt)}`}
        </NumericText>
      </View>
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    maxHeight: "85%",
    backgroundColor: t.colors.role.surface,
    borderTopWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: SPACING.medium,
    paddingHorizontal: SPACING.large,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.colors.role.hairlineStrong,
    marginBottom: SPACING.medium,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 19,
    fontWeight: "bold",
    color: t.colors.role.textPrimary,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12,
    color: t.colors.role.textSecondary,
  },
  close: {
    width: HIT,
    height: HIT,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: t.colors.role.raised,
    borderWidth: 1,
    borderColor: t.colors.role.hairline,
  },
  body: {
    gap: 14,
    paddingTop: 14,
  },
  status: {
    fontSize: t.fonts.small,
    color: t.colors.role.textSecondary,
    paddingVertical: SPACING.large,
  },
  chips: {
    flexDirection: "row",
    gap: SPACING.small,
  },
  chip: {
    flex: 1,
    minHeight: HIT,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: t.colors.role.hairline,
  },
  chipSelected: {
    backgroundColor: t.colors.role.accentDeep,
    borderColor: t.colors.role.accent,
  },
  chipText: {
    fontSize: 13,
    color: t.colors.role.textSecondary,
  },
  chipTextSelected: {
    color: t.colors.role.textPrimary,
  },
  caption: {
    fontSize: 12,
    color: t.colors.role.textSecondary,
  },
  notice: {
    fontSize: t.fonts.small,
    color: t.colors.role.textSecondary,
  },
  table: {
    borderWidth: 1,
    borderColor: t.colors.role.hairline,
    borderRadius: 14,
    overflow: "hidden",
  },
  tableScroll: {
    flexGrow: 1,
  },
  tableInner: {
    flex: 1,
    minWidth: TABLE_MIN_WIDTH,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.small,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tableHead: {
    minHeight: 30,
    backgroundColor: t.colors.role.ground,
  },
  headText: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: t.colors.role.textSecondary,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: t.colors.role.hairline,
  },
  nextRow: {
    backgroundColor: t.colors.role.raised,
  },
  colSet: {
    width: 28,
  },
  colPast: {
    flex: 1,
    minWidth: 104,
  },
  colFelt: {
    width: 36,
    textAlign: "center",
  },
  feltCell: {
    alignItems: "center",
  },
  colToday: {
    flex: 1.3,
    minWidth: 150,
    textAlign: "right",
  },
  todayCell: {
    alignItems: "flex-end",
    gap: 2,
  },
  setNumber: {
    fontSize: 12,
    color: t.colors.role.textSecondary,
  },
  nextText: {
    color: t.colors.role.accent,
  },
  past: {
    fontSize: 14.5,
    color: t.colors.role.textSecondary,
  },
  today: {
    fontSize: 14.5,
    color: t.colors.role.textPrimary,
  },
  logging: {
    fontSize: 10.5,
    letterSpacing: 1,
    color: t.colors.role.accent,
  },
  absent: {
    fontSize: 13,
    color: t.colors.role.textSecondary,
  },
  best: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 13,
    backgroundColor: t.colors.role.signalDeep,
    borderWidth: 1,
    borderColor: t.colors.role.hairline,
  },
  bestText: {
    flex: 1,
    minWidth: 0,
  },
  bestTitle: {
    fontSize: 12.5,
    fontWeight: "bold",
    color: t.colors.role.signal,
  },
  bestValue: {
    marginTop: 1,
    fontSize: 12,
    color: t.colors.role.textPrimary,
  },
  trend: {
    gap: SPACING.small,
  },
  trendHead: {
    fontSize: 10.5,
    letterSpacing: 1.2,
    color: t.colors.role.textSecondary,
  },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    height: TREND_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.role.hairlineStrong,
  },
  barSlot: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },
  bar: {
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: t.colors.role.accent,
  },
  // An unavailable session: an outlined empty slot, so the gap is visible
  // rather than looking like a session that was never there.
  barGap: {
    height: TREND_HEIGHT,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: t.colors.role.hairlineStrong,
    borderRadius: 3,
  },
  trendFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  trendFootText: {
    fontSize: 10.5,
    color: t.colors.role.textSecondary,
  },
});
