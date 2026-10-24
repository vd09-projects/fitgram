// src/catalog/fields.ts
//
// The fields each measure logs (TICKET-046): what a plan copies when a version
// is added. One list per measure, so every version of a measure logs the same
// fields. Names carry no unit (TICKET-030); the unit is in `unit`.
//
// Time unit, per measure: seconds where a set lasts seconds (a hold, a loaded
// hold), minutes where it lasts minutes (a class, a run).
//
// Distance, per measure, by WHAT ONE SET IS (TICKET-046, 2026-10-25):
// - `short_distance`, m + s: one effort of a few hundred metres at most, timed
//   in seconds. Sprint, Hill Sprint, Shuttle Run, Bounding, Track Intervals
//   (one rep is a set), Bear Crawl
// - `distance_time`, km + min: a continuous piece. Runs, walks, rows, rides,
//   the ski erg, Treadmill Intervals (logged as one total), and swimming:
//   1500 m reads 1.5 km, consistent with the other long cardio
// - `weight_distance`, kg + m: a loaded carry or sled. Rucking stays here, so a
//   5 km ruck reads 5000 m; a fourth measure for one movement was rejected
// Rejected: one distance measure for all, which makes a 20 m crawl 0.02 km or
// a 10 km run 10000 m.
//
// These are only the default units. The user can switch the chip (m / km,
// s / min) when adding the exercise to a plan. Units are never converted: a
// set in m never compares with one in km (`lastTopSet` reports
// `unit_changed`), so the default decides which earlier sets a new one is
// compared with. History itself joins on the version id, whatever the unit.

import type { MeasureId } from "../constants/catalogVocabulary";
import type { ExerciseField } from "../types/workoutType";

const REPS: ExerciseField = { name: "Reps", role: "reps" };

export const FIELDS: Record<MeasureId, ExerciseField[]> = {
  weight_reps: [{ name: "Weight", role: "weight", unit: "kg" }, REPS],
  // Reps only. No weight field, optional or not: an empty weight parses to
  // null, and one such set empties the whole session's volume. With no
  // weight/reps pair the exercise is left out of volume instead
  // (computeSessionTotalVolume). Weighted sets are the `added_weight` version.
  bodyweight_reps: [REPS],
  // Volume counts the added weight only: "+10 kg × 5" adds 50 kg to the
  // session's kg total. That understates the work (the body is lifted too),
  // but the added weight is the only load the app knows.
  weighted_bodyweight_reps: [{ name: "Added Weight", role: "weight", unit: "kg" }, REPS],
  // Role `other`, not `weight`: as a weight, less assistance (progress) would
  // read as a regression, set a worse "best" and add to volume. Kept with its
  // kg unit so the set card still says what the number is. Revisit with TICKET-035.
  assisted: [{ name: "Assistance", role: "other", unit: "kg" }, REPS],
  reps: [REPS],
  hold: [{ name: "Time", role: "time", unit: "s" }],
  duration: [{ name: "Time", role: "time", unit: "min" }],
  distance_time: [
    { name: "Distance", role: "distance", unit: "km" },
    { name: "Time", role: "time", unit: "min" },
  ],
  short_distance: [
    { name: "Distance", role: "distance", unit: "m" },
    { name: "Time", role: "time", unit: "s" },
  ],
  weight_distance: [
    { name: "Weight", role: "weight", unit: "kg" },
    { name: "Distance", role: "distance", unit: "m" },
  ],
  weight_time: [
    { name: "Weight", role: "weight", unit: "kg" },
    { name: "Time", role: "time", unit: "s" },
  ],
  // Metres, not centimetres: `cm` is not a unit (TICKET-030), and adding one
  // would add a chip to Manage Workout. A broad jump reads 2.45 m.
  jump_distance: [{ name: "Distance", role: "distance", unit: "m" }],
};
