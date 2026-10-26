// TICKET-043 stage 1: search over the real catalog.
//
// CASES are the prototype's 91 (research/exercise-catalog/search_cases.py),
// rewritten from research entry names to movement ids through ACCOUNTING.md
// (2026-10-27). Top-N is the prototype's, tightened to 1 only where the query
// is the movement's exact name or alias. `pre` is what the version sheet
// preselects, for the queries that name equipment or an axis.

import { CATALOG } from "../catalog";
import { SEARCH_WORDS } from "../catalog/searchWords";
import type { Movement } from "../types/catalog";
import type { Exercise } from "../types/workoutType";
import {
  buildSearchCatalog,
  customExercisesFromPlans,
  searchExercises,
  type SearchResult,
  type VersionPick,
} from "./exerciseSearch";

const catalog = buildSearchCatalog(CATALOG, SEARCH_WORDS);
const idOf = (r: SearchResult) => (r.kind === "movement" ? r.movement.id : r.exercise.id);
const top = (query: string, n = 50) => searchExercises(catalog, query, n).results;
const ids = (query: string, n = 50) => top(query, n).map(idOf);

type Case = [query: string, movementId: string, topN: number, pre?: VersionPick];

const CASES: Case[] = [
  // The app's old 42 exercise names, plurals included
  ["Bicep Curls", "bicep_curl", 1],
  ["Leg Extensions", "leg_extension", 1],
  ["Rowing", "rowing_machine", 1],
  ["Treadmill", "treadmill_run", 1],
  ["Bench Press", "bench_press", 1],
  ["Deadlifts", "deadlift", 1],
  ["Squats", "squat", 1],
  ["Pull-Ups", "pull_up", 1],
  ["Cycling", "stationary_bike", 1],
  ["Jump Rope", "skipping", 1],
  ["Plank", "plank", 1],
  ["Lunges", "lunge", 1],
  ["Lat Pulldown", "lat_pulldown", 1],
  ["Overhead Press", "overhead_press", 1],
  ["Battle Ropes", "battle_rope_waves", 1],
  ["Hammer Curls", "hammer_curl", 1],
  ["Triceps Dips", "dip", 1],
  ["Russian Twists", "russian_twist", 1],
  ["Sit-Ups", "sit_up", 1],
  ["Leg Raises", "lying_leg_raise", 1],
  ["Side Plank", "side_plank", 1],
  ["Burpees", "burpee", 1],
  ["Mountain Climbers", "mountain_climber", 1],
  ["Jump Squats", "jump_squat", 1],
  ["Kettlebell Swings", "swing", 1, { equipment: "kettlebell" }],
  ["Farmer’s Walk", "farmers_walk", 1],
  ["Sled Push", "sled_push", 1],
  ["Box Jumps", "box_jump", 1],
  ["Hip Thrusts", "hip_thrust", 1],
  ["Seated Calf Raises", "seated_calf_raise", 1],
  ["Standing Calf Raises", "standing_calf_raise", 1],
  ["Chest Flys", "chest_fly", 1],
  ["Bent-Over Rows", "bent_over_row", 1],
  ["Reverse Lunges", "reverse_lunge", 1],
  ["Face Pulls", "face_pull", 1],
  ["Arnold Press", "arnold_press", 1],
  ["Sumo Deadlifts", "sumo_deadlift", 1],
  ["Trap Bar Deadlifts", "deadlift", 1, { equipment: "trap_bar" }],
  ["Landmine Press", "landmine_press", 1, { equipment: "landmine" }],
  ["Step-Ups", "step_up", 1],
  ["Hanging Leg Raises", "hanging_leg_raise", 1],
  ["Cable Lateral Raises", "lateral_raise", 1, { equipment: "cable" }],
  // Muscle search: found by what it trains, not by its name
  ["chest", "bench_press", 3],
  ["abs", "plank", 10],
  ["core", "plank", 10],
  ["upper chest", "bench_press", 5],
  ["lower back", "back_extension", 5],
  ["rear delts", "reverse_pec_deck", 5],
  ["side delts", "lateral_raise", 5],
  ["glutes", "hip_thrust", 5],
  ["hamstrings", "romanian_deadlift", 5],
  ["pecs", "bench_press", 3],
  ["inner thigh", "hip_adduction", 3],
  ["lats", "lat_pulldown", 5],
  // Muscle + equipment
  ["dumbbell chest", "bench_press", 3, { equipment: "dumbbell" }],
  ["cable back", "seated_row", 5, { equipment: "cable" }],
  ["db shoulders", "shoulder_press", 3, { equipment: "dumbbell" }],
  ["kb legs", "goblet_squat", 10, { equipment: "kettlebell" }],
  ["bodyweight chest", "push_up", 3, { equipment: "bodyweight" }],
  // Abbreviations, slang, other names
  ["rdl", "romanian_deadlift", 1],
  ["ohp", "overhead_press", 1],
  ["bss", "bulgarian_split_squat", 1],
  ["pec deck", "pec_deck", 1],
  ["butterfly", "pec_deck", 1],
  ["skull crusher", "skull_crusher", 1],
  ["lying triceps extension", "skull_crusher", 1],
  ["military press", "overhead_press", 1],
  ["hex bar", "deadlift", 3, { equipment: "trap_bar" }],
  ["gravitron", "pull_up", 1, { equipment: "assisted_machine" }],
  ["stairmaster", "stair_climber", 1],
  ["assault bike", "air_bike", 1],
  ["erg", "rowing_machine", 1],
  ["baithak", "hindu_squat", 1],
  ["dand", "hindu_push_up", 1],
  ["surya namaskar", "surya_namaskar", 1],
  ["mudgar", "gada_swing", 1],
  ["prowler", "sled_push", 1],
  ["12-3-30", "treadmill_walk", 1, { equipment: "cardio_machine", angle: "incline" }],
  // Partial typing, word order
  ["bulg", "bulgarian_split_squat", 3],
  ["incl db", "bench_press", 3, { equipment: "dumbbell", angle: "incline" }],
  ["press bench", "bench_press", 3],
  ["curl hammer", "hammer_curl", 1],
  // loadmuscle names the user checked against (2026-10-21)
  ["cable standing neutral grip fly", "cable_crossover", 1, { equipment: "cable" }],
  ["cable kneeling high to low fly", "high_to_low_cable_fly", 1],
  ["cable standing chest press", "chest_press", 1, { equipment: "cable" }],
  ["dumbbell standing arms rotate", "pronation_supination", 1],
  ["smith leg press", "leg_press", 1, { equipment: "smith_machine" }],
];

