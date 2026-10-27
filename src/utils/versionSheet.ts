// src/utils/versionSheet.ts
//
// The version sheet's logic (TICKET-043 A3), pure: which rows a movement shows,
// which options are enabled, what starts selected, and which version the
// selection is. The sheet (components/exercise_picker/VersionSheet.tsx) only
// draws it.

import { ANGLES, ATTACHMENTS, EQUIPMENT, GRIPS, ONE_SIDE_LABELS } from "../constants/catalogVocabulary";
import type { Movement, MovementVersion } from "../types/catalog";
import type { VersionPick } from "./exerciseSearch";

/**
 * The rows, in order. SIDE IS A ROW TOO (added 2026-10-27, stage 3): 35
 * movements have one-arm or one-leg versions next to two-sided ones, and
 * without the row those versions could not be added. Shown, like every row,
 * only where the movement's versions differ on it, matching the version names
 * (`buildVersionName` shows one side only when sides differ).
 */
export const AXES = ["equipment", "angle", "grip", "attachment", "side"] as const;
export type Axis = (typeof AXES)[number];

/**
 * A version's value on an axis, defaults spelled out so they can be options:
 * "flat", "normal" grip, "none" for no attachment, "both" sides.
 */
export function axisValue(version: MovementVersion, axis: Axis): string {
  if (axis === "equipment") return version.equipment;
  if (axis === "angle") return version.angle ?? "flat";
  if (axis === "grip") return version.grip ?? "normal";
  if (axis === "attachment") return version.attachment ?? "none";
  return version.unilateral ? "one" : "both";
}

/** Defaults that start selected (user, 2026-10-27): Angle and Grip, and Side. Equipment and Attachment start empty. */
const START: Partial<Record<Axis, string>> = { angle: "flat", grip: "normal", side: "both" };

/** The value a version has when the axis is left out (`axisValue`). Equipment has none. */
const DEFAULT_VALUE: Partial<Record<Axis, string>> = { angle: "flat", grip: "normal", attachment: "none", side: "both" };

export type SheetState = {
  values: Partial<Record<Axis, string>>;
  /** Axes the user tapped or the query named. Others are soft: they move when they stop fitting. */
  chosen: Axis[];
  /** The version last logged (TICKET-050), or null. Its values other than defaults are marked "last". */
  lastUsed: MovementVersion | null;
  /** Whether soft axes start from `lastUsed` instead of the defaults. See `initialSheet`. */
  followLast: boolean;
};

export type SheetOption = { value: string; label: string; enabled: boolean; last: boolean };
export type SheetRow = { axis: Axis; title: string; options: SheetOption[]; selected?: string };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ROW_TITLES: Record<Axis, string> = {
  equipment: "Equipment",
  angle: "Angle",
  grip: "Grip",
  attachment: "Attachment",
  side: "Side",
};

function optionLabel(movement: Movement, axis: Axis, value: string): string {
  if (axis === "equipment") return cap(EQUIPMENT[value as keyof typeof EQUIPMENT]);
  if (axis === "angle") return value === "flat" ? "Flat" : cap(ANGLES[value as keyof typeof ANGLES]);
  // "close grip" → "Close": the row is already titled Grip.
  if (axis === "grip") return value === "normal" ? "Normal" : cap(GRIPS[value as keyof typeof GRIPS].replace(/ grip$/, ""));
  if (axis === "attachment") return value === "none" ? "None" : cap(ATTACHMENTS[value as keyof typeof ATTACHMENTS]);
  return value === "both" ? "Both" : cap(movement.oneSide ? ONE_SIDE_LABELS[movement.oneSide] : "one side");
}

const available = (movement: Movement, inPlan: ReadonlySet<string>) =>
  movement.versions.filter((v) => !inPlan.has(v.id));

const fits = (version: MovementVersion, values: SheetState["values"], axes: readonly Axis[]) =>
  axes.every((a) => values[a] === undefined || axisValue(version, a) === values[a]);

/**
 * Soft axes follow what was chosen (the fallback rule, user 2026-10-27). They
 * start from their default each time (Angle flat, Grip normal, Side both;
 * Equipment and Attachment empty): the default if it fits the chosen axes,
 * else the only valid value, else empty. "Valid" counts only versions not
 * already in the plan. So picking EZ bar on Bench Press moves Grip to Close
 * (`bench_press__ez_bar__close_grip`, no normal grip), and picking Weight plate
 * on Sit-Up moves Angle to Decline.
 *
 * Soft axes settle in row order, each narrowing the versions the next one
 * sees. So whenever every axis has a value, some version has all of them:
 * Pushdown with Cable and None chosen settles Side to One arm, the only
 * no-attachment version with a normal grip. Rejected: settling each axis
 * against the chosen ones alone, which left Cable, None, Normal, Both, a
 * combination no version has. Rejected too: keeping the current value while it
 * fits (user review, 2026-10-27). A value forced by one choice then outlived it:
 * Bench EZ bar → Barbell kept Close grip, and Front Raise Dumbbell → Cable kept
 * Attachment None and added the no-attachment version without asking. 13
 * movement × equipment switches differed from a fresh sheet; now none do.
 */
