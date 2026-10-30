// src/utils/splits.ts
//
// Split sets (TICKET-033): a set whose weight changed part-way, 20 kg × 5 then
// 17.5 kg × 3. The first segment is the set (`ExerciseSet.segments[0]`); the
// segments after it are the split. This file decides the card's × / split
// control, builds the set a Log or Save tap stores (033-1, 033-3), says how
// last time's split reads on the next session's card (033-2), and what repeat
// copies from it (033-3).
// Pure; tests in splits.test.ts.

import { ExerciseField } from "../types/workoutType";
import { buildSetFields, editInputValues, formatStepValue, GhostTarget, missingFields, SetAction, withUnlistedFields } from "./setLogger";
import { NumericFieldMap, parseSet } from "./exerciseFields";
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
 * - One row (a normal set): null, no third column; weight and reps take the
 *   full width, and the first split starts from the exercise menu (TICKET-058,
 *   board MenuLogger). Replaced: a split button beside every set (board S1),
 *   on the screen used every set for an action most sets never take.
 * - Any row but the last, the first segment included: `remove` (×). Removing
 *   the first makes the next row the set, and its values become what last
 *   time, targets and records compare (user, 2026-10-29). Before Log nothing is
 *   stored, so which row is first is the user's to choose. Replaced: no × on
 *   the first row (board S2), which meant a wrong first row could only be
 *   fixed by retyping it.
 * - The last row: `remove` (×) while it is missing a field, `split` once it is
 *   filled (`canAddSplit`). Back to 033-1's rule (TICKET-058, user,
 *   2026-10-30), reversing PR #30 finding 1. Cost accepted: a filled last row
 *   that repeat built and the user did not do shows split, not ×, so dropping
 *   it is two steps (clear a field, then ×). Chosen so adding a row stays one
 *   tap on the card; the menu's "Split set N again" adds one too. Rejected: ×
 *   on every row with the menu as the only add (one tap to drop, two to add);
 *   "+ split" under the rows (PR #30's fix: an extra full-width button on
 *   every split set).
 */
export type SplitSlot = "remove" | "split";

export function splitSlot(fields: ExerciseField[], rows: readonly SplitRowValues[], index: number): SplitSlot | null {
  if (rows.length === 1) return null;
  return index === rows.length - 1 && canAddSplit(fields, rows) ? "split" : "remove";
}

/**
 * Whether a split card can take another row: once the last row has every
 * required field, so a second blank row cannot be added. Gates the last row's
 * split slot and the menu's "Split set N again" (disabled with "Fill the last
 * row first"). Gated on the whole row rather than reps alone so a distance ×
 * time row works the same way. One row: false; the menu's "Split set N" is
 * always available there.
 */
