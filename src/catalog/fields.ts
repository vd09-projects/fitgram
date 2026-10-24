// src/catalog/fields.ts
//
// The fields each measure logs (TICKET-046): what a plan copies when a version
// is added. One list per measure, so every version of a measure logs the same
// fields. Names carry no unit (TICKET-030); the unit is in `unit`.
//
// Time unit, per measure: seconds where a set lasts seconds (a hold, a loaded
// hold), minutes where it lasts minutes (a class, a run).

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
