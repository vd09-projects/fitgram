// TICKET-043 stage 3: the version sheet's logic, on the real catalog (the
// three versions with no default are real ones).

import { CATALOG } from "../catalog";
import type { Movement } from "../types/catalog";
import { AXES, axisValue, chooseOption, initialSheet, selectedVersion, sheetRows, type Axis, type SheetState } from "./versionSheet";

const movement = (id: string): Movement => CATALOG.find((m) => m.id === id)!;
const NONE = new Set<string>();

/** Tap each value in turn, failing if the option is missing or disabled. */
function tap(m: Movement, state: SheetState, taps: Array<[Axis, string]>, inPlan: ReadonlySet<string> = NONE) {
  for (const [axis, value] of taps) {
    const option = sheetRows(m, state, inPlan).find((r) => r.axis === axis)?.options.find((o) => o.value === value);
    if (!option?.enabled) throw new Error(`${m.id}: ${axis}=${value} is not an enabled option`);
    state = chooseOption(m, state, axis, value, inPlan);
  }
  return state;
}
const option = (m: Movement, s: SheetState, axis: Axis, value: string, inPlan: ReadonlySet<string> = NONE) =>
  sheetRows(m, s, inPlan).find((r) => r.axis === axis)?.options.find((o) => o.value === value);

test("every version can be added by tapping enabled options, and lands on itself", () => {
  for (const m of CATALOG.filter((x) => x.versions.length > 1)) {
    for (const v of m.versions) {
      let s = initialSheet(m, {}, NONE);
      const shown = sheetRows(m, s, NONE).map((r) => r.axis);
      // Equipment first (it reveals Attachment), then the rest in row order.
      const order = AXES.filter((a) => a === "equipment" || shown.includes(a) || a === "attachment");
      for (const axis of order) {
        const row = sheetRows(m, s, NONE).find((r) => r.axis === axis);
        if (row && s.values[axis] !== axisValue(v, axis)) s = tap(m, s, [[axis, axisValue(v, axis)]]);
      }
      expect([m.id, selectedVersion(m, s, NONE)?.id]).toEqual([m.id, v.id]);
    }
  }
});

test("the three versions with no default: the axis moves to the only valid value", () => {
  const bench = movement("bench_press");
  const ez = tap(bench, initialSheet(bench, {}, NONE), [["equipment", "ez_bar"]]);
  expect(ez.values.grip).toBe("close");
  expect(option(bench, ez, "grip", "normal")?.enabled).toBe(false);
  expect(selectedVersion(bench, ez, NONE)?.id).toBe("bench_press__ez_bar__close_grip");

  const situp = movement("sit_up");
  const plate = tap(situp, initialSheet(situp, {}, NONE), [["equipment", "weight_plate"]]);
  expect(selectedVersion(situp, plate, NONE)?.id).toBe("sit_up__weight_plate__decline");

  const pushdown = movement("triceps_pushdown");
  const cable = tap(pushdown, initialSheet(pushdown, {}, NONE), [["equipment", "cable"]]);
  expect(cable.values.attachment).toBeUndefined(); // several: stays empty
  expect(option(pushdown, cable, "attachment", "rope")?.enabled).toBe(true);
  const reverse = tap(pushdown, cable, [["grip", "reverse"]]);
  expect(selectedVersion(pushdown, reverse, NONE)?.id).toBe("triceps_pushdown__cable__reverse_grip");
  expect(option(pushdown, reverse, "attachment", "rope")?.enabled).toBe(false);
  // No attachment: soft axes settle on a combination that exists (Cable, None,
  // Normal, Both is none), the one-arm version.
  const none = tap(pushdown, cable, [["attachment", "none"]]);
  expect(selectedVersion(pushdown, none, NONE)?.id).toBe("triceps_pushdown__cable__one_side");
});

test("opens with Equipment empty and defaults elsewhere; a query preselects; Attachment only for cable", () => {
  const bench = movement("bench_press");
  const plain = initialSheet(bench, {}, NONE);
  expect(plain.values).toMatchObject({ angle: "flat", grip: "normal", side: "both" });
  expect(plain.values.equipment).toBeUndefined();
  expect(selectedVersion(bench, plain, NONE)).toBeNull();

  const typed = initialSheet(bench, { equipment: "dumbbell", angle: "incline" }, NONE);
  expect(selectedVersion(bench, typed, NONE)?.id).toBe("bench_press__dumbbell__incline");

  const pushdown = movement("triceps_pushdown");
  const rows = (s: SheetState) => sheetRows(pushdown, s, NONE).map((r) => r.axis);
  expect(rows(initialSheet(pushdown, {}, NONE))).not.toContain("attachment");
  expect(rows(initialSheet(pushdown, { equipment: "cable" }, NONE))).toContain("attachment");
  expect(rows(initialSheet(pushdown, { equipment: "band" }, NONE))).not.toContain("attachment");
});

test("disabled, not hidden: a combination that does not exist, and one already in the plan", () => {
  const bench = movement("bench_press");
  const band = tap(bench, initialSheet(bench, {}, NONE), [["equipment", "band"]]);
  expect(option(bench, band, "angle", "incline")).toEqual({ value: "incline", label: "Incline", enabled: false });

  const inPlan = new Set(["bench_press__dumbbell__incline"]);
  const db = tap(bench, initialSheet(bench, {}, inPlan), [["equipment", "dumbbell"]], inPlan);
  expect(option(bench, db, "angle", "incline", inPlan)?.enabled).toBe(false);
  // Even preselected by the query, it is not addable.
  expect(selectedVersion(bench, initialSheet(bench, { equipment: "dumbbell", angle: "incline" }, inPlan), inPlan)).toBeNull();
});

test("switching equipment starts soft axes from their default again, not from the last forced value", () => {
  const bench = movement("bench_press");
  const barbell = tap(bench, initialSheet(bench, {}, NONE), [["equipment", "ez_bar"], ["equipment", "barbell"]]);
  expect(selectedVersion(bench, barbell, NONE)?.id).toBe("bench_press__barbell");

  const raise = movement("front_raise");
  const cable = tap(raise, initialSheet(raise, {}, NONE), [["equipment", "dumbbell"], ["equipment", "cable"]]);
  expect(cable.values.attachment).toBeUndefined();
});
