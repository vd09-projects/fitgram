// src/utils/exerciseLog.ts
//
// TICKET-084 stage 1: the log of one lift on the Exercise screen (boards HistExercise05 to 12), as data.
// Pure: workouts in, rows out, so the grouping, the average and the unit breaks are tested without a
// screen, and a wrong value cannot hide as a plausible one (CLAUDE.md 3.2). The screen draws.
//
// The log is read from the workouts the phone holds (the window, the queue, the pages the History home
// loaded): 0 reads. Pages past them are stage 3.

import { computeSessionVolume } from "./exerciseStats";
import { decodeStoredSets, plannedSegment, splitSegments } from "./storedSets";
import { parseSet, resolveNumericFields } from "./exerciseFields";
import { setArrows, setViews, type SetView } from "./sessionView";
import { formatStepValue } from "./setLogger";
import { compareSessions } from "./workoutWindow";
import { isFreestyle } from "../constants/freestyle";
import { unitSpec } from "../constants/units";
import type { RailWorkout } from "./historyRail";
import type { LiftRecord } from "../types/workoutSession";

/**
 * A session's "Average weight" of a lift. Defined here because the word could be read two ways (CLAUDE.md 2.3):
 * the mean of the weights of its sets, each set counted once whatever its reps, and a drop set counts its first
 * weight (`plannedSegment`, the set as planned, as every comparison does). Not the weight of the top set, and not
 * total volume divided by total reps (that weights a 12-rep set more, which is "Total lifted", stage 4's measure).
 *
 * `none` says why, never a number (2.4): a lift with no weight field (time, distance, reps only), a lift with no
 * sets, and a lift with any set that does not parse, because an average of the sets that did parse is a wrong
 * number that looks like data.
 */
export type MeasureValue =
  | { kind: "value"; value: number; unit: string }
  | { kind: "none"; reason: "no_weight" | "no_sets" | "unreadable" };
export type AverageWeight = MeasureValue;

/** What a session of a lift is summed up as, in the figure, the graph and the row: the measure picked in the view options. */
export type Measure = "average" | "total";

export const measureLabel = (measure: Measure): string => (measure === "average" ? "Average weight" : "Total lifted");

export function averageWeight(lift: Pick<LiftRecord, "fields" | "sets">): AverageWeight {
  const numeric = resolveNumericFields([...lift.fields]);
  if (!numeric) return { kind: "none", reason: "no_weight" };
  const sets = decodeStoredSets(lift.sets);
  if (sets.length === 0) return { kind: "none", reason: "no_sets" };
  const weights = sets.map((set) => parseSet(plannedSegment(set), numeric).weight);
  if (weights.some((weight) => weight === null)) return { kind: "none", reason: "unreadable" };
  const total = (weights as number[]).reduce((sum, weight) => sum + weight, 0);
  return { kind: "value", value: total / weights.length, unit: numeric.weight.unit ?? "" };
}

/**
 * A session's "Total lifted" of a lift: weight × reps over every set added up, **every segment of a drop set included**
 * (board HistExercise06 opens a drop set into its total). It is `computeSessionVolume`, the one definition of volume the app
 * has, so this and a lift's stored volume cannot disagree; its rule stands: a session with any set that does not parse has
 * no total, never a partial sum.
 */
export function totalLifted(lift: Pick<LiftRecord, "fields" | "sets">): MeasureValue {
  const numeric = resolveNumericFields([...lift.fields]);
  if (!numeric) return { kind: "none", reason: "no_weight" };
  const sets = decodeStoredSets(lift.sets);
  if (sets.length === 0) return { kind: "none", reason: "no_sets" };
  const { value } = computeSessionVolume(sets, numeric);
  return value === null ? { kind: "none", reason: "unreadable" } : { kind: "value", value, unit: numeric.weight.unit ?? "" };
}

/** "59.3" for 59.25: one decimal, as the boards show it. The unit is drawn beside it. */
export const averageText = (value: number): string => value.toFixed(1);

/**
 * A measure's number as written: the average to one decimal ("59.2"), a total with thousands separators and a decimal only
 * when it has one ("1,590", "1,405.5"), as the boards write them. Separators are put in by hand: `toLocaleString` is not
 * dependable across the JS engines the app runs on.
 */
