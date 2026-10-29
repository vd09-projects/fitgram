// src/utils/splits.ts
//
// Split sets (TICKET-033): a set whose weight changed part-way, 20 kg × 5 then
// 17.5 kg × 3. The first segment is the set (`ExerciseSet.segments[0]`); the
// segments after it are the split. This file decides the card's × / split
// control, builds the set a Log tap stores, and says how last time's split
// reads on the next session's card (033-2).
// Pure; tests in splits.test.ts.

import { ExerciseField } from "../types/workoutType";
import { ExerciseSet } from "../types/zustandWorkoutType";
import { buildSetFields, GhostTarget, missingFields } from "./setLogger";
import { setValuesText } from "./setDeltas";
import { splitSegments } from "./storedSets";

/** One row's values as the card's inputs hold them. */
export type SplitRowValues = Record<string, string>;

/** "1 split", "2 splits". Counts the rows after the first segment. */
export const splitCountText = (count: number): string => `${count} ${count === 1 ? "split" : "splits"}`;

/**
 * The third-column control beside row `index` of the set card, where `rows` is
 * every row, the first segment first (0-based).
 *
 * - One row (a normal set): `split`, whatever is typed, so a set can be split
 *   before or after its first values go in (board S1).
 * - Any row but the last, the first segment included: `remove` (×). Removing
 *   the first makes the next row the set, and its values become what last
 *   time, targets and records compare (user, 2026-10-29). Before Log nothing is
 *   stored, so which row is first is the user's to choose. Replaced: no × on
 *   the first row (board S2), which meant a wrong first row could only be
 *   fixed by retyping it.
 * - The last row: `cancel` (×) until every required field has a value, then
 *   `split` to add another. Gated on the whole row rather than reps alone so a
 *   distance × time row works the same way.
 */
export type SplitSlot = "remove" | "cancel" | "split";

export function splitSlot(fields: ExerciseField[], rows: readonly SplitRowValues[], index: number): SplitSlot {
  if (rows.length === 1) return "split";
  if (index < rows.length - 1) return "remove";
  return missingFields(fields, rows[index] ?? {}).length === 0 ? "split" : "cancel";
}

/**
 * The rows Log would keep: all of them, less a last row with every field
 * blank. The user tapped split and then did not need it. A last row with
 * anything typed is kept, and checked like the others, so a weight typed
 * without its reps is refused rather than silently dropped.
 */
export function keptSplitRows(
  fields: ExerciseField[],
  splitRows: readonly SplitRowValues[]
): readonly SplitRowValues[] {
  const last = splitRows[splitRows.length - 1];
  const untouched = last !== undefined && fields.every((field) => (last[field.name] ?? "").trim() === "");
  return untouched ? splitRows.slice(0, -1) : splitRows;
}

export type LoggedSetResult =
  | { kind: "ok"; set: Pick<ExerciseSet, "segments"> }
  | { kind: "refused"; message: string };

/**
 * What a Log tap stores from the card's rows, or why it is refused: the rows
 * as they are, one segment each, the first row first. Every row passes the set's own check (`buildSetFields`), so a split row
 * cannot store what logging a set would refuse; a refusal names the split row.
 *
 * A blank last split row is dropped (`keptSplitRows`). An earlier blank row is
 * refused, not dropped: it sits between two real rows, and the × beside it is
 * the way to take it out.
 */
export function buildLoggedSet(
  fields: ExerciseField[],
  rows: readonly SplitRowValues[],
  setNumber: number
): LoggedSetResult {
  const [first = {}, ...rest] = rows;
  const set = buildSetFields(fields, first, setNumber, "log");
  if (set.kind === "refused") return set;

  const segments: Record<string, string>[] = [set.fields];
  for (const [index, values] of keptSplitRows(fields, rest).entries()) {
    const built = buildSetFields(fields, values, setNumber, "log");
    if (built.kind === "refused") return { kind: "refused", message: `Split ${index + 1}: ${built.message}` };
    segments.push(built.fields);
  }
  return { kind: "ok", set: { segments } };
}

/**
 * Last time's split for the set about to be logged, for the card (board S5):
 * the pill shows `20 × 5 ⑂{count}` and a line lists `rows`. `null` when the
 * pill shows no numbers (no target: first time, other unit, a plank, a set
 * not reached) or last time's set was not split.
 *
 * - Tied to the pill, not to last session's set at this number whatever its
 *   state: the line reads "split to" the pill's first segment, so without the
 *   pill it has nothing to continue from. Cost: a treadmill split last time
 *   (no weight × reps, so no pill) shows no split line on the card; the sheet
 *   still lists it.
 * - Rows read in last session's own fields with units ("17.5 kg × 3"), as the
 *   Today list's split rows do (TodaySets, TICKET-033); the board drew
 *   "17.5 × 3".
 * - `incomplete`: some of that set's segments could not be read, so `rows`
 *   (and the count) hold only the readable ones. Said, never hidden, so a
 *   short list does not pass for the whole split (rule 2.4).
 */
export type LastTimeSplit = { count: number; rows: string[]; incomplete: boolean };

export function lastTimeSplit(target: GhostTarget, sessionFields: ExerciseField[]): LastTimeSplit | null {
  if (target.kind !== "available" || target.set.weight === null || target.set.reps === null) return null;
  const rows = splitSegments(target.set).map((segment) => setValuesText(sessionFields, segment));
  if (rows.length === 0 && !target.set.segmentsIncomplete) return null;
  return { count: rows.length, rows, incomplete: target.set.segmentsIncomplete };
}

/**
 * A card line whose middle is numbers: `values` renders in the numeric face,
 * as on the boards. Read as one string it is `lead + values + tail`.
 */
export type SplitLine = { lead: string; values: string; tail: string };

/** The card's line under the header for `lastTimeSplit` (board S5). */
export function lastTimeSplitLine(split: LastTimeSplit): SplitLine {
  if (split.rows.length === 0) return { lead: "Last time's split rows couldn't be read", values: "", tail: "" };
  return {
    lead: "Last time split to ",
    values: split.rows.join(" · "),
    tail: split.incomplete ? " · more rows couldn't be read" : "",
  };
}

/**
 * The line after repeat on a set that was split last time (board S6), in
 * place of the "split to" line. Repeat fills the first segment only (it fills
 * from the ghosts, which read `comparisonSegment`); this says the rest were
 * left out on purpose, not lost.
 */
export const repeatedSplitLine = (pillText: string): SplitLine => ({
  lead: "Repeated ",
  values: pillText,
  tail: " · splits not copied, tap split if you need them",
});
