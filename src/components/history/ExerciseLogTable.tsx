import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { TextBase } from "../TextBase";
import { EffortMark } from "./EffortMark";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { averageText, rowCells, rowUnit, unitBreakText, type ExerciseLog, type LogEntry, type LogSegment } from "../../utils/exerciseLog";
import type { HeaderParts } from "../../utils/sessionView";
import type { SetView } from "../../utils/sessionView";

// Layout of the board (HistExercise05 to 09), in dp. The date column stays put while the set columns scroll beside it.
const DATE_COLUMN = 72;
// Up to this many set columns share the width; more scroll, each this wide.
const SHARED_COLUMNS = 3;
const SCROLL_COLUMN = 90;
const HEADER_HEIGHT = 24;
// The date line (26), the average line (24) and the 4 dp of padding above and below.
const ROW_BASE = 58;
const LINE = 18;
/** Caption lines under a row's date: what kind of session it was. */
const captionsOf = (entry: LogEntry): string[] => [...(entry.freestyle ? ["Freestyle"] : []), ...(entry.dropSet ? ["Drop set"] : [])];

/** The small lines under the date itself: its year, and its time when another session fell on the same day. */
const stampLines = (label: HeaderParts): string[] => [label.year, label.clock].filter((line): line is string => line !== null);

/**
 * A row is as tall as its tallest side, and both sides get that one height: the date column and the set columns are
 * two stacks (so the date can stay put), and a drop set's split lines or the date's year, time and captions must not shift one against the other.
 */
const rowHeight = (entry: LogEntry, label: HeaderParts): number =>
  ROW_BASE + LINE * Math.max(stampLines(label).length + captionsOf(entry).length, ...entry.sets.map((set) => set.split.length));

/**
 * The log of one lift (TICKET-084 stage 1, boards HistExercise05 to 12): a pinned Date column with each session's
 * average weight, and a column per set beside it. It owns no rule: values, the unit breaks and the cell shaping are
 * `utils/exerciseLog.ts`. A unit break starts a new block with its own header, so two units never share a column header.
 * The newest session is marked with a dot. A row is one tap target to its Session.
 */
export function ExerciseLogTable({
  log,
  dateLabels,
  onOpen,
}: {
  log: ExerciseLog;
  /** Entry key → its date text (`compareHeaders`), computed over the whole log so a day with two sessions shows times. */
  dateLabels: Readonly<Record<string, HeaderParts>>;
  onOpen: (entry: LogEntry) => void;
}) {
  const { styles } = useThemeStyles(createStyles);
  const newest = log.segments[0]?.entries[0]?.key;
  return (
    <View testID="exercise-log">
      {log.segments.map((segment, index) => (
        <View key={segment.entries[0].key}>
          {index > 0 && <TextBase style={styles.unitBreak}>{unitBreakText(segment.unit)}</TextBase>}
          <Block segment={segment} columns={log.columns} dateLabels={dateLabels} newest={newest} onOpen={onOpen} />
        </View>
      ))}
    </View>
  );
}

