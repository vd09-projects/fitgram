// TICKET-050 stage 1: the filter menus, on the real catalog.

import { CATALOG } from "../catalog";
import type { Exercise } from "../types/workoutType";
import { searchExercises } from "./exerciseSearch";
import { matchesFilters, preparePicker, withFilterPreselect, type PickerFilters } from "./pickerData";

const custom: Exercise = { id: "custom_1", name: "Chest Thing", fields: [] };
const { catalog, alphabetical, equipmentByUse } = preparePicker(CATALOG, null, [custom]);
const ids = (filters: PickerFilters) => alphabetical.filter((r) => r.kind === "movement" && matchesFilters(r.movement, filters)).map((r) => r.key);

test("Chest + Dumbbell: primary muscles only, every menu ANDed, and with a query", () => {
  const chestDb = ids({ group: "chest", equipment: "dumbbell" });
  expect(chestDb).toEqual(expect.arrayContaining(["bench_press", "chest_fly", "floor_press"]));
  // Overhead Press has chest as a secondary muscle only: not under Chest.
  expect(chestDb).not.toContain("overhead_press");
  expect(chestDb).not.toContain("cable_crossover"); // chest, no dumbbell version
  expect(ids({ group: "chest", equipment: "dumbbell", category: "stretching" })).toEqual([]);

  // A query ANDs with them, filtered before the limit; custom exercises drop out.
  const keep = (m: (typeof CATALOG)[number]) => matchesFilters(m, { group: "chest", equipment: "dumbbell" });
  const found = searchExercises(catalog, "press", 1, keep);
  expect(found.results.map((r) => r.kind === "movement" && r.movement.id)).toEqual(["bench_press"]);
  expect(found.total).toBe(searchExercises(catalog, "press", 100, keep).results.length);
  expect(searchExercises(catalog, "chest thing", 100).results.some((r) => r.kind === "custom")).toBe(true);
  expect(searchExercises(catalog, "chest thing", 100, keep).results.some((r) => r.kind === "custom")).toBe(false);
});

test("Equipment menu lists what the catalog uses, most movements first; the filter preselects it", () => {
  expect(equipmentByUse.slice(0, 3)).toEqual(["bodyweight", "dumbbell", "barbell"]);
  expect(new Set(equipmentByUse).size).toBe(new Set(CATALOG.flatMap((m) => m.versions.map((v) => v.equipment))).size);

  const bench = CATALOG.find((m) => m.id === "bench_press")!;
  expect(withFilterPreselect(bench, {}, { equipment: "dumbbell" })).toEqual({ equipment: "dumbbell" });
  // Equipment typed in the query wins over the menu.
  expect(withFilterPreselect(bench, { equipment: "barbell" }, { equipment: "dumbbell" })).toEqual({ equipment: "barbell" });
});
