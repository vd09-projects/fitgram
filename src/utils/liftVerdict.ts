// src/utils/liftVerdict.ts
//
// The History verdict (TICKET-081): how one lift in one workout compares with
// the same lift's previous session, and the one word a workout shows for all
// its lifts. Pure, so the maths is tested directly (liftVerdict.test.ts) rather
// than judged off a screen. The one comparison is `compareVolumes`, shared with
// the live card (`todaySummary`), so the two can never disagree about a lift.

import { StoredSet } from "../types/workoutSession";
import { ExerciseField } from "../types/workoutType";
import { areFieldsComparable, resolveNumericFields } from "./exerciseFields";
import { computeSessionReps, computeSessionVolume, SessionVolume } from "./exerciseStats";
import { compareVolumes } from "./setDeltas";
import { decodeStoredSets, SegmentedSet } from "./storedSets";

export type LiftVerdict = "better" | "lower" | "same";

/**
 * Why a lift has no verdict. Stored as written, so renaming one orphans every
 * record already saved.
 *
 * - `first_time`: no previous session of this exact exercise.
 * - `unit_changed`: the two sessions do not measure the same way (kg then lb,
 *   or a weight × reps lift then a time one). Never converted, never a number.
 * - `no_volume`: nothing to total: a lift with no weight × reps pair and not
 *   reps-only (time, distance, assisted), no sets, or a previous total of 0.
 * - `unreadable`: a set on either side did not parse. Not treated as 0.
 * - `pending`: written at the first phase of a save, before the stats
 *   transaction computed the verdict. Never returned here.
 */
export type LiftReason = "first_time" | "unit_changed" | "no_volume" | "unreadable" | "pending";

/** `verdict` is null exactly when there is a `reason`. */
export type LiftVerdictResult =
  | { verdict: LiftVerdict; reason: null }
  | { verdict: null; reason: LiftReason };

/** One session of one lift, each side with its own `fields`: a rename since must not turn a side into nulls. */
export type LiftSession = {
  fields: ExerciseField[];
  sets: readonly StoredSet[];
  performedAt: number;
};

type Measure =
  | { kind: "weightReps"; of: (sets: readonly SegmentedSet[]) => SessionVolume }
  | { kind: "reps"; of: (sets: readonly SegmentedSet[]) => SessionVolume };

/**
 * How a session's sets become one number: weight × reps when the fields have
 * the pair; total reps when reps is the only field (`bodyweight_reps`: Dips,
 * chin-ups); otherwise null. Rejected for reps-only: no verdict, which leaves
 * those lifts blank on every row. A lift with weight and reps (weighted
 * bodyweight) keeps weight × reps. A reps field next to a time or an
 * assistance field is not reps-only: its reps mean something else.
 */
function measureOf(fields: ExerciseField[]): Measure | null {
  const numeric = resolveNumericFields(fields);
  if (numeric) return { kind: "weightReps", of: (sets) => computeSessionVolume(sets, numeric) };
  if (fields.length === 1 && fields[0].role === "reps") {
    const repsField = fields[0];
    return { kind: "reps", of: (sets) => computeSessionReps(sets, repsField) };
  }
  return null;
}

/**
 * The verdict of one lift against its previous session.
 *
 * **The rule is the app's own** (user, 2026-11-13): session total of weight ×
 * reps against last time, over the first N sets when there are fewer sets
 * today and over the totals otherwise, as `todaySummary` does on the card.
 *
 * - **Same** means no difference after `VERDICT_SAME_TOLERANCE`, which absorbs
 *   decimal-plate float noise and nothing a lifter could feel.
 * - **A swap does not change the verdict.** The lift's id is the exercise that
 *   was done, and `previous` is that exercise's last session, as the card
 *   showed during the workout. It is First time only when that exercise has no
 *   earlier session. Deviates from 081's first wording ("a swapped lift has no
 *   previous session"), which would call a Bench Press First time because it
 *   replaced a plan's Incline Press: see the ticket. The caller chooses
 *   `previous`; reversing this is a change there, not here.
 * - **First time is judged before anything else**, so a first plank is First
 *   time, not "no volume": the History row is a fact about the lift, not about
 *   the maths. (The TICKET-087 baseline script checked the pair first.)
 * - A unit change, an unreadable set and a missing total are reasons with no
 *   verdict, never a number.
 * - A previous total of 0 is `no_volume` as on the card: no percentage of
 *   nothing, even when today is above it.
 */
export function liftVerdict(current: LiftSession, previous: LiftSession | null): LiftVerdictResult {
  const no = (reason: LiftReason): LiftVerdictResult => ({ verdict: null, reason });
  if (!previous) return no("first_time");

  const now = measureOf(current.fields);
  const then = measureOf(previous.fields);
  if (!now && !then) return no("no_volume");
  const sameMeasure =
    now !== null &&
    then !== null &&
    now.kind === then.kind &&
    (now.kind === "reps" || areFieldsComparable(current.fields, previous.fields));
  if (!now || !then || !sameMeasure) return no("unit_changed");

  const todaySets = decodeStoredSets(current.sets);
  const comparison = compareVolumes(
    { sets: todaySets, volume: now.of(todaySets) },
    { sets: decodeStoredSets(previous.sets), performedAt: previous.performedAt },
    then.of
  );

  if (comparison.kind === "percent") {
    const verdict = comparison.direction > 0 ? "better" : comparison.direction < 0 ? "lower" : "same";
    return { verdict, reason: null };
  }
  switch (comparison.reason) {
    case "todayUnavailable":
    case "pastUnavailable":
      return no("unreadable");
    default:
      // noSets, pastZero: nothing to total on one side.
      return no("no_volume");
  }
}

/**
 * What a workout row shows for all its lifts.
 *
 * - `better` / `lower`: "N better" when any lift is better, else "N lower".
 *   A mixed workout shows only the better count. `count` is that count.
 * - `same`: nothing better or lower and at least one lift the same.
 * - `first_time`: every lift is a first time.
 * - `not_compared`: anything else, including no lifts.
 * - `pending`: some lift has no verdict yet. A word from half the verdicts
 *   would be a plausible wrong answer, so there is none (a stored record
 *   between the two phases of a save, or a workout still uploading).
 *
 * First-time and not-compared lifts are not counted. `amber` is the dot: at
 * least one lift is better.
 *
 * Decided: a workout of first-time lifts and, say, a plank reads Not compared,
 * not First time, because it is not true of every lift. Rejected: First time
 * whenever any lift is.
 */
export type WorkoutVerdict =
  | { word: "better" | "lower"; count: number; amber: boolean }
  | { word: "same" | "first_time" | "not_compared" | "pending"; amber: false };

export function workoutVerdict(lifts: readonly LiftVerdictResult[]): WorkoutVerdict {
  if (lifts.some((lift) => lift.reason === "pending")) return { word: "pending", amber: false };
  const count = (verdict: LiftVerdict) => lifts.filter((lift) => lift.verdict === verdict).length;
  const better = count("better");
  if (better > 0) return { word: "better", count: better, amber: true };
  const lower = count("lower");
  if (lower > 0) return { word: "lower", count: lower, amber: false };
  if (count("same") > 0) return { word: "same", amber: false };
  if (lifts.length > 0 && lifts.every((lift) => lift.reason === "first_time")) {
    return { word: "first_time", amber: false };
  }
  return { word: "not_compared", amber: false };
}
