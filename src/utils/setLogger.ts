// src/utils/setLogger.ts
//
// The derived values behind the set logger card: what each field's ghost target
// is, why there is none when there is none, what a stepper tap writes, and which
// fields still need a value before a set can be logged. Kept pure so the maths
// is tested directly rather than judged off a screen. Tests: setLogger.test.ts,
// next to this file.

import { ExerciseHistory, HistorySet } from "../types/exerciseHistory";
import { ExerciseField } from "../types/workoutType";
import { unitSpec } from "../constants/units";
import {
  NumericFieldMap,
  parseNumericValue,
  parseSet,
  resolveNumericFields,
  withUnit,
} from "./exerciseFields";

/**
 * Stepper increment for a field, by declared role — never by name.
 *
 * - reps: 1.
 * - a field with a unit: that unit's `step` in `constants/units.ts` (2.5 kg,
 *   5 lb, 1 plate; none for time and distance), when the unit belongs to the
 *   field's role.
 * - anything else, and a weight field with no unit: `null`, meaning no stepper.
 *   A unitless weight could be either scale, and 2.5 is a different jump on
 *   each. Rejected: a default of 1 for all of them, which is a guessed step
 *   dressed as a real one.
 */
export function stepSizeFor(field: ExerciseField): number | null {
  if (field.role === "reps") return 1;
  const spec = unitSpec(field.unit);
  return spec && spec.role === field.role ? spec.step : null;
}

/**
 * Write a stepped number back as the string a field holds. Rounded to 3
 * decimals so repeated float addition cannot surface as `64.80000000000001`;
 * `String` then drops trailing zeros, so 60 reads "60", not "60.000".
 */
export function formatStepValue(value: number): string {
  return String(Number(value.toFixed(3)));
}

/**
 * The value a stepper tap writes, or `null` when the tap cannot step.
 *
 * Parse, step, write back as a string, since `ExerciseSet.fields` holds strings.
 *
 * An empty field steps from its ghost when there is one: with last time at 60,
 * `+` gives 62.5 and `-` gives 57.5. The ghost is the reference the user is
 * adjusting against. Taking exactly the ghost is the repeat control's job, not
 * the stepper's. With no ghost an empty field steps up from 0 (one tap of `+`
 * on reps is 1), and `-` cannot step.
 *
 * `null` — the caller disables the button — when:
 * - the field has no step size (see `stepSizeFor`);
 * - the typed text does not parse. Rejected: treating "abc" as 0, which would
 *   replace what the user typed with a plausible number;
 * - the result would go below 0. Clamping to "0" instead would write a value
 *   the user never chose, and for an empty field claim a set of nothing.
 */
export function stepFieldValue(
  field: ExerciseField,
  current: string,
  direction: 1 | -1,
  ghost: number | null
): string | null {
  const step = stepSizeFor(field);
  if (step === null) return null;

  const base = current.trim() === "" ? ghost ?? 0 : parseNumericValue(current);
  if (base === null) return null;

  const next = base + direction * step;
  if (next < 0) return null;
  return formatStepValue(next);
}

/**
 * Why the card has, or does not have, ghost targets for the set about to be
 * logged. Every case renders and every case can log a set; only `available`
 * carries numbers.
 *
 * - `notLoaded` — history never prefetched, still loading, or failed with
 *   nothing cached. Not "first time": we do not know.
 * - `firstTime` — fetched, and this exercise has never been done.
 * - `noComparison` — no weight+reps pair (a plank), so no numbers to target.
 * - `unitChanged` — last session used another weight unit. Units are never
 *   converted, so its numbers are not shown as targets. It carries last time's
 *   unit and its set at this number, parsed in that session's own fields, so
 *   the notice can say "Last time was in kg (40 kg × 12)" (TICKET-044).
 *   `lastUnit` is null when last time had no unit or no weight+reps pair;
 *   `lastSet` is null when that session stopped earlier or the set did not
 *   parse. Either null drops the detail, never shows a guessed number.
 * - `setNotReached` — last session stopped before this set number.
 * - `available` — `set` is last session's set at this number.
 *
 * `unitChanged` is decided by `lastSession.comparable`, deliberately NOT by
 * `history.unitMismatch`. That flag is true when *any* session in the window
 * mismatched, so a kg session three sessions back would hide a perfectly good
 * ghost from last week's kg session. Ghosts come from the last session only, so
 * that session's own comparability is the one that matters.
 */
