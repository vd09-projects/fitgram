// src/utils/unitChange.ts
//
// What the Units sheet (TICKET-091) shows and says, as pure functions so the
// wording and the matching can be tested without a screen. The store action
// that applies a change is `setExerciseUnits`; nothing here converts a number.

import { unitSpec, unitsForRole, type FieldUnit } from "../constants/units";
import type { ExerciseSet } from "../types/zustandWorkoutType";
import type { ExerciseHistory } from "../types/exerciseHistory";
import type { ExerciseField } from "../types/workoutType";
import { setValuesText } from "./setDeltas";
import { comparisonSegment, plannedSegment } from "./storedSets";

/** Can the user pick a unit for this field? It has one, and its role offers a choice. */
export const hasUnitChoice = (field: ExerciseField): boolean =>
  field.unit !== undefined && unitsForRole(field.role).length > 0;

/**
 * The field last time that stands for `fields[index]`: the same role, at the
 * same position among that role's fields. Never matched by name: names are
 * user-authored ("Load" in one catalog entry, "Weight" in another), roles are
 * declared (`exerciseFields.ts`). `null` when last time had no such field.
 */
export function matchLastField(
  fields: ExerciseField[],
  index: number,
  lastFields: ExerciseField[] | undefined | null
): ExerciseField | null {
  const field = fields[index];
  if (!field || !lastFields) return null;
  const position = fields.slice(0, index).filter((f) => f.role === field.role).length;
  return lastFields.filter((f) => f.role === field.role)[position] ?? null;
}

/** One block of the Units sheet: a field, its chips, and last time's unit for it. */
export type UnitBlock = {
  /** The field's name; the key `setExerciseUnits` takes. */
  name: string;
  unit: FieldUnit;
  /** Chip order, from `constants/units.ts`. */
  options: FieldUnit[];
  /** Last time's unit for the matching field, or `null` (no session, or no such field). */
  lastUnit: string | null;
  /** The selected unit's hint, if it has one. */
  hint: string | null;
};

/** One block per field the user can change the unit of, in field order. Reps never gets one. */
export function unitBlocks(fields: ExerciseField[], lastFields: ExerciseField[] | undefined | null): UnitBlock[] {
  return fields.flatMap((field, index) =>
    hasUnitChoice(field)
      ? [
          {
            name: field.name,
            unit: field.unit as FieldUnit,
            options: unitsForRole(field.role),
            lastUnit: matchLastField(fields, index, lastFields)?.unit ?? null,
            hint: unitSpec(field.unit)?.hint ?? null,
          },
        ]
      : []
  );
}

/** The menu item's summary, "Weight kg · Distance m", in field order; `null` with nothing to change. */
export function unitsSummary(fields: ExerciseField[]): string | null {
  const parts = fields.filter(hasUnitChoice).map((field) => `${field.name} ${field.unit}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * The line the sheet shows once a set is logged, before the tap (board
 * UnitSheetLogged): the count of today's sets a new unit relabels, and one
 * example of the first logged set, "8 plates × 15" becoming "8 kg × 15".
 *
 * The example's new unit is last time's when that differs from today's (the
 * change the notice offers), otherwise the first other chip. It is only an
 * example: the numbers stay as typed for any unit chosen. `null` with no sets.
 * The example comes from the first block's field; a second unit field is
 * relabelled the same way and needs no second example.
 */
export function relabelLine(
  fields: ExerciseField[],
  lastFields: ExerciseField[] | undefined | null,
  sets: ExerciseSet[]
): { count: number; before: string; after: string } | null {
  if (sets.length === 0) return null;
  const [block] = unitBlocks(fields, lastFields);
  if (!block) return null;
  const target =
    block.options.find((unit) => unit === block.lastUnit && unit !== block.unit) ??
    block.options.find((unit) => unit !== block.unit);
  if (!target) return null;
  const values = plannedSegment(sets[0]);
  const relabelled = fields.map((field) => (field.name === block.name ? { ...field, unit: target } : field));
  return {
    count: sets.length,
    before: setValuesText(fields, values),
    after: setValuesText(relabelled, values),
  };
}

/** The mismatch notice and what its button applies (TICKET-091, boards UnitNotice, UnitCarryCard). */
export type UnitMismatch = {
  /** Last time's unit for each field that differs, keyed by today's field name: `setExerciseUnits`' argument. */
  units: Record<string, FieldUnit>;
  /** "Use plates"; "Use last time's units" when two or more differ. */
  buttonLabel: string;
  /** The line the card shows in place of "no targets": what last time was in, with its numbers. */
  notice: string;
};

/**
 * Which of today's fields are in another unit than last session's, and what
 * applying last time's would be. Fields are matched by role and position, never
 * by name (`matchLastField`), and only a unit field the user can change is
 * looked at: reps and unitless fields are ignored. A field whose last unit is
 * missing, or not one its role offers, counts as no difference: there is
 * nothing to apply, and the app does not guess one. `null` for no last session,
 * or nothing differing.
 *
 * Decided here, not by `resolveGhostTarget`/`ghostNotice`: they judge a weight
 * and reps pair only, and an exercise with no reps (Farmer's Walk: weight and
 * distance) has none, though its unit can differ as much as Bench Press's.
 * Only the last session is read, as for the ghosts. `setNumber` picks which of
 * its sets the notice quotes; a session that stopped earlier quotes none, as
 * `ghostNotice` does, rather than another set's numbers.
 */
export function unitMismatch(
  fields: ExerciseField[],
  history: Pick<ExerciseHistory, "lastSession">,
  setNumber: number
): UnitMismatch | null {
  const last = history.lastSession;
  if (!last) return null;

  const units: Record<string, FieldUnit> = {};
  const differing: ExerciseField[] = [];
  fields.forEach((field, index) => {
    if (!hasUnitChoice(field)) return;
    const unit = matchLastField(fields, index, last.fields)?.unit;
    if (unit === undefined || unit === field.unit || !unitsForRole(field.role).includes(unit)) return;
    units[field.name] = unit;
    differing.push(field);
  });
  if (differing.length === 0) return null;

  const lastSet = last.sets[setNumber - 1];
  const numbers = lastSet ? ` (${setValuesText(last.fields, comparisonSegment(lastSet))})` : "";
  // A field is named only where the exercise has more than one to tell apart.
  const several = fields.filter(hasUnitChoice).length > 1;
  const what =
    differing.length > 1
      ? "Last time used different units"
      : `Last time ${several ? `${differing[0].name.toLowerCase()} ` : ""}was in ${units[differing[0].name]}`;

  return {
    units,
    buttonLabel: differing.length > 1 ? "Use last time's units" : `Use ${units[differing[0].name]}`,
    notice: `${what}${numbers}`,
  };
}
