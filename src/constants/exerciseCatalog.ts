// src/constants/exerciseCatalog.ts
//
// TICKET-042 stage 1: a small hand-made catalog that exercises every axis of
// the model. Nothing in the app reads it yet. TICKET-046 replaces it with the
// real catalog, in this same shape.
//
// Version ids are written out as literals, never built: they are history keys
// (`buildVersionId` in utils/catalog.ts only checks them). Once a version
// ships, its id never changes; `exerciseCatalog.test.ts` pins every one.
//
// Muscles, aliases and patterns are taken from the research catalog
// (research/exercise-catalog/), which is reference only.

import type { Movement } from "../types/catalog";
import type { ExerciseField } from "../types/workoutType";

const WEIGHT_REPS: ExerciseField[] = [
  { name: "Weight", role: "weight", unit: "kg" },
  { name: "Reps", role: "reps" },
];
const REPS: ExerciseField[] = [{ name: "Reps", role: "reps" }];
const HOLD: ExerciseField[] = [{ name: "Time", role: "time", unit: "s" }];
// Role `other`, not `weight`: as a weight, less assistance (progress) would read
// as a regression, set a worse "best" and add to volume. Kept with its kg unit
// so the set card still says what the number is. Revisit with TICKET-035.
const ASSISTED: ExerciseField[] = [
  { name: "Assistance", role: "other", unit: "kg" },
  { name: "Reps", role: "reps" },
];

export const EXERCISE_CATALOG: Movement[] = [
  {
    // Equipment × angle, plus a grip version. Incline is an angle, not its own
    // movement (TICKET-041 board A3).
    id: "bench_press",
    name: "Bench Press",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["front_delts", "triceps"],
    category: "strength",
    pattern: "horizontal_push",
    mechanic: "compound",
    aliases: ["bench", "flat bench", "bp", "chest press"],
    versions: [
      { id: "bench_press__barbell", equipment: "barbell", unilateral: false, measure: "weight_reps", fields: WEIGHT_REPS, aliases: [] },
      { id: "bench_press__dumbbell", equipment: "dumbbell", unilateral: false, measure: "weight_reps", fields: WEIGHT_REPS, aliases: ["db bench"] },
      { id: "bench_press__smith_machine", equipment: "smith_machine", unilateral: false, measure: "weight_reps", fields: WEIGHT_REPS, aliases: [] },
      { id: "bench_press__machine", equipment: "machine", unilateral: false, measure: "weight_reps", fields: WEIGHT_REPS, aliases: [] },
      {
        id: "bench_press__barbell__incline",
        equipment: "barbell",
        angle: "incline",
        unilateral: false,
        measure: "weight_reps",
        fields: WEIGHT_REPS,
        aliases: ["incline bench"],
        primaryMuscles: ["upper_chest"],
      },
      {
        id: "bench_press__dumbbell__incline",
        equipment: "dumbbell",
        angle: "incline",
        unilateral: false,
        measure: "weight_reps",
        fields: WEIGHT_REPS,
        aliases: ["incline db press"],
        primaryMuscles: ["upper_chest"],
      },
      { id: "bench_press__barbell__decline", equipment: "barbell", angle: "decline", unilateral: false, measure: "weight_reps", fields: WEIGHT_REPS, aliases: ["decline bench"] },
      {
        id: "bench_press__barbell__close_grip",
        equipment: "barbell",
        grip: "close",
        unilateral: false,
        measure: "weight_reps",
        fields: WEIGHT_REPS,
        aliases: ["cgbp", "close grip bench"],
        primaryMuscles: ["triceps", "chest"],
      },
    ],
  },
  {
    // Cable attachments. Every version is cable, so names read "· Rope".
    id: "triceps_pushdown",
    name: "Triceps Pushdown",
    primaryMuscles: ["triceps"],
    secondaryMuscles: [],
    category: "strength",
    pattern: "isolation_upper",
    mechanic: "isolation",
    aliases: ["tricep pushdown", "pressdown"],
    versions: [
      { id: "triceps_pushdown__cable__rope", equipment: "cable", attachment: "rope", unilateral: false, measure: "weight_reps", fields: WEIGHT_REPS, aliases: ["rope pushdown"] },
      { id: "triceps_pushdown__cable__straight_bar", equipment: "cable", attachment: "straight_bar", unilateral: false, measure: "weight_reps", fields: WEIGHT_REPS, aliases: ["bar pushdown"] },
      { id: "triceps_pushdown__cable__v_bar", equipment: "cable", attachment: "v_bar", unilateral: false, measure: "weight_reps", fields: WEIGHT_REPS, aliases: ["v bar pushdown"] },
    ],
  },
  {
    // A one-side version: id `__one_side`, name "one arm".
    id: "lateral_raise",
    name: "Lateral Raise",
    primaryMuscles: ["side_delts"],
    secondaryMuscles: ["traps"],
    category: "strength",
    pattern: "isolation_upper",
    mechanic: "isolation",
    aliases: ["side raise", "lat raise"],
    oneSide: "arm",
    versions: [
      { id: "lateral_raise__dumbbell", equipment: "dumbbell", unilateral: false, measure: "weight_reps", fields: WEIGHT_REPS, aliases: [] },
      { id: "lateral_raise__cable", equipment: "cable", unilateral: false, measure: "weight_reps", fields: WEIGHT_REPS, aliases: [] },
      { id: "lateral_raise__cable__one_side", equipment: "cable", unilateral: true, measure: "weight_reps", fields: WEIGHT_REPS, aliases: ["single arm cable lateral raise"] },
    ],
  },
  {
    // A single version: the name is the movement's alone.
    id: "pec_deck",
    name: "Pec Deck (Machine Fly)",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["front_delts"],
    category: "strength",
    pattern: "isolation_upper",
    mechanic: "isolation",
    aliases: ["pec deck", "machine fly", "butterfly"],
    versions: [
      { id: "pec_deck__machine", equipment: "machine", unilateral: false, measure: "weight_reps", fields: WEIGHT_REPS, aliases: [] },
    ],
  },
  {
    // Time only.
    id: "plank",
    name: "Plank",
    primaryMuscles: ["abs", "deep_core"],
    secondaryMuscles: ["front_delts", "glutes"],
    category: "calisthenics",
    pattern: "anti_extension",
    mechanic: "compound",
    aliases: ["front plank", "forearm plank"],
    versions: [{ id: "plank__bodyweight", equipment: "bodyweight", unilateral: false, measure: "hold", fields: HOLD, aliases: [] }],
  },
  {
    // An assisted version: assistance is role `other` (see ASSISTED above).
    id: "pull_up",
    name: "Pull-Up",
    primaryMuscles: ["lats"],
    secondaryMuscles: ["biceps", "upper_back", "forearms"],
    category: "calisthenics",
    pattern: "vertical_pull",
    mechanic: "compound",
    aliases: ["pullup", "pull up"],
    versions: [
      { id: "pull_up__pull_up_bar", equipment: "pull_up_bar", unilateral: false, measure: "bodyweight_reps", fields: REPS, aliases: [] },
      { id: "pull_up__assisted_machine", equipment: "assisted_machine", unilateral: false, measure: "assisted", fields: ASSISTED, aliases: ["gravitron", "assisted pull up"] },
    ],
  },
];