/**
 * Cases that fail with no ranking rule to fix them (user, 2026-10-27: report,
 * don't tune the ranking to the table).
 * - "rear delts": Reverse Pec Deck ranks 6th. It ties at 10 with Band
 *   Pull-Apart (rear delts first, isolation, strength), sorted by name, and has
 *   one version, so no staple. The research's hand-picked staple list ranked it
 *   in; the version-count proxy does not. Face Pull, Rear Delt Row, Rear Delt
 *   Fly and Y Raise score higher
 */
const KNOWN_FAILING = new Set(["rear delts"]);

// Name-word accidents that must not come back.
const NOT_IN_TOP: Array<[query: string, movementId: string, topN: number]> = [
  ["chest", "chest_supported_row", 40],
  ["chest", "chest_to_bar_pull_up", 40],
  ["rdl", "hurdle_hop", 50],
  ["abs", "couch_stretch", 200],
];

describe("searchExercises: the prototype's 91 cases", () => {
  // Every row padded to 4 cells: with 3, Jest passes its `done` callback as `pre`.
  const rows = CASES.map(([q, id, n, pre]) => [q, id, n, pre ?? null] as const);
  const check = (query: string, movementId: string, topN: number, pre: VersionPick | null) => {
    const results = top(query, topN);
    const hit = results.find((r) => idOf(r) === movementId);
    expect(results.map(idOf)).toContain(movementId);
    if (pre && hit?.kind === "movement") expect(hit.preselect).toEqual(pre);
  };
  test.each(rows.filter(([q]) => !KNOWN_FAILING.has(q)))("%s → %s in top %i", check);
  // Fails today; `test.failing` goes red the day it passes, so it gets moved back.
  test.failing.each(rows.filter(([q]) => KNOWN_FAILING.has(q)))("KNOWN FAILING: %s → %s in top %i", check);

  test.each(NOT_IN_TOP)("%s does not return %s in top %i", (query, movementId, topN) => {
    expect(ids(query, topN)).not.toContain(movementId);
  });
});

