// src/utils/pickerData.ts
//
// What the exercise picker builds before it can show anything (TICKET-043):
// the search catalog and the A–Z list; and the filter menus (TICKET-050).
// Pure, so the benchmark (src/scripts/benchmarkSearch.ts) times the same code
// the picker runs.

import { MUSCLES, type CategoryId, type EquipmentId, type MuscleGroupId } from "../constants/catalogVocabulary";
import type { Movement, SearchWords } from "../types/catalog";
import type { Exercise } from "../types/workoutType";
import { buildSearchCatalog, type SearchCatalog, type VersionPick } from "./exerciseSearch";

export type PickerRow =
  | { kind: "movement"; key: string; movement: Movement; preselect: VersionPick }
  | { kind: "custom"; key: string; exercise: Exercise };

/** Search results shown at once. Totals beyond it are not listed; a longer query narrows them. */
export const PICKER_RESULT_LIMIT = 100;

export type PickerData = {
  catalog: SearchCatalog;
  alphabetical: readonly PickerRow[];
  /** The Equipment menu: every equipment the catalog uses, most movements first (D4). */
  equipmentByUse: readonly EquipmentId[];
};
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
  prepared = {
    key,
    data: { catalog: buildSearchCatalog(movements, searchWords, customExercises), alphabetical, equipmentByUse: equipmentByUse(movements) },
  };
  return prepared.data;
}

function equipmentByUse(movements: readonly Movement[]): EquipmentId[] {
  const count = new Map<EquipmentId, number>();
  for (const movement of movements) {
    for (const equipment of new Set(movement.versions.map((v) => v.equipment))) count.set(equipment, (count.get(equipment) ?? 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([equipment]) => equipment);
}

/** The three filter menus (board A1). One value per menu, or none (user, 2026-10-27, D4). */
export type PickerFilters = { group?: MuscleGroupId; equipment?: EquipmentId; category?: CategoryId };

export const hasFilters = (filters: PickerFilters) => !!(filters.group || filters.equipment || filters.category);

/**
 * Whether a movement passes the filters; every set menu must match (AND).
 *
 * - **Muscle: PRIMARY MUSCLES ONLY** (user, 2026-10-27, D4), the movement's.
 *   A version's own primaries are not checked, ON PURPOSE: the filter lists
 *   movements, and a movement belongs where its main target is. 19 versions
 *   across 8 movements name a primary in another group (bench_press 5, clean
 *   4, push_up 3, push_press 2, snatch 2, hang_clean 1, lat_pulldown 1,
 *   rear_delt_row 1; counted 2026-10-27): Close-grip Bench's triceps does not
 *   put Bench Press under Arms. So Bench Press is under Chest,
 *   not under Arms for its triceps. Search differs on purpose: a typed muscle
 *   also scores secondary muscles (1 point), so "triceps" still lists Bench
 *   Press far down. The menu answers "chest exercises", the query ranks.
 * - **Equipment:** some version uses it.
 * - **Type:** the movement's category.
 */
export function matchesFilters(movement: Movement, filters: PickerFilters): boolean {
  if (filters.category && movement.category !== filters.category) return false;
  if (filters.equipment && !movement.versions.some((v) => v.equipment === filters.equipment)) return false;
  if (filters.group && !movement.primaryMuscles.some((m) => MUSCLES[m].group === filters.group)) return false;
  return true;
}

/**
 * The sheet's preselection for a movement found under filters: the Equipment
 * filter acts like equipment typed in the query ("db", D4), and equipment the
 * query names wins over it. Only where the movement's versions differ on
 * equipment; elsewhere it would preselect nothing and only stop the last-used
 * version from applying (`initialSheet`).
 */
export function withFilterPreselect(movement: Movement, preselect: VersionPick, filters: PickerFilters): VersionPick {
  if (!filters.equipment || preselect.equipment) return preselect;
  if (movement.versions.every((v) => v.equipment === movement.versions[0].equipment)) return preselect;
  return { ...preselect, equipment: filters.equipment };
}
