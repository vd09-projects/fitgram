// src/utils/pickerData.ts
//
// What the exercise picker builds before it can show anything (TICKET-043):
// the search catalog and the A–Z list. Pure, so the benchmark
// (src/scripts/benchmarkSearch.ts) times the same code the picker runs.

import type { Movement, SearchWords } from "../types/catalog";
import type { Exercise } from "../types/workoutType";
import { buildSearchCatalog, type SearchCatalog, type VersionPick } from "./exerciseSearch";

export type PickerRow =
  | { kind: "movement"; key: string; movement: Movement; preselect: VersionPick }
  | { kind: "custom"; key: string; exercise: Exercise };

/** Search results shown at once. Totals beyond it are not listed; a longer query narrows them. */
export const PICKER_RESULT_LIMIT = 100;

export type PickerData = { catalog: SearchCatalog; alphabetical: readonly PickerRow[] };
let prepared: { key: readonly unknown[]; data: PickerData } | null = null;

/**
 * The search catalog and the A–Z list, built once per catalog, words and
 * custom list and kept across opens: the picker unmounts on close, and
 * rebuilding on each open made opening visibly slow (device, 2026-10-27).
 * Manage Workout calls it early to warm it. One entry: there is one catalog.
 *
 * A–Z compares with `<`, not `localeCompare`: names are ASCII, and Hermes's
 * `localeCompare` goes through the platform collator on every comparison.
 */
export function preparePicker(
  movements: readonly Movement[],
  searchWords: SearchWords | null,
  customExercises: readonly Exercise[]
): PickerData {
  const key = [movements, searchWords, customExercises];
  if (prepared && prepared.key.every((k, i) => k === key[i])) return prepared.data;
  const alphabetical: PickerRow[] = movements
    .map((movement) => ({ kind: "movement" as const, key: movement.id, movement, preselect: {}, sortKey: movement.name.toLowerCase() }))
    .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0))
    .map(({ sortKey, ...row }) => row);
  prepared = { key, data: { catalog: buildSearchCatalog(movements, searchWords, customExercises), alphabetical } };
  return prepared.data;
}