export type GhostTarget =
  | { kind: "notLoaded" }
  | { kind: "firstTime" }
  | { kind: "noComparison" }
  | {
      kind: "unitChanged";
      lastUnit: string | null;
      lastSet: { weight: number; reps: number } | null;
    }
  | { kind: "setNotReached"; lastSessionSetCount: number }
  | { kind: "available"; set: HistorySet };

export function resolveGhostTarget(
  history: Pick<
    ExerciseHistory,
    "status" | "hasHistory" | "numericComparisonAvailable" | "lastSession" | "setAt"
  >,
  setNumber: number
): GhostTarget {
  if (history.status !== "ready") return { kind: "notLoaded" };
  if (!history.hasHistory || !history.lastSession) return { kind: "firstTime" };
  if (!history.numericComparisonAvailable) return { kind: "noComparison" };
  if (!history.lastSession.comparable) {
    // `HistorySet.weight` is null on an incomparable session by design, so the
    // numbers are parsed here from the session's own fields, for the notice only.
    const own = resolveNumericFields(history.lastSession.fields);
    const { weight, reps } = parseSet(history.lastSession.sets[setNumber - 1]?.segments[0], own);
    return {
      kind: "unitChanged",
      lastUnit: own?.weight.unit ?? null,
      lastSet: weight !== null && reps !== null ? { weight, reps } : null,
    };
  }

  const set = history.setAt(setNumber);
  if (!set) {
    return { kind: "setNotReached", lastSessionSetCount: history.lastSession.sets.length };
  }
  return { kind: "available", set };
}

/**
 * Ghost number per field name, `null` where a field has none.
 *
 * Only the resolved weight and reps fields get a ghost, read from the already
 * parsed `HistorySet.weight` / `.reps`. Every other field — time, distance,
 * other, or a second field sharing the weight role — gets `null`, even though
 * the raw value is in `HistorySet.fields`. Ghosting raw values would put
 * unparsed, unit-unchecked text in a field styled as a target number.
 */
export function ghostValues(
  fields: ExerciseField[],
  target: GhostTarget,
  numeric: NumericFieldMap | null
): Record<string, number | null> {
  const ghosts: Record<string, number | null> = {};
  for (const field of fields) {
    ghosts[field.name] = null;
    if (target.kind !== "available" || !numeric) continue;
    if (field.name === numeric.weight.name) ghosts[field.name] = target.set.weight;
    if (field.name === numeric.reps.name) ghosts[field.name] = target.set.reps;
  }
  return ghosts;
}

/**
 * What the repeat control fills: every field that has a ghost, written as the
 * string a field holds. Fields without one are left absent, not set to "" —
 * the caller merges this over current input, so a value already typed there
 * survives. `null` when no field has a ghost, which disables the control.
 */
export function repeatValues(
  ghosts: Record<string, number | null>
): Record<string, string> | null {
  const filled: Record<string, string> = {};
  for (const [name, ghost] of Object.entries(ghosts)) {
    if (ghost !== null) filled[name] = formatStepValue(ghost);
  }
  return Object.keys(filled).length > 0 ? filled : null;
}

/**
 * Names of the fields that still need a value, in definition order. A set logs
 * only when this is empty.
 *
 * "Missing" means blank after trimming. An untouched field is missing even when
 * it shows a ghost: the ghost is a placeholder, not a value, and logging it on
 * a stray tap would record a set the user never did. Accepting the target is
 * the repeat control, which is explicit.
 *
 * Fields with role `other` are optional and never missing: they hold notes,
 * RPE, a band colour — things a set is complete without. Every measured role
 * (weight, reps, time, distance) is required.
 */
export function missingFields(
  fields: ExerciseField[],
  values: Record<string, string>
): string[] {
  return fields
    .filter((field) => field.role !== "other")
    .filter((field) => (values[field.name] ?? "").trim() === "")
    .map((field) => field.name);
}

/** "Weight", "Weight and Reps", "Weight, Reps and Time". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * What the card's button does: log a new set, or save an edit to a logged one
 * (TICKET-040). Only the wording of a refusal differs; the rules are the same.
 */
export type SetAction = "log" | "save";

