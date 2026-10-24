// src/utils/catalog.ts
//
// Pure functions over the exercise catalog (TICKET-042): the version id rule,
// the display name, the lookup a name site uses, and the loader that refuses a
// malformed catalog. Nothing here reads Firestore or the app's stores.

import {
  ANGLES,
  ATTACHMENTS,
  CATEGORIES,
  EQUIPMENT,
  GRIPS,
  MEASURES,
  MUSCLES,
  ONE_SIDE_LABELS,
  PATTERNS,
} from "../constants/catalogVocabulary";
import { unitSpec } from "../constants/units";
import type { Movement, MovementVersion } from "../types/catalog";
import type { FieldRole } from "../types/workoutType";

/** The axes that make up a version id. A subset of `MovementVersion`. */
type VersionAxes = Pick<MovementVersion, "equipment" | "angle" | "attachment" | "grip" | "unilateral">;

/**
 * The version id rule:
 * `{movement}__{equipment}[__{angle}][__{attachment}][__{grip}_grip][__one_side]`.
 *
 * Parts in that fixed order, defaults left out (flat, no attachment, normal
 * grip, both sides), so adding an axis later leaves every existing id valid.
 * One arm and one leg share `__one_side`: one rule, not a per-movement choice.
 *
 * USED TO CHECK IDS, NEVER TO MAKE THEM AT RUNTIME. The catalog stores each id
 * as a literal and the loader compares it with this; deriving ids on the fly
 * would let a change to this function silently re-key every history.
 */
export function buildVersionId(movementId: string, axes: VersionAxes): string {
  const parts = [movementId, axes.equipment];
  if (axes.angle) parts.push(axes.angle);
  if (axes.attachment) parts.push(axes.attachment);
  if (axes.grip) parts.push(`${axes.grip}_grip`);
  if (axes.unilateral) parts.push("one_side");
  return parts.join("__");
}

/**
 * "Bench Press · Dumbbell, incline". The format chosen on TICKET-041 board B1:
 * movement, then the version's parts, first part capitalised.
 *
 * Which parts show:
 * - a movement with one version shows its name only ("Pec Deck (Machine Fly)")
 * - equipment shows only when the movement's versions differ in it. So every
 *   Triceps Pushdown is cable and reads "Triceps Pushdown · Rope". Rejected:
 *   "an attachment implies cable", a special case for one axis. Cost: adding a
 *   band pushdown later renames the rope one to "Cable, rope", which is wanted
 *   (names are built, so they follow the catalog; ids do not move)
 * - angle, attachment, grip and one side show whenever they are not the
 *   default; defaults never show ("flat", "normal grip")
 *
 * Within one movement no two versions get the same name: ids are unique, so
 * some axis differs, and that axis is shown by the rules above.
 */
export function buildVersionName(movement: Movement, version: MovementVersion): string {
  if (movement.versions.length <= 1) return movement.name;

  const parts: string[] = [];
  const equipmentVaries = movement.versions.some((v) => v.equipment !== version.equipment);
  if (equipmentVaries) parts.push(EQUIPMENT[version.equipment]);
  if (version.angle) parts.push(ANGLES[version.angle]);
  if (version.attachment) parts.push(ATTACHMENTS[version.attachment]);
  if (version.grip) parts.push(GRIPS[version.grip]);
  // The loader refuses a unilateral version on a movement without `oneSide`;
  // "one side" is the reading if one slips through, never a blank.
  if (version.unilateral) parts.push(movement.oneSide ? ONE_SIDE_LABELS[movement.oneSide] : "one side");

  if (parts.length === 0) return movement.name;
  const detail = parts.join(", ");
  return `${movement.name} · ${detail.charAt(0).toUpperCase()}${detail.slice(1)}`;
}

export type CatalogEntry = { movement: Movement; version: MovementVersion };

/** Version id → its movement and version. Built once from a validated catalog. */
export type CatalogIndex = ReadonlyMap<string, CatalogEntry>;

export function buildCatalogIndex(movements: readonly Movement[]): CatalogIndex {
  const index = new Map<string, CatalogEntry>();
  for (const movement of movements) {
    for (const version of movement.versions) index.set(version.id, { movement, version });
  }
  return index;
}

/**
 * What a name site shows for an exercise id. `subtitle` is null for a catalog
 * exercise; otherwise it says why the name is not current.
 */
export type ExerciseNameDisplay = {
  title: string;
  subtitle: string | null;
  inCatalog: boolean;
};

export const NOT_IN_CATALOG = "No longer in the catalog";
export const UNKNOWN_EXERCISE = "Exercise no longer in the catalog";

/**
 * The name for a stored exercise id. Catalog first; when the id is not in it
 * (a version removed later, or a plan from a phone with a newer catalog),
 * `nameSnapshot`, the name as it read when the exercise was added or logged,
 * with a line saying it is not current. With no snapshot either: an explicit
 * absence and the id, never a blank (CLAUDE.md 2.4).
 *
 * The snapshot is display only and never run through the custom-name rule.
 * Custom exercises (their own `Exercise.name`) are not handled here; that is
 * stage 2's and TICKET-045's.
 */
