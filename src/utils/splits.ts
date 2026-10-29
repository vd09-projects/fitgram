// src/utils/splits.ts
//
// Split sets (TICKET-033): a set whose weight changed part-way, 20 kg × 5 then
// 17.5 kg × 3. The first segment is the set (`ExerciseSet.segments[0]`,
// stored as `sets[i]`); the segments after it are the split. This file pairs the stored rows
// with their sets, decides the card's × / split control, and builds the set a
// Log tap stores.
// Pure; tests in splits.test.ts.

import { ExerciseField } from "../types/workoutType";
import { StoredSetFields, StoredSplit } from "../types/workoutSession";
import { ExerciseSet } from "../types/zustandWorkoutType";
import { buildSetFields, missingFields } from "./setLogger";

/** One row's values as the card's inputs hold them. */
export type SplitRowValues = Record<string, string>;

/**
 * What each live set stores in `setSplits`: its segments after the first,
 * wrapped in a map, or null when it was not split. Null, never undefined
 * (Firestore rejects undefined), and never a bare array (Firestore rejects an
 * array inside an array).
 */
export const storedSplits = (sets: readonly Pick<ExerciseSet, "segments">[]): (StoredSplit | null)[] =>
  sets.map((set) => (set.segments.length > 1 ? { rows: set.segments.slice(1) } : null));

export type ZippedSplits = {
  /** One entry per set, in set order. [] when not split; null when unknown. */
  rows: (StoredSetFields[] | null)[];
  /** True when the stored rows could not be paired with the sets. */
  unavailable: boolean;
};

const isRow = (value: unknown): value is StoredSetFields =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Pair a session's stored `setSplits` with its `setCount` sets. The same rules
 * as `zipSetEffort`, except that an unknown entry is unknown rather than
 * "nothing": a missing mark is harmless, missing rows would understate volume.
 *
 * - **Missing array** (a doc saved before TICKET-033): no set split. Nothing
 *   could have been split then, so that is true.
 * - **Not an array, or a length mismatch**: every set's rows null, and
 *   `unavailable`. Pairing by position could hang rows on the wrong set.
 * - **null entry**: that set was not split, [].
 * - **Any other entry that is not `{ rows: [row, …] }`**: that set's rows null.
 *   Its volume is then unavailable; the other sets stand.
 */
export function zipSetSplits(setCount: number, setSplits: unknown): ZippedSplits {
  const all = (value: StoredSetFields[] | null) => Array.from({ length: setCount }, () => value);
  if (setSplits === undefined) return { rows: all([]), unavailable: false };
  if (!Array.isArray(setSplits) || setSplits.length !== setCount) return { rows: all(null), unavailable: true };
  return {
    rows: setSplits.map((entry) => {
      if (entry === null) return [];
      const rows = typeof entry === "object" ? (entry as { rows?: unknown }).rows : undefined;
      return Array.isArray(rows) && rows.every(isRow) ? rows : null;
    }),
    unavailable: false,
  };
}

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
