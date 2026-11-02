// src/utils/setSummary/topSet.ts
//
// The one number that stands for an exercise's last session (TICKET-022, moved
// here in TICKET-065). Tests: topSet.test.ts, next to this file.

import { ExerciseHistory, ExerciseHistorySession } from "../../types/exerciseHistory";
import { ExerciseField, FieldRole } from "../../types/workoutType";
import { parseNumericValue, unitLabel } from "../exerciseFields";
import { TextPart, formatNumber } from "../startWorkout";
import { comparisonSegment } from "../storedSets";

const num = (text: string): TextPart => ({ text, numeric: true });
const txt = (text: string): TextPart => ({ text });

export type TopSet =
  | { kind: "set"; weight: number; reps: number; unit: string | null; setNumber: number }
  /** An exercise without a weight+reps pair: its best on one measured field. */
  | { kind: "best"; value: number; role: FieldRole; unit: string | null; setNumber: number }
  | {
      kind: "none";
      reason: "no_history" | "no_numeric_pair" | "unit_changed" | "no_parseable_set";
    };

const MEASURED_ROLES: FieldRole[] = ["weight", "reps", "time", "distance"];

/**
 * **last top set** = the heaviest set of the most recent session, by weight;
 * ties go to more reps, then to the earlier set. A set needs both weight and
 * reps to parse. Not an estimated 1RM and not the all-time best — "what did I
 * lift last time", which is what judging a plan before starting it asks. The
 * all-time best, for the PR banner, is `personalBest` (src/utils/personalBest.ts):
 * "top" is always one session here, "best" there is always all-time.
 *
 * **Without a weight+reps pair** (a plank logged in minutes, burpees as reps
 * only), the top set is the highest value of the exercise's *first measured
 * field* in its definition order — the field the user put first. Rejected: a
 * fixed role priority (time over distance over reps), which would pick for the
 * user on exercises with several measured fields. Known limit: "highest" assumes
 * more is better, which is wrong for a timed run over a fixed distance; no
 * catalog exercise is defined that way today.
 *
 * A last session logged in another unit than today's definition reports
 * `unit_changed`: its values are not comparable and are not converted.
 */
export function lastTopSet(
  history: Pick<ExerciseHistory, "lastSession" | "numericFields" | "fields">
): TopSet {
  const { lastSession, numericFields } = history;
  if (!lastSession) return { kind: "none", reason: "no_history" };
  if (!numericFields) return bestOnFirstMeasuredField(history.fields, lastSession);
  if (!lastSession.comparable) return { kind: "none", reason: "unit_changed" };

  let top: Extract<TopSet, { kind: "set" }> | null = null;
  for (const set of lastSession.sets) {
    if (set.weight === null || set.reps === null) continue;
    if (
      !top ||
      set.weight > top.weight ||
      (set.weight === top.weight && set.reps > top.reps)
    ) {
      top = {
        kind: "set",
        weight: set.weight,
        reps: set.reps,
        unit: numericFields.weight.unit ?? null,
        setNumber: set.setNumber,
      };
    }
  }
  return top ?? { kind: "none", reason: "no_parseable_set" };
}

function bestOnFirstMeasuredField(
  currentFields: ExerciseField[],
  lastSession: ExerciseHistorySession
): TopSet {
  const field = currentFields.find((f) => MEASURED_ROLES.includes(f.role));
  if (!field) return { kind: "none", reason: "no_numeric_pair" };

  // Values are stored under the field's name, so the session's own definition
  // of that name is what says which unit they were logged in.
  const logged = lastSession.fields.find((f) => f.name === field.name);
  if (!logged || logged.role !== field.role) {
    return { kind: "none", reason: "no_parseable_set" };
  }
  if ((logged.unit ?? null) !== (field.unit ?? null)) {
    return { kind: "none", reason: "unit_changed" };
  }

  let best: Extract<TopSet, { kind: "best" }> | null = null;
  for (const set of lastSession.sets) {
    const value = parseNumericValue(comparisonSegment(set)[field.name]);
    if (value === null) continue;
    if (!best || value > best.value) {
      best = { kind: "best", value, role: field.role, unit: field.unit ?? null, setNumber: set.setNumber };
    }
  }
  return best ?? { kind: "none", reason: "no_parseable_set" };
}

/** A top set that has a number: what `formatTopSet` takes. */
export type MeasuredTopSet = Extract<TopSet, { kind: "set" | "best" }>;

/**
 * "24 kg × 10", "1 plate × 12", "1.5 min", "20 reps". The figure only; why
 * there is none is `lastTimeSummary`'s to say, with the set count.
 */
export function formatTopSet(top: MeasuredTopSet): TextPart[] {
  if (top.kind === "best") {
    const value = formatNumber(top.value);
    const suffix = top.unit ? ` ${unitLabel(value, top.unit)}` : top.role === "reps" ? " reps" : "";
    return [num(value), ...(suffix ? [txt(suffix)] : [])];
  }
  const weight = formatNumber(top.weight);
  return [
    num(weight),
    ...(top.unit ? [txt(` ${unitLabel(weight, top.unit)}`)] : []),
    txt(" × "),
    num(String(top.reps)),
  ];
}
