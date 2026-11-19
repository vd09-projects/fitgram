import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { TextBase } from "../TextBase";
import { EffortMark } from "./EffortMark";
import { SetArrow } from "./SetArrow";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { measureLabel, measureText, rowCells, rowUnit, spokenSet, unitBreakText, valueOf, type ExerciseLog, type LogEntry, type LogSegment, type Measure } from "../../utils/exerciseLog";
import type { HeaderParts } from "../../utils/sessionView";
import type { SetView } from "../../utils/sessionView";

// Layout of the board (HistExercise05 to 09), in dp. The date column stays put while the set columns scroll beside it.
const DATE_COLUMN = 72;
// The set columns share the width beside the date column, but none is narrower than this: a set with its H badge and its
// better or lower mark needs about this much ("17.5 × 10" and both), and narrower cells ran into each other on the emulator.
// When they do not fit they scroll sideways, the date column staying put.
const MIN_COLUMN = 120;
const HEADER_HEIGHT = 24;
// The date line (26), the average line (24) and the 4 dp of padding above and below.
const ROW_BASE = 58;
const LINE = 18;
/** A row's number under its date and the unit beside it (`rowUnit`: a symbol only), or "–" with no number. */
const rowValue = (entry: LogEntry, measure: Measure): { number: string; unit: string | null } => {
  const value = valueOf(entry, measure);
  return value.kind === "value" ? { number: measureText(measure, value.value), unit: rowUnit(value.unit) } : { number: "–", unit: null };
};

/** What a screen reader says for a row's date cell: the date, the workout, the number under the date and the captions. */
const dateSpoken = (entry: LogEntry, label: HeaderParts, measure: Measure): string => {
  const value = valueOf(entry, measure);
  const number = value.kind === "value" ? `${measureLabel(measure).toLowerCase()} ${measureText(measure, value.value)} ${value.unit}`.trim() : `no ${measureLabel(measure).toLowerCase()}`;
  return [[label.date, ...stampLines(label)].join(" "), entry.workoutName, number, ...captionsOf(entry)].join(", ");
};

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
  measure,
  showEffort,
  showMarks,
  onOpen,
}: {
  log: ExerciseLog;
  /** Entry key → its date text (`compareHeaders`), computed over the whole log so a day with two sessions shows times. */
  dateLabels: Readonly<Record<string, HeaderParts>>;
  /** What each row's number under its date is: the average weight, or the total lifted. */
  measure: Measure;
  /** The H and E badges, and the ▲ and ▼ marks: the view options' Details. */
  showEffort: boolean;
  showMarks: boolean;
  onOpen: (entry: LogEntry) => void;
}) {
  const { styles } = useThemeStyles(createStyles);
  const newest = log.segments[0]?.entries[0]?.key;
  return (
    <View testID="exercise-log">
      {log.segments.map((segment, index) => (
        <View key={segment.entries[0].key}>
          {index > 0 && <TextBase style={styles.unitBreak}>{unitBreakText(segment.unit)}</TextBase>}
          <Block segment={segment} columns={log.columns} dateLabels={dateLabels} measure={measure} showEffort={showEffort} showMarks={showMarks} newest={newest} onOpen={onOpen} />
        </View>
      ))}
    </View>
  );
}

const Block = React.memo(function Block({
  segment,
  columns,
  dateLabels,
  measure,
  showEffort,
  showMarks,
  newest,
  onOpen,
}: {
  segment: LogSegment;
  columns: number;
  measure: Measure;
  showEffort: boolean;
  showMarks: boolean;
  dateLabels: Readonly<Record<string, HeaderParts>>;
  newest: string | undefined;
  onOpen: (entry: LogEntry) => void;
}) {
  const { styles } = useThemeStyles(createStyles);
  const { width } = useWindowDimensions();
  const available = width - DATE_COLUMN;
  const columnWidth = Math.max(available / Math.max(columns, 1), MIN_COLUMN);
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
              accessibilityLabel={dateSpoken(entry, dateLabels[entry.key], measure)}
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
                {rowValue(entry, measure).number}
                {rowValue(entry, measure).unit !== null && <TextBase style={styles.averageUnit}> {rowValue(entry, measure).unit}</TextBase>}
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
            <SetsRow key={entry.key} entry={entry} label={dateLabels[entry.key]} showEffort={showEffort} showMarks={showMarks} columns={columns} columnWidth={columnWidth} latest={entry.key === newest} onOpen={onOpen} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
});

function SetsRow({
  entry,
  label,
  showEffort,
  showMarks,
  columns,
  columnWidth,
  latest,
  onOpen,
}: {
  entry: LogEntry;
  label: HeaderParts;
  showEffort: boolean;
  showMarks: boolean;
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
      accessibilityLabel={`${[label.date, ...stampLines(label)].join(" ")}, ${entry.workoutName}, ${entry.sets.map((set, i) => `set ${i + 1}: ${spokenSet(set, { effort: showEffort, marks: showMarks })}`).join(". ")}`}
    >
      {cells.map((cell, i) => (
        <View key={i} style={[styles.setCell, { width: columnWidth }]}>
          {cell === null ? null : <Cell set={cell} more={i === columns - 1 ? more : 0} showEffort={showEffort} showMarks={showMarks} />}
        </View>
      ))}
    </TouchableOpacity>
  );
}

function Cell({ set, more, showEffort, showMarks }: { set: SetView; more: number; showEffort: boolean; showMarks: boolean }) {
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
        {showEffort && <EffortMark effort={set.effort} />}
        {showMarks && <SetArrow arrow={set.arrow} />}
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
    // The board writes the unit smaller than the number, which is what lets "1,870 kg" fit the date column.
    averageUnit: { fontSize: t.fonts.xSmall, fontWeight: "normal", color: t.colors.role.textSecondary },
    averageLatest: { fontWeight: "bold", color: t.colors.role.textPrimary },
    caption: { height: LINE, fontSize: t.fonts.small, color: t.colors.role.textSecondary },
    setsRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: t.colors.role.hairline },
    setCell: { alignItems: "center", justifyContent: "flex-start", paddingTop: 4 },
    cellLine: { flexDirection: "row", alignItems: "center", gap: 3, minHeight: 26 },
    setText: { fontSize: t.fonts.xMedium, fontWeight: "bold", color: t.colors.role.textPrimary },
    unreadable: { fontSize: t.fonts.small, color: t.colors.role.textSecondary },
    split: { fontSize: t.fonts.small, color: t.colors.role.textSecondary, height: LINE },
    more: { fontSize: t.fonts.small, color: t.colors.role.textSecondary },
    unitBreak: { paddingHorizontal: 14, paddingVertical: 12, fontSize: t.fonts.xMedium, color: t.colors.role.textSecondary },
  });