function settle(movement: Movement, state: SheetState, inPlan: ReadonlySet<string>): SheetState {
  const values = { ...state.values };
  let pool = available(movement, inPlan).filter((v) => fits(v, values, state.chosen));
  // The last-used version replaces the defaults while what is chosen still
  // allows it (TICKET-050). Pick Dumbbell after a last-used Barbell and the
  // sheet is a fresh Dumbbell sheet, not Dumbbell with Barbell's grip.
  const last = state.followLast && state.lastUsed ? pool.find((v) => v.id === state.lastUsed!.id) ?? null : null;
  for (const axis of AXES) {
    if (!state.chosen.includes(axis)) {
      const valid = new Set(pool.map((v) => axisValue(v, axis)));
      const current = last ? axisValue(last, axis) : START[axis];
      values[axis] = current !== undefined && valid.has(current) ? current
        : valid.size === 1 ? [...valid][0] : undefined;
    }
    const value = values[axis];
    if (value !== undefined) pool = pool.filter((v) => axisValue(v, axis) === value);
  }
  return { ...state, values };
}

/**
 * The sheet as it opens. Axes the query named (`preselect`) count as chosen;
 * Angle, Grip and Side start on their defaults; then soft axes settle.
 *
 * **Last used (TICKET-050, A3):** `lastUsed` preselects the version logged
 * last, as soft values, never as chosen ones, so it disables nothing (chosen
 * Barbell + Close would grey out every equipment without a close grip).
 * Rejected: passing it as a `VersionPick`, which is exactly that.
 * - **The query wins outright** (user, 2026-10-27, D7): when it names any axis
 *   ("db bench"), last-used is not merged in, not even on the axes the query
 *   left open. A half-merged Dumbbell + last-used Close grip was neither what
 *   was typed nor what was logged.
 * - **Already in the plan:** preselects nothing (it could not be added).
 * - Either way its values stay marked "last".
 */
export function initialSheet(
  movement: Movement,
  preselect: VersionPick,
  inPlan: ReadonlySet<string>,
  lastUsed: MovementVersion | null = null
): SheetState {
  const values: SheetState["values"] = { ...START };
  const chosen: Axis[] = [];
  const named: Array<[Axis, string | undefined]> = [
    ["equipment", preselect.equipment],
    ["angle", preselect.angle],
    ["grip", preselect.grip],
    ["attachment", preselect.attachment],
    ["side", preselect.unilateral ? "one" : undefined],
  ];
  for (const [axis, value] of named) {
    if (value === undefined) continue;
    values[axis] = value;
    chosen.push(axis);
  }
  // Already in the plan needs no check here: `settle` looks for it among the
  // versions not in the plan, so it preselects nothing.
  const followLast = !!lastUsed && chosen.length === 0;
  return settle(movement, { values, chosen, lastUsed, followLast }, inPlan);
}

/** Tap an option. Disabled options are never passed here (the sheet does not call it for them). */
export function chooseOption(
  movement: Movement,
  state: SheetState,
  axis: Axis,
  value: string,
  inPlan: ReadonlySet<string>
): SheetState {
  const chosen = state.chosen.includes(axis) ? state.chosen : [...state.chosen, axis];
  return settle(movement, { ...state, values: { ...state.values, [axis]: value }, chosen }, inPlan);
}

/**
 * Rows to draw. A row appears only where the movement's versions differ on it.
 * ATTACHMENT ONLY FOR CABLE (board A3): no other equipment has one, so the row
 * shows once Cable is the equipment. An option is enabled when some version not
 * already in the plan has it together with every OTHER chosen axis: so a
 * combination that does not exist (Band × Incline) and one already in the plan
 * are disabled, never hidden. Soft defaults do not disable anything: Grip
 * starting on Normal must not disable EZ bar.
 */
export function sheetRows(movement: Movement, state: SheetState, inPlan: ReadonlySet<string>): SheetRow[] {
  const pool = available(movement, inPlan);
  const rows: SheetRow[] = [];
  for (const axis of AXES) {
    const all = [...new Set(movement.versions.map((v) => axisValue(v, axis)))];
    if (all.length < 2) continue;
    if (axis === "attachment" && state.values.equipment !== "cable") continue;
    const relevant = axis === "attachment" ? movement.versions.filter((v) => v.equipment === "cable") : movement.versions;
    const values = [...new Set(relevant.map((v) => axisValue(v, axis)))];
    const others = state.chosen.filter((a) => a !== axis);
    rows.push({
      axis,
      title: ROW_TITLES[axis],
      selected: state.values[axis],
      options: values.map((value) => ({
        value,
        label: optionLabel(movement, axis, value),
        enabled: pool.some((v) => axisValue(v, axis) === value && fits(v, state.values, others)),
        // Board VersionRecent: "last" on Barbell and Close, not on Flat. A
        // default says nothing about what was logged; the line under the rows
        // spells the whole version.
        last: !!state.lastUsed && axisValue(state.lastUsed, axis) === value && value !== DEFAULT_VALUE[axis],
      })),
    });
  }
  return rows;
}

/**
 * The version the selection names, or null: when an axis is still empty, the
 * combination does not exist, or it is already in the plan. Add is disabled on
 * null, so none of those can be added.
 */
export function selectedVersion(movement: Movement, state: SheetState, inPlan: ReadonlySet<string>): MovementVersion | null {
  if (AXES.some((a) => state.values[a] === undefined)) return null;
  return available(movement, inPlan).find((v) => fits(v, state.values, AXES)) ?? null;
}

/**
 * Nothing left to add for what is chosen: every version with the chosen values
 * is already in the plan ("incline db bench" when that one is). The sheet says
 * so on its Add button instead of asking for a row that cannot help.
 */
export function chosenAllInPlan(movement: Movement, state: SheetState, inPlan: ReadonlySet<string>): boolean {
  return !available(movement, inPlan).some((v) => fits(v, state.values, state.chosen));
}
