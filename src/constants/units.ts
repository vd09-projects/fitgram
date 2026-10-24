// src/constants/units.ts
//
// Every unit a field can carry, and everything the app knows about each one.
// The single place to add or change a unit: the `FieldUnit` type, the unit
// chips in Manage Workout, the stepper and the "1 plate" wording all read this
// table, so a new unit is one entry here and nothing else.
//
// Units are for comparability, never conversion: two sessions compare only
// when the unit matches exactly (`areFieldsComparable`), so nothing here says
// how one unit relates to another.

import type { FieldRole } from "../types/workoutType";

type UnitSpec = {
  /** The role whose unit chips offer this unit. */
  role: FieldRole;
  /**
   * What one stepper tap adds, or `null` for no stepper. A guessed step is
   * worse than none: time and distance have no natural increment.
   */
  step: number | null;
  /** The word after exactly 1, when the unit is a word ("1 plate"). Symbols omit it. */
  singular?: string;
  /** One line under the unit chips while this unit is selected. */
  hint?: string;
};

/**
 * Keys are what Firestore stores in `ExerciseField.unit`: never rename one, or
 * every field saved with it stops matching. Order within a role is the order
 * of the chips.
 */
const UNIT_SPECS = {
  // One plate pair's worth: two 1.25 kg or two 2.5 lb plates, so a tap moves
  // to the next loadable bar weight.
  kg: { role: "weight", step: 2.5 },
  lb: { role: "weight", step: 5 },
  // TICKET-044. Plates or the pin number on a machine stack whose real weight
  // is unknown. One tap is one plate; a half plate (4.5) can still be typed.
  plates: {
    role: "weight",
    step: 1,
    singular: "plate",
    hint: "Plates or pin number on the stack. Never turned into kg; compares only with plates.",
  },
  s: { role: "time", step: null },
  min: { role: "time", step: null },
  m: { role: "distance", step: null },
  km: { role: "distance", step: null },
} as const satisfies Record<string, UnitSpec>;

/**
 * Unit of a numeric field. The typed value is the whole load: the app never
 * adds a bar weight to it, or to any weight.
 */
export type FieldUnit = keyof typeof UNIT_SPECS;

/**
 * The spec for a unit, or `null` for an unknown one. Takes a plain string
 * because units also arrive untyped (`BestSet.unit`, a stored doc), and the
 * own-property check keeps "toString" from reading as a unit.
 */
export function unitSpec(unit: string | null | undefined): UnitSpec | null {
  if (!unit || !Object.prototype.hasOwnProperty.call(UNIT_SPECS, unit)) return null;
  return UNIT_SPECS[unit as FieldUnit];
}

/** Units offered for a role, in chip order. Empty for a role with no unit. */
export function unitsForRole(role: FieldRole): FieldUnit[] {
  return (Object.keys(UNIT_SPECS) as FieldUnit[]).filter((unit) => UNIT_SPECS[unit].role === role);
}