const Block = React.memo(function Block({
  segment,
  columns,
  dateLabels,
  newest,
  onOpen,
}: {
  segment: LogSegment;
  columns: number;
  dateLabels: Readonly<Record<string, HeaderParts>>;
  newest: string | undefined;
  onOpen: (entry: LogEntry) => void;
}) {
  const { styles } = useThemeStyles(createStyles);
  const { width } = useWindowDimensions();
  const available = width - DATE_COLUMN;
  const columnWidth = columns <= SHARED_COLUMNS ? available / Math.max(columns, 1) : SCROLL_COLUMN;
  return (
    <View style={styles.block}>
      <View style={styles.dateColumn}>
        <View style={styles.headCell}>
          <TextBase style={styles.head}>Date</TextBase>
        </View>
        {segment.entries.map((entry) => {
          const latest = entry.key === newest;
          return (
            <TouchableOpacity
              key={entry.key}
              style={[styles.dateCell, { height: rowHeight(entry, dateLabels[entry.key]) }, latest && styles.latest]}
              onPress={() => onOpen(entry)}
              accessibilityRole="button"
              accessibilityLabel={`${[dateLabels[entry.key].date, ...stampLines(dateLabels[entry.key])].join(" ")}, ${entry.workoutName}`}
              testID={`exercise-log-date-${entry.key}`}
            >
              {latest && <View style={styles.dot} />}
              <TextBase style={styles.date}>{dateLabels[entry.key].date}</TextBase>
              {stampLines(dateLabels[entry.key]).map((line) => (
                <TextBase key={line} style={styles.caption} numberOfLines={1}>
                  {line}
                </TextBase>
              ))}
              <TextBase numeric style={[styles.average, latest && styles.averageLatest]}>
                {entry.average.kind === "value" ? [averageText(entry.average.value), rowUnit(entry.average.unit)].filter(Boolean).join(" ") : "–"}
              </TextBase>
              {captionsOf(entry).map((caption) => (
                <TextBase key={caption} style={styles.caption} numberOfLines={1}>
                  {caption}
                </TextBase>
              ))}
            </TouchableOpacity>
          );
        })}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={columnWidth}
        decelerationRate="fast"
        style={styles.sets}
        testID="exercise-log-sets"
      >
        <View>
          <View style={styles.headRow}>
            {Array.from({ length: columns }, (_, i) => (
              <View key={i} style={[styles.headCell, { width: columnWidth }]}>
                <TextBase style={styles.head}>Set {i + 1}</TextBase>
              </View>
            ))}
          </View>
          {segment.entries.map((entry) => (
            <SetsRow key={entry.key} entry={entry} label={dateLabels[entry.key]} columns={columns} columnWidth={columnWidth} latest={entry.key === newest} onOpen={onOpen} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
});

function SetsRow({
  entry,
  label,
  columns,
  columnWidth,
  latest,
  onOpen,
}: {
  entry: LogEntry;
  label: HeaderParts;
  columns: number;
  columnWidth: number;
  latest: boolean;
  onOpen: (entry: LogEntry) => void;
}) {
  const { styles } = useThemeStyles(createStyles);
  const { cells, more } = rowCells(entry.sets, columns);
  return (
    <TouchableOpacity
      style={[styles.setsRow, { height: rowHeight(entry, label) }, latest && styles.latest]}
      onPress={() => onOpen(entry)}
      accessibilityRole="button"
      accessibilityLabel={`Sets of ${entry.workoutName}`}
    >
      {cells.map((cell, i) => (
        <View key={i} style={[styles.setCell, { width: columnWidth }]}>
          {cell === null ? null : <Cell set={cell} more={i === columns - 1 ? more : 0} />}
        </View>
      ))}
    </TouchableOpacity>
  );
}

function Cell({ set, more }: { set: SetView; more: number }) {
  const { styles } = useThemeStyles(createStyles);
  return (
    <>
      <View style={styles.cellLine}>
        {set.text === null ? (
          <TextBase style={styles.unreadable}>Not readable</TextBase>
        ) : (
          <TextBase numeric style={styles.setText}>
            {set.text}
          </TextBase>
        )}
        <EffortMark effort={set.effort} />
        {more > 0 && (
          <TextBase style={styles.more} accessibilityLabel={`${more} more sets`}>
            +{more}
          </TextBase>
        )}
      </View>
      {set.split.map((line, i) => (
        <TextBase key={i} numeric style={styles.split}>
          {line}
        </TextBase>
      ))}
    </>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    block: { flexDirection: "row" },
    dateColumn: { width: DATE_COLUMN, borderRightWidth: 1, borderRightColor: t.colors.role.hairlineStrong, backgroundColor: t.colors.role.ground },
    sets: { flex: 1 },
    headRow: { flexDirection: "row" },
    headCell: { height: HEADER_HEIGHT, justifyContent: "center", alignItems: "center", paddingLeft: 0 },
    head: { fontSize: t.fonts.small, color: t.colors.role.textSecondary },
    // 12 dp in from the column edge leaves "Freestyle" room at the caption size: shrinking it to fit made it unreadable on a phone.
    dateCell: { paddingLeft: 12, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: t.colors.role.hairline },
    latest: { backgroundColor: t.colors.role.surface },
    dot: { position: "absolute", left: 4, top: 13, width: 6, height: 6, borderRadius: 3, backgroundColor: t.colors.role.accent },
    date: { height: 26, lineHeight: 26, fontSize: t.fonts.xMedium, fontWeight: "bold", color: t.colors.role.textPrimary },
    average: { height: 24, lineHeight: 24, fontSize: t.fonts.small, color: t.colors.role.textSecondary },
    averageLatest: { fontWeight: "bold", color: t.colors.role.textPrimary },
    caption: { height: LINE, fontSize: t.fonts.small, color: t.colors.role.textSecondary },
    setsRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: t.colors.role.hairline },
    setCell: { alignItems: "center", justifyContent: "flex-start", paddingTop: 4 },
    cellLine: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 26 },
    setText: { fontSize: t.fonts.xMedium, fontWeight: "bold", color: t.colors.role.textPrimary },
    unreadable: { fontSize: t.fonts.small, color: t.colors.role.textSecondary },
    split: { fontSize: t.fonts.small, color: t.colors.role.textSecondary, height: LINE },
    more: { fontSize: t.fonts.small, color: t.colors.role.textSecondary },
    unitBreak: { paddingHorizontal: 14, paddingVertical: 12, fontSize: t.fonts.xMedium, color: t.colors.role.textSecondary },
  });