describe("searchExercises: rules", () => {
  test('"machine" is not the Smith machine; "smith" is', () => {
    expect(top("machine squat").find((r) => idOf(r) === "squat")).toBeUndefined();
    const smith = top("smith squat").find((r) => idOf(r) === "squat");
    expect(smith?.kind === "movement" && smith.preselect).toEqual({ equipment: "smith_machine" });
  });

  test('"back" ranks Low-Bar Back Squat by its muscles, not by "Back" in its name', () => {
    // Listed, far down, for its secondary lower back (1), never as a name match (10).
    const squat = top("back", 500).find((r) => idOf(r) === "low_bar_back_squat");
    expect(squat?.score).toBe(1);
  });

  test('"push day" and "leg day" drop the filler; "upper body" is a region', () => {
    expect(ids("push day", 500)).toEqual(ids("push", 500));
    expect(ids("leg day", 500)).toEqual(ids("legs", 500));
    expect(ids("upper body", 500)).toContain("bench_press");
    expect(ids("upper body", 500)).not.toContain("squat");
  });

  test("an axis the movement lacks is a name word, and is not preselected", () => {
    const lunge = top("reverse lunge db").find((r) => idOf(r) === "reverse_lunge");
    expect(lunge?.kind === "movement" && lunge.preselect).toEqual({ equipment: "dumbbell" });
  });

  test("a named combination that does not exist preselects nothing", () => {
    // Bench press has band and incline versions, but no band incline one.
    const bench = top("band incline bench").find((r) => idOf(r) === "bench_press");
    expect(bench?.kind === "movement" && bench.preselect).toEqual({});
  });
});

describe("search words: labels derived, slang loaded", () => {
  test("labels work with no search words loaded; slang needs them", () => {
    const bare = buildSearchCatalog(CATALOG, null);
    const find = (q: string) => searchExercises(bare, q, 5).results.map(idOf);
    expect(find("upper chest")).toContain("bench_press"); // a muscle label
    expect(find("smith squat")).toContain("squat"); // an equipment label
    // Slang, not loaded: "pecs" is only a word, matching names ("Pec Deck").
    expect(find("pecs")).not.toContain("bench_press");
    expect(ids("pecs", 5)).toContain("bench_press");
  });
});

describe("searchExercises: custom exercises from plans", () => {
  const custom: Exercise = { id: "my_hack_thing", name: "Hack Thing Chest", fields: [] };
  const catalogExercise: Exercise = { id: "bench_press__barbell", name: "", nameSnapshot: "Bench Press · Barbell", fields: [] };
  const plans = [{ exercises: [custom, catalogExercise] }, { exercises: [custom] }];

  test("one per id, catalog exercises left to their movement", () => {
    expect(customExercisesFromPlans(plans)).toEqual([custom]);
  });

  test("found by name words only, with no muscle data", () => {
    const withCustom = buildSearchCatalog(CATALOG, SEARCH_WORDS, customExercisesFromPlans(plans));
    const find = (q: string) => searchExercises(withCustom, q, 500).results.map(idOf);
    expect(find("hack thing")).toContain("my_hack_thing");
    expect(find("chest")).toContain("my_hack_thing"); // "Chest" is in its name
    expect(find("triceps")).not.toContain("my_hack_thing");
  });
});

describe("staple: a proxy for the lifts people mean", () => {
  test("a movement with more versions wins a tie", () => {
    const one = (id: string, versions: number): Movement => ({
      id,
      name: "Zz Press",
      primaryMuscles: ["chest"],
      secondaryMuscles: [],
      category: "strength",
      mechanic: "compound",
      aliases: [],
      versions: Array.from({ length: versions }, (_, i) => ({
        id: `${id}__v${i}`,
        equipment: "barbell",
        unilateral: false,
        measure: "weight_reps",
        fields: [],
        aliases: [],
      })),
    });
    const tiny = buildSearchCatalog([one("a_single", 1), one("b_multi", 2)], null);
    expect(searchExercises(tiny, "zz", 2).results.map(idOf)).toEqual(["b_multi", "a_single"]);
  });
});