export function measureText(measure: Measure, value: number): string {
  if (measure === "average") return averageText(value);
  const rounded = String(Math.round(value * 10) / 10);
  const [whole, fraction] = rounded.split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction ? `.${fraction}` : ""}`;
}

/** A session's number for `measure`, from its entry. */
export const valueOf = (entry: Pick<LogEntry, "average" | "total">, measure: Measure): MeasureValue =>
  measure === "average" ? entry.average : entry.total;

/**
 * The unit a row writes beside its average ("59.2 kg"), or null for none. The board writes it on every row; a unit that
 * is a word ("plates", the units with a `singular`) does not fit the 72 dp date column and its tail was cut off on the
 * emulator, so a word unit is stated by the figure above the log and by the line that breaks two units apart, not per row.
 * Rejected: shrinking the text to fit, which made the numbers unreadable at the width needed.
 */
export const rowUnit = (unit: string): string | null => (unitSpec(unit)?.singular === undefined ? unit : null);

/** Why a session has no number for `measure`, in the words the screen shows under the figure. */
export function measureReason(measure: Measure, reason: Extract<MeasureValue, { kind: "none" }>["reason"]): string {
  switch (reason) {
    case "no_weight":
      return measure === "average" ? "No weight to average" : "No weight to total";
    case "no_sets":
      return "No sets";
    case "unreadable":
      return "A set could not be read";
  }
}

/**
 * The weight unit a lift's sets were logged in, or null when it has no weight field. The one thing a unit break is
 * decided by: the same rule as `areFieldsComparable`, which compares weight units and nothing else.
 */
export const weightUnitOf = (fields: LiftRecord["fields"]): string | null => resolveNumericFields([...fields])?.weight.unit ?? null;

/**
 * A lift's sets as the log draws them: "62.5 × 8", with no unit. The unit is in the row's date column beside the average
 * (and in the line that breaks two units apart), and a cell with "kg" in it did not fit three columns on a phone: the
 * effort badge was cut off (found on the emulator). A lift with no weight × reps pair keeps `setViews`' text, units
 * and all: there the cell is the only place the unit appears. A split segment is written the same way.
 */
function logSetViews(lift: Pick<LiftRecord, "fields" | "sets">, arrows: readonly ("up" | "down" | null)[]): SetView[] {
  const numeric = resolveNumericFields([...lift.fields]);
  const views = setViews(lift.fields, lift.sets, arrows);
  if (!numeric) return views;
  const plain = (segment: Parameters<typeof parseSet>[0]): string | null => {
    const { weight, reps } = parseSet(segment, numeric);
    return weight !== null && reps !== null ? `${formatStepValue(weight)} × ${formatStepValue(reps)}` : null;
  };
  const decoded = decodeStoredSets(lift.sets);
  return views.map((view, i) => ({
    ...view,
    text: (view.text !== null && plain(plannedSegment(decoded[i]))) || view.text,
    split: splitSegments(decoded[i]).map((segment, j) => plain(segment) ?? view.split[j]),
  }));
}

export type LogEntry = {
  /** `sessionId` plus the lift's position, so a workout that did the lift in two slots has two distinct rows. */
  key: string;
  sessionId: string;
  workoutName: string;
  startedAt: number;
  state: RailWorkout["state"];
  /** The session's own fields: a value is in the unit it was logged in, nothing is converted. */
  sets: SetView[];
  average: MeasureValue;
  total: MeasureValue;
  freestyle: boolean;
  /** Any set of the lift was split (a drop set). */
  dropSet: boolean;
};

/**
 * A run of entries logged in one weight unit, newest first. A new segment starts where the unit differs from the
 * entry before it (older), and `unit` names what its entries were logged in, for the divider above it.
 */
export type LogSegment = { unit: string | null; entries: LogEntry[] };

export type ExerciseLog = {
  /** Newest first. Empty when no held workout has the lift. */
  segments: LogSegment[];
  /** The newest entry's set count: the columns of the table (`rowCells`). 0 for an empty log. */
  columns: number;
  /**
   * Workouts that did the lift (their `exerciseIds` say so) but whose lifts could not be read, so they have no
   * row. Counted, not dropped quietly (2.4): the screen says how many.
   */
  unreadable: number;
};

/**
 * The log of `exerciseId` from `workouts` (any order, one entry per lift record that has it), newest first.
 *
 * - A workout in the list twice (queued and already held) is one: the first copy after sorting stands.
 * - One row per lift record, not per workout: a workout with the lift in two slots (planned, then added) shows
 *   both, in their order, rather than a merged row that would invent an average over two lifts.
 * - Rejected: one fixed column count from the most sets anywhere. The board sizes the table by the newest
 *   session ("Set 1 to Set 3" with a "+2" on an older five-set row), so what you did last time sets the shape.
 */
export function exerciseLog(workouts: readonly RailWorkout[], exerciseId: string): ExerciseLog {
  const seen = new Set<string>();
  const ordered = [...workouts]
    .sort((a, b) => compareSessions(a.session, b.session))
    .filter(({ session }) => !seen.has(session.sessionId) && seen.add(session.sessionId));

  const found: { session: RailWorkout["session"]; state: RailWorkout["state"]; index: number; lift: LiftRecord }[] = [];
  let unreadable = 0;
  for (const { session, state } of ordered) {
    if (session.liftsUnreadable) {
      if (session.exerciseIds.includes(exerciseId)) unreadable += 1;
      continue;
    }
    session.lifts.forEach((lift, index) => {
      if (lift.id === exerciseId) found.push({ session, state, index, lift });
    });
  }

  // Each set's mark is against the same-numbered set of the entry just older in the log, as the Session's compare does
  // (`setArrows`: nothing across a unit change, nothing without an older entry). The oldest entry loaded has none, so it shows
  // no marks until a page older than it is loaded: no mark, never a guessed "same".
  // "Just older" means the previous session: the lift's other slot in the same workout is not what it is compared with
  // (a planned and an added slot of one workout would otherwise be marked against each other, review of PR #77).
  const previousOf = (i: number): LiftRecord | null => found.slice(i + 1).find((later) => later.session.sessionId !== found[i].session.sessionId)?.lift ?? null;
  const entries: LogEntry[] = found.map(({ session, state, index, lift }, i) => ({
    key: `${session.sessionId}:${index}`,
    sessionId: session.sessionId,
    workoutName: session.workoutName,
    startedAt: session.startedAt,
    state,
    sets: logSetViews(lift, setArrows(lift, previousOf(i))),
    average: averageWeight(lift),
    total: totalLifted(lift),
    freestyle: isFreestyle(session.workoutId),
    dropSet: decodeStoredSets(lift.sets).some((set) => set.segments.length > 1),
  }));
  const units = found.map(({ lift }) => weightUnitOf(lift.fields));

  const segments: LogSegment[] = [];
  entries.forEach((entry, i) => {
    if (i === 0 || units[i] !== units[i - 1]) segments.push({ unit: units[i], entries: [] });
    segments[segments.length - 1].entries.push(entry);
  });
  // The newest entry that has any sets sets the shape: a newest session with none (a lift opened and left empty) would make every
  // older row show no sets at all and no "+N" (review of PR #77).
  return { segments, columns: entries.find((entry) => entry.sets.length > 0)?.sets.length ?? 0, unreadable };
}

/**
 * The newest `count` entries of a log (null: all of them), with the segments that remain: "Last 5" of the view options. The
 * columns and the unreadable count are the whole log's: what the newest session did sets the table's shape whatever is hidden.
 */
export function limitLog(log: ExerciseLog, count: number | null): ExerciseLog {
  if (count === null) return log;
  let left = count;
  const segments = log.segments.flatMap((segment) => {
    if (left <= 0) return [];
    const entries = segment.entries.slice(0, left);
    left -= entries.length;
    return [{ ...segment, entries }];
  });
  return { ...log, segments };
}

/** The sets a row shows in `columns` columns: a cell per column (null where the session had fewer), and how many sets did not fit. */
export function rowCells(sets: readonly SetView[], columns: number): { cells: (SetView | null)[]; more: number } {
  return {
    cells: Array.from({ length: columns }, (_, i) => sets[i] ?? null),
    more: Math.max(0, sets.length - columns),
  };
}

/**
 * What a screen reader says for one set: the values, any split rows, the effort and the mark, each only if the log shows it. A
 * row's label that replaced its content would say "Sets of Push" and nothing else (review of PR #77).
 */
export function spokenSet(set: SetView, show: { effort: boolean; marks: boolean }): string {
  const parts = [set.text ?? "not readable", ...set.split.map((line) => `then ${line}`)];
  if (show.effort && set.effort !== null) parts.push(set.effort === "hard" ? "felt hard" : "felt easy");
  if (show.marks && set.arrow !== null) parts.push(set.arrow === "up" ? "better than last time" : "lower than last time");
  return parts.join(", ");
}

/** The line between two unit segments (board HistExercise09), naming the older unit when it has one. */
export const unitBreakText = (olderUnit: string | null): string =>
  olderUnit === null
    ? "Before this the sets were logged differently, so they are not compared"
    : `Before this the sets were in ${olderUnit}, so they are not compared`;
