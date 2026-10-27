// src/catalog/searchWords.ts
//
// The search vocabulary's source (TICKET-043): slang and short forms users type
// for a muscle, equipment or a version axis. Uploaded by
// src/scripts/uploadCatalog.ts to `exercise_catalog/search_words`, with its own
// hash. DO NOT IMPORT THIS FROM APP CODE, for the same reason as `CATALOG`
// (./index.ts): the app reads the uploaded copy, so a new word ships with an
// upload, not a build.
//
// Only what the labels in catalogVocabulary.ts do not already say. "chest",
// "upper chest", "rear delts", "dumbbell", "smith machine", "incline", "close
// grip", "one arm" are derived from those labels (exerciseSearch.ts).
//
// Another name for ONE exercise ("rdl", "gravitron") is not slang: it is an
// alias on that movement or version, in the catalog.

import type { SearchWords } from "../types/catalog";

export const SEARCH_WORDS: SearchWords = {
  muscleGroups: {
    pecs: "chest",
    delts: "shoulders",
    abdominals: "core",
    stomach: "core",
    belly: "core",
  },
  muscles: {
    "six pack": ["abs"],
    ab: ["abs"],
    wings: ["lats"],
    trapezius: ["traps"],
    rhomboids: ["upper_back"],
    erectors: ["lower_back"],
    "spinal erectors": ["lower_back"],
    bis: ["biceps"],
    tris: ["triceps"],
    thighs: ["quads"],
    hams: ["hamstrings"],
    hammies: ["hamstrings"],
    butt: ["glutes"],
    booty: ["glutes"],
    bum: ["glutes"],
    calf: ["calves"],
    shin: ["tibialis"],
    // On its own only: "close grip" and the other grips are axes (labels).
    grip: ["forearms"],
    "lower chest": ["chest"],
    "mid back": ["upper_back"],
    "middle back": ["upper_back"],
    "lateral delts": ["side_delts"],
    "inner thigh": ["adductors"],
    "outer thigh": ["abductors"],
    "glute med": ["abductors"],
  },
  equipment: {
    db: ["dumbbell"],
    bb: ["barbell"],
    kb: ["kettlebell"],
    // Decided (user, 2026-10-27): "machine" is not the Smith machine (a bar on
    // rails, "smith") and not a cardio machine. Overrides the label's own entry.
    machine: ["machine", "plate_loaded_machine", "assisted_machine"],
    smith: ["smith_machine"],
    "plate loaded": ["plate_loaded_machine"],
    assisted: ["assisted_machine"],
    ez: ["ez_bar"],
    "hex bar": ["trap_bar"],
    "safety bar": ["safety_squat_bar"],
    ssb: ["safety_squat_bar"],
    bw: ["bodyweight"],
    "no equipment": ["bodyweight"],
    "med ball": ["medicine_ball"],
    "swiss ball": ["stability_ball"],
    trx: ["suspension_trainer"],
    suspension: ["suspension_trainer"],
    plate: ["weight_plate"],
    vest: ["weight_vest"],
    weighted: ["added_weight"],
  },
  axes: {
    close: { axis: "grip", value: "close" },
    reverse: { axis: "grip", value: "reverse" },
    neutral: { axis: "grip", value: "neutral" },
    "hammer grip": { axis: "grip", value: "neutral" },
    "single arm": { axis: "unilateral", value: true },
    "single leg": { axis: "unilateral", value: true },
    unilateral: { axis: "unilateral", value: true },
  },
};