export function resolveExerciseName(
  index: CatalogIndex,
  exerciseId: string,
  nameSnapshot?: string | null
): ExerciseNameDisplay {
  const entry = index.get(exerciseId);
  if (entry) return { title: buildVersionName(entry.movement, entry.version), subtitle: null, inCatalog: true };

  const snapshot = nameSnapshot?.trim();
  if (snapshot) return { title: snapshot, subtitle: NOT_IN_CATALOG, inCatalog: false };
  return { title: UNKNOWN_EXERCISE, subtitle: exerciseId, inCatalog: false };
}

const FIELD_ROLES: readonly FieldRole[] = ["weight", "reps", "time", "distance", "other"];

const has = (table: object, key: unknown): boolean =>
  typeof key === "string" && Object.prototype.hasOwnProperty.call(table, key);

/**
 * True when a field name carries a unit, which belongs in `unit` only
 * (TICKET-030: "Weight (kg)" reads "WEIGHT (KG) · KG"). Refused: any
 * parenthesis ("Distance (cm)", even for a unit the app does not know), and
 * any word that is a unit key ("Time s"). Not a guess at every spelling of a
 * unit; the catalog is hand-written, and these are the forms it has used.
 */
export function fieldNameCarriesUnit(name: string): boolean {
  if (/[()]/.test(name)) return true;
  return name.split(/\s+/).some((word) => unitSpec(word.toLowerCase()) !== null);
}

/**
 * Every problem in a catalog, one line each; empty means valid. Collects them
 * all rather than stopping at the first, so one run lists every fix.
 *
 * Checks values against the closed sets at runtime too, not only through the
 * types: in stage 2 the catalog arrives from Firestore as untyped JSON.
 */
export function validateCatalog(movements: readonly Movement[]): string[] {
  const errors: string[] = [];
  const movementIds = new Set<string>();
  const versionIds = new Set<string>();

  const checkMuscles = (where: string, muscles: unknown) => {
    if (!Array.isArray(muscles)) return errors.push(`${where}: muscles must be a list`);
    for (const muscle of muscles) if (!has(MUSCLES, muscle)) errors.push(`${where}: unknown muscle "${muscle}"`);
  };

  for (const movement of movements) {
    const m = movement.id;
    if (movementIds.has(m)) errors.push(`${m}: duplicate movement id`);
    movementIds.add(m);
    checkMuscles(m, movement.primaryMuscles);
    checkMuscles(m, movement.secondaryMuscles);
    if (!has(CATEGORIES, movement.category)) errors.push(`${m}: unknown category "${movement.category}"`);
    if (movement.pattern !== undefined && !has(PATTERNS, movement.pattern))
      errors.push(`${m}: unknown pattern "${movement.pattern}"`);
    if (movement.oneSide !== undefined && !has(ONE_SIDE_LABELS, movement.oneSide))
      errors.push(`${m}: unknown one-side label "${movement.oneSide}"`);
    if (!movement.versions?.length) errors.push(`${m}: has no versions`);

    for (const version of movement.versions ?? []) {
      const v = version.id;
      if (versionIds.has(v)) errors.push(`${v}: duplicate version id`);
      versionIds.add(v);

      if (!has(EQUIPMENT, version.equipment)) errors.push(`${v}: unknown equipment "${version.equipment}"`);
      if (version.angle !== undefined && !has(ANGLES, version.angle)) errors.push(`${v}: unknown angle "${version.angle}"`);
      if (version.attachment !== undefined && !has(ATTACHMENTS, version.attachment))
        errors.push(`${v}: unknown attachment "${version.attachment}"`);
      if (version.grip !== undefined && !has(GRIPS, version.grip)) errors.push(`${v}: unknown grip "${version.grip}"`);
      if (!has(MEASURES, version.measure)) errors.push(`${v}: unknown measure "${version.measure}"`);
      if (version.primaryMuscles !== undefined) checkMuscles(v, version.primaryMuscles);
      if (version.unilateral && movement.oneSide === undefined)
        errors.push(`${v}: unilateral, but ${m} has no oneSide label ("arm" or "leg")`);

      const expected = buildVersionId(m, version);
      if (v !== expected) errors.push(`${v}: id does not match its axes, expected "${expected}"`);

      if (!version.fields?.length) errors.push(`${v}: has no fields`);
      for (const field of version.fields ?? []) {
        if (!FIELD_ROLES.includes(field.role)) errors.push(`${v}: field "${field.name}" has no valid role`);
        if (fieldNameCarriesUnit(field.name))
          errors.push(`${v}: field "${field.name}" carries a unit in its name; use \`unit\``);
      }
    }
  }
  return errors;
}

export type CatalogLoad =
  | { kind: "ok"; movements: readonly Movement[]; index: CatalogIndex }
  | { kind: "invalid"; errors: string[] };

/**
 * A catalog ready to use, or every reason it is not. Never a partial catalog:
 * one bad version makes the whole load invalid, so stage 2 keeps the previous
 * catalog instead of showing some exercises and silently dropping others.
 */
export function loadCatalog(movements: readonly Movement[]): CatalogLoad {
  const errors = validateCatalog(movements);
  if (errors.length > 0) return { kind: "invalid", errors };
  return { kind: "ok", movements, index: buildCatalogIndex(movements) };
}