/** What a refused Log set / Save set tap says. Names every missing field. */
export function missingFieldsMessage(missing: string[], setNumber: number, action: SetAction): string {
  return `Enter ${joinNames(missing)} to ${action} set ${setNumber}`;
}

export type SetFieldsResult =
  | { kind: "ok"; fields: Record<string, string> }
  | { kind: "refused"; message: string };

/**
 * The fields a Log set or Save set tap stores, or why it is refused. One
 * function for both paths (TICKET-040), so an edit cannot store a set that
 * logging would have refused.
 *
 * - A required field left blank refuses, naming every such field
 *   (`missingFields`).
 * - Values are trimmed. A blank optional field is left out, not stored as "".
 *   The result is the set's whole field record: `updateSet` replaces, so an edit
 *   that blanks an optional field clears it.
 * - Nothing at all refuses: only reachable when every field is optional, and an
 *   empty set is a record of nothing.
 * - Only the exercise's own fields are read, in definition order.
 */
export function buildSetFields(
  fields: ExerciseField[],
  values: Record<string, string>,
  setNumber: number,
  action: SetAction
): SetFieldsResult {
  const missing = missingFields(fields, values);
  if (missing.length > 0) return { kind: "refused", message: missingFieldsMessage(missing, setNumber, action) };

  const stored: Record<string, string> = {};
  for (const field of fields) {
    const value = (values[field.name] ?? "").trim();
    if (value !== "") stored[field.name] = value;
  }
  if (Object.keys(stored).length === 0) {
    return { kind: "refused", message: `Enter a value to ${action} set ${setNumber}` };
  }
  return { kind: "ok", fields: stored };
}

/**
 * The record an edit stores: the fields `buildSetFields` built, plus any stored
 * key the exercise no longer defines, kept as it was.
 *
 * `buildSetFields` reads only defined fields and `updateSet` replaces, so
 * without this a Save would silently drop such a key. Unreachable today (a
 * running workout's fields do not change), but an edit should change only what
 * the card showed. Rejected: merging in `updateSet`, which would make clearing
 * an optional field impossible.
 */
export function withUnlistedFields(
  fields: ExerciseField[],
  stored: Record<string, string | number>,
  built: Record<string, string>
): Record<string, string> {
  const listed = new Set(fields.map((field) => field.name));
  const kept: Record<string, string> = {};
  for (const [name, value] of Object.entries(stored)) {
    if (!listed.has(name)) kept[name] = String(value);
  }
  return { ...kept, ...built };
}

/**
 * One logged segment's values as the card's inputs hold them, to prefill an
 * edit. Stored values may be numbers (older sets, test fixtures); inputs are
 * strings.
 */
export function editInputValues(segment: Record<string, string | number>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of Object.entries(segment)) values[name] = String(value);
  return values;
}

/**
 * The "Last time" pill's numbers, `65 × 8`, or `null` when either side did not
 * parse last time — the pill then is not shown, rather than reading `65 × —`.
 */
export function lastTimeText(target: GhostTarget): string | null {
  if (target.kind !== "available") return null;
  const { weight, reps } = target.set;
  if (weight === null || reps === null) return null;
  return `${formatStepValue(weight)} × ${formatStepValue(reps)}`;
}

/**
 * The line shown in place of ghost targets, saying why there are none.
 * `null` when targets are available. `status` splits `notLoaded`, which covers
 * three different situations a user would want told apart.
 */
export function ghostNotice(
  target: GhostTarget,
  status: ExerciseHistory["status"]
): string | null {
  switch (target.kind) {
    case "available":
      return null;
    case "notLoaded":
      if (status === "loading") return "Loading last session…";
      if (status === "error") return "Couldn't load last session";
      return "Last session not loaded";
    case "firstTime":
      return "First time on this exercise";
    case "noComparison":
      return "No weight and reps to target";
    case "unitChanged": {
      if (!target.lastUnit) return "Last time used a different unit, so no targets";
      const numbers = target.lastSet
        ? ` (${withUnit(formatStepValue(target.lastSet.weight), target.lastUnit)} × ${formatStepValue(
            target.lastSet.reps
          )})`
        : "";
      return `Last time was in ${target.lastUnit}${numbers}, so no targets`;
    }
    case "setNotReached":
      return `Last time stopped at ${target.lastSessionSetCount} ${
        target.lastSessionSetCount === 1 ? "set" : "sets"
      }`;
  }
}