export function canAddSplit(fields: ExerciseField[], rows: readonly SplitRowValues[]): boolean {
  return rows.length > 1 && missingFields(fields, rows[rows.length - 1]).length === 0;
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
  // Strings, as typed: assignable to `ExerciseSet.segments`.
  | { kind: "ok"; set: { segments: Record<string, string>[] } }
  | { kind: "refused"; message: string };

/**
 * What a Log tap stores from the card's rows, or why it is refused: the rows
 * as they are, one segment each, the first row first. Every row passes the set's own check (`buildSetFields`), so a split row
 * cannot store what logging a set would refuse; a refusal names the split row.
 *
 * A blank last split row is dropped (`keptSplitRows`). An earlier blank row is
 * refused, not dropped: it sits between two real rows, and the × beside it is
 * the way to take it out.
 *
 * `action` words the refusal only: an edit's Save is checked by exactly these
 * rules (TICKET-033-3), as a one-row edit was by `buildSetFields` (TICKET-040).
 */
export function buildLoggedSet(
  fields: ExerciseField[],
  rows: readonly SplitRowValues[],
  setNumber: number,
  action: SetAction = "log"
): LoggedSetResult {
  const [first = {}, ...rest] = rows;
  const set = buildSetFields(fields, first, setNumber, action);
  if (set.kind === "refused") return set;

  const segments: Record<string, string>[] = [set.fields];
  for (const [index, values] of keptSplitRows(fields, rest).entries()) {
    const built = buildSetFields(fields, values, setNumber, action);
    if (built.kind === "refused") return { kind: "refused", message: `Split ${index + 1}: ${built.message}` };
    segments.push(built.fields);
  }
  return { kind: "ok", set: { segments } };
}

/**
 * One edit row: its values as the card holds them, and the stored segment it
 * was loaded from, or null for a row added during the edit (TICKET-033-3).
 * The source travels with the row, so removing row 1 does not hand row 1's
 * stored keys to the row that takes its place.
 */
export type EditRow = { values: SplitRowValues; source: Record<string, string | number> | null };

/** A logged set's segments as edit rows, one each, in order. */
export const editRows = (segments: readonly Record<string, string | number>[]): EditRow[] =>
  segments.map((segment) => ({ values: editInputValues(segment), source: segment }));

/**
 * The segments an edit's Save passes to `updateSet`, which replaces them
 * whole, or why it is refused. Checked as Log checks (`buildLoggedSet`, worded
 * "save"): a half-filled row is refused and named, a blank last row dropped.
 * Each row that came from a stored segment keeps that segment's keys the
 * exercise no longer lists (`withUnlistedFields`); a new row has none.
 *
 * Kept rows are a prefix of `rows` (only the last can be dropped), so
 * `segments[i]` is `rows[i]`.
 */
export function buildEditedSegments(
  fields: ExerciseField[],
  rows: readonly EditRow[],
  setNumber: number
): { kind: "ok"; segments: Record<string, string>[] } | { kind: "refused"; message: string } {
  const built = buildLoggedSet(fields, rows.map((row) => row.values), setNumber, "save");
  if (built.kind === "refused") return built;
  return {
    kind: "ok",
    segments: built.set.segments.map((segment, index) => {
      const source = rows[index].source;
      return source ? withUnlistedFields(fields, source, segment) : segment;
    }),
  };
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
 * The rows repeat adds after the first for last time's set (board S6,
 * TICKET-033-3): one per later segment, as values in the weight and reps
 * fields, the fields repeat fills on the first row. The first row is still
 * `repeatValues` over the ghosts, so a non-split set repeats exactly as before.
 *
 * Scope growth (user, 2026-10-29): repeat copies the whole set. Replaced
 * "Repeat copies the first segment only; splits are never pre-built"
 * (TICKET-033 Decisions). Cost accepted: a row the user did not do this time
 * logs a split that was not done, unless removed. It shows in the header's
 * count and the Today chip, and the edit card fixes it.
 *
 * Stops at the first later segment whose weight or reps does not parse, and
 * says so (`incomplete`), as `decodeStoredSet` keeps the segments before the
 * first bad one: a chain with a gap would present a split that never happened.
 * Rejected: skipping only the bad row. No chain when last time's first
 * segment has no weight or reps, the same gate as `lastTimeSplit`: without
 * the pill there is no line, and rows would appear unexplained (PR #30
 * review). Parsed with `numeric`, the map that
 * parsed the first segment; a target is only `available` on a comparable
 * session, so its field names are the card's. Other fields start empty.
 */
export type RepeatRows = { rows: SplitRowValues[]; incomplete: boolean };

export function repeatSplitRows(target: GhostTarget, numeric: NumericFieldMap | null): RepeatRows {
  if (target.kind !== "available" || !numeric || target.set.weight === null || target.set.reps === null) {
    return { rows: [], incomplete: false };
  }
  const rows: SplitRowValues[] = [];
  for (const segment of splitSegments(target.set)) {
    const { weight, reps } = parseSet(segment, numeric);
    if (weight === null || reps === null) return { rows, incomplete: true };
    rows.push({ [numeric.weight.name]: formatStepValue(weight), [numeric.reps.name]: formatStepValue(reps) });
  }
  return { rows, incomplete: target.set.segmentsIncomplete };
}

/**
 * The line after repeat on a set that was split last time (board S6), in
 * place of the "split to" line: the chain repeat built, and that rows not
 * done this time are the user's to remove. `copied` are the rows' texts
 * (`lastTimeSplit`'s, cut to what repeat copied).
 */
export const repeatedSplitLine = (pillText: string, copied: readonly string[], incomplete: boolean): SplitLine => ({
  lead: "Repeated ",
  values: [pillText, ...copied].join(" · "),
  tail: `${incomplete ? " · more rows couldn't be read" : ""}${copied.length > 0 ? " · remove rows you didn't do" : ""}`,
});
