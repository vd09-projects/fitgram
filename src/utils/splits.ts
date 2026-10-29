// src/utils/splits.ts
//
// Split sets (TICKET-033): a set whose weight changed part-way, 20 kg × 5 then
// 17.5 kg × 3. The first segment is the set (`ExerciseSet.segments[0]`); the
// segments after it are the split. This file decides the card's × / split
// control and builds the set a Log tap stores.
// Pure; tests in splits.test.ts.

import { ExerciseField } from "../types/workoutType";
import { ExerciseSet } from "../types/zustandWorkoutType";
import { buildSetFields, missingFields } from "./setLogger";

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
