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
  maxTypoEdits,
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

// Stage 2: the ticket's failing table (measured 2026-10-23 on the prototype),
// one case per row. Top 1 only where the query, corrected or joined, is the
// movement's exact name; otherwise top 3.
const TYPO_CASES: Case[] = [
  ["Latpulldown", "lat_pulldown", 1], // joined
  ["push down", "triceps_pushdown", 3], // split
  ["kick back", "triceps_kickback", 3],
  ["kick back", "glute_kickback", 3],
  ["Incliend", "bench_press", 3, { angle: "incline" }],
  ["squad", "squat", 1],
  ["bech press", "bench_press", 1],
  ["dumbell curl", "bicep_curl", 3, { equipment: "dumbbell" }],
  ["low to high fly", "low_to_high_cable_fly", 1],
  // Beyond the table: a swap counts as one edit, and a typo while still typing
  ["bnech press", "bench_press", 1],
  ["dumbe bench", "bench_press", 3, { equipment: "dumbbell" }],
];

describe("stage 2: typos, joined and split words", () => {
  test.each(TYPO_CASES.map(([q, id, n, pre]) => [q, id, n, pre ?? null] as const))("%s → %s in top %i", (query, movementId, topN, pre) => {
    const results = top(query, topN);
    const hit = results.find((r) => idOf(r) === movementId);
    expect(results.map(idOf)).toContain(movementId);
    if (pre && hit?.kind === "movement") expect(hit.preselect).toEqual(pre);
  });

  test('"Cabled" is the cable: every result has a cable version, preselected', () => {
    const results = top("Cabled", 500);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) expect(r.kind === "movement" && r.preselect.equipment).toBe("cable");
  });

  test("word order: Low-to-High above High-to-Low for \"low to high fly\"", () => {
    const order = ids("low to high fly");
    expect(order.indexOf("low_to_high_cable_fly")).toBeLessThan(order.indexOf("high_to_low_cable_fly"));
  });

  // Pinned to the movement baselines recorded at the end of stage 1.
  test.each([
    ["row", 19, ["bent_over_row", "chest_supported_row", "rear_delt_row", "seal_row", "seated_row"]],
    ["curl", 27, ["bicep_curl", "floor_hamstring_curl", "hammer_curl", "lying_leg_curl", "preacher_curl"]],
  ] as const)('"%s" keeps its %i results and top 5, none fuzzy', (query, total, top5) => {
    const found = searchExercises(catalog, query, 500);
    expect(found.total).toBe(total);
    expect(found.results.slice(0, 5).map(idOf)).toEqual(top5);
    expect(found.results.some((r) => r.fuzzy)).toBe(false);
  });

  test("short words stay exact: 1–3 letters get no edits", () => {
    expect(maxTypoEdits(3)).toBe(0);
    expect(ids("rwo")).toEqual([]); // "row" mistyped: not corrected
  });

  test("a fuzzy match ranks below an exact or prefix match, even with a higher score", () => {
    const movement = (id: string, name: string, versions: number): Movement => ({
      id,
      name,
      primaryMuscles: ["triceps"],
      secondaryMuscles: [],
      category: "strength",
      mechanic: "isolation",
      aliases: [],
      versions: Array.from({ length: versions }, (_, i) => ({
        id: `${id}__v${i}`,
        equipment: "cable",
        unilateral: false,
        measure: "weight_reps",
        fields: [],
        aliases: [],
      })),
    });
    // "down" matches no word here, so it is corrected to "dowm" (1 edit).
    // Push Dowm scores higher (two words, order, staple) but only by the typo;
    // Pushdown matches exactly, as split words.
    const tiny = buildSearchCatalog([movement("push_dowm", "Push Dowm", 2), movement("pushdown", "Pushdown", 1)], null);
    const results = searchExercises(tiny, "push down", 5).results;
    expect(results.map(idOf)).toEqual(["pushdown", "push_dowm"]);
    expect(results.map((r) => r.fuzzy)).toEqual([false, true]);
    expect(results[1].score).toBeGreaterThan(results[0].score);
  });
});
