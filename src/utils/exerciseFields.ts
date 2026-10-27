// src/utils/exerciseFields.ts
//
// Field semantics by declared role. `ExerciseField.role` is set when the
// exercise is defined, so nothing here infers meaning from a field's name.

import { ExerciseField, FieldRole } from "../types/workoutType";
import { unitSpec, unitsForRole } from "../constants/units";

/**
 * One logged set's values, keyed by `ExerciseField.name`. Structurally the same
 * as `StoredSetFields`; spelled out here so these field helpers do not depend on
 * the storage layer.
 */
type SetValues = Record<string, string | number>;

/** The pair every numeric comparison needs. */
export type NumericFieldMap = {
  weight: ExerciseField;
  reps: ExerciseField;
};

/**
 * Coerce a legacy `string[]` field list into `ExerciseField[]`.
 *
 * Plans, catalog docs and in-progress workouts written before roles existed
 * stored bare names. They are live configuration, not history, so they cannot
 * simply be abandoned — read raw, they would render inputs named `undefined`.
 * A legacy name becomes role `"other"`, which means the exercise reports no
 * numeric comparison until the user assigns roles in Manage Workout. That is
 * the honest degradation: no numbers rather than wrong ones.
 *
 * Remove this once nothing carries string fields.
 */
export function normalizeExerciseFields(fields: unknown): ExerciseField[] {
  if (!Array.isArray(fields)) return [];
  return fields.map((field) =>
    typeof field === "string"
      ? { name: field, role: "other" as const }
      : (field as ExerciseField)
  );
}

/**
 * A field with `patch` applied. On a role change the unit survives only if the
 * new role offers it: weight → time used to keep `kg` (TICKET-051 D6), because
 * the unit was dropped only when the new role had no units at all. Only on a
 * role change: the catalog's assisted-machine "Assistance" is role `other`
 * with `kg`, and renaming it must not drop the unit. Any other key of the
 * field (a draft's `savedName`) is carried through.
 */
export function patchField<F extends ExerciseField>(field: F, patch: Partial<ExerciseField>): F {
  const next: F = { ...field, ...patch };
  const roleChanged = patch.role !== undefined && patch.role !== field.role;
  if (roleChanged && next.unit !== undefined && !unitsForRole(next.role).includes(next.unit)) delete next.unit;
  return next;
}

export const findFieldByRole = (
  fields: ExerciseField[] | undefined | null,
  role: FieldRole
): ExerciseField | null => fields?.find((f) => f.role === role) ?? null;

export const fieldNames = (fields: ExerciseField[] | undefined | null): string[] =>
  (fields ?? []).map((f) => f.name);

/**
 * Resolve the weight/reps pair, or null when this exercise has no such pair —
 * a plank with `time` + `other` fields, for instance. Null is a first-class
 * answer: sessions still render, every derived number is reported unavailable.
 *
 * The first field of each role wins. A second field with the same role is a
 * definition mistake, not something to disambiguate here.
 */
export function resolveNumericFields(
  fields: ExerciseField[] | undefined | null
): NumericFieldMap | null {
  const weight = findFieldByRole(fields, "weight");
  const reps = findFieldByRole(fields, "reps");
  if (!weight || !reps) return null;
  if (weight.name === reps.name) return null;
  return { weight, reps };
}

/**
 * Are two sessions' numbers comparable?
 *
 * Only when the weight unit matches exactly. Cross-workout history makes this
 * reachable: bench press can be defined with `kg` in one workout and `lb` in
 * another, and 80 lb is not an improvement on 70 kg. Units are deliberately
 * NOT converted — converting would silently redraw numbers the user typed.
 * Mismatch is reported so a consumer can say so and omit the comparison.
 *
 * Both units absent counts as matching: unspecified-but-consistent.
 */
export function areFieldsComparable(
  a: ExerciseField[] | undefined | null,
  b: ExerciseField[] | undefined | null
): boolean {
  const left = resolveNumericFields(a);
  const right = resolveNumericFields(b);
  if (!left || !right) return false;
  return left.weight.unit === right.weight.unit;
}

/**
 * The unit as written after `magnitude`: the unit's `singular` for exactly 1
 * ("1 plate"), otherwise the unit unchanged. `magnitude` is the number as
 * displayed, without a sign, so "+1 plate" and "1 plate" both come out singular.
 *
 * Symbols (kg, lb, s…) have no `singular` in `constants/units.ts` and never
 * change. Singular is exactly "1": 0.5 and 0 read "plates", as in English, and
 * the formatters never write "1.0".
 */
export function unitLabel(magnitude: string, unit: string): string {
  if (magnitude !== "1") return unit;
  return unitSpec(unit)?.singular ?? unit;
}

/**
 * A number with its unit, "60 kg", "5 plates", "1 plate", or the number alone
 * when there is no unit. The one place a unit is attached to a value, so the
 * plural rule lives here and not in each text helper.
 */
export function withUnit(magnitude: string, unit: string | null | undefined): string {
  return unit ? `${magnitude} ${unitLabel(magnitude, unit)}` : magnitude;
}

/**
 * Parse a logged value into a number, or null.
 *
 * Takes `unknown` on purpose: set values are written straight through from the
 * live `Record<string, string | number>`, so the runtime value may be a number,
 * a numeric string, an empty string, or absent regardless of the declared type.
 * Negatives are unparseable — a negative weight or rep count is corrupt data,
 * not a measurement — so they never reach arithmetic.
 */
export function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed === "") return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** Weight and reps for one stored set, or nulls when either does not parse. */
export function parseSet(
  set: SetValues | undefined,
  numeric: NumericFieldMap | null
): { weight: number | null; reps: number | null } {
  if (!numeric || !set) return { weight: null, reps: null };
  return {
    weight: parseNumericValue(set[numeric.weight.name]),
    reps: parseNumericValue(set[numeric.reps.name]),
  };
}
