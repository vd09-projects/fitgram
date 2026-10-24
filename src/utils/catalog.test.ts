// TICKET-042 stage 1: the version id rule, the display name, the unknown-id
// fallback and the loader's refusals.

import { EXERCISE_CATALOG } from "../constants/exerciseCatalog";
import type { Movement } from "../types/catalog";
import {
  buildCatalogIndex,
  buildVersionId,
  loadCatalog,
  NOT_IN_CATALOG,
  resolveExerciseName,
  UNKNOWN_EXERCISE,
  validateCatalog,
} from "./catalog";

const both = { unilateral: false } as const;

describe("buildVersionId", () => {
  it("adds each axis in the fixed order, defaults left out", () => {
    expect(buildVersionId("bench_press", { equipment: "barbell", ...both })).toBe("bench_press__barbell");
    expect(buildVersionId("bench_press", { equipment: "dumbbell", angle: "incline", ...both })).toBe(
      "bench_press__dumbbell__incline"
    );
    expect(buildVersionId("triceps_pushdown", { equipment: "cable", attachment: "rope", ...both })).toBe(
      "triceps_pushdown__cable__rope"
    );
    expect(buildVersionId("bench_press", { equipment: "barbell", grip: "close", ...both })).toBe(
      "bench_press__barbell__close_grip"
    );
    expect(buildVersionId("lateral_raise", { equipment: "cable", unilateral: true })).toBe(
      "lateral_raise__cable__one_side"
    );
    // Every axis at once, written in a scrambled key order: the id order is fixed.
    expect(
      buildVersionId("m", { unilateral: true, grip: "reverse", attachment: "v_bar", angle: "decline", equipment: "cable" })
    ).toBe("m__cable__decline__v_bar__reverse_grip__one_side");
  });
});

describe("display names", () => {
  const index = buildCatalogIndex(EXERCISE_CATALOG);
  const name = (id: string) => resolveExerciseName(index, id).title;

  it("names the version parts, defaults left out", () => {
    expect(name("bench_press__dumbbell__incline")).toBe("Bench Press · Dumbbell, incline");
    expect(name("bench_press__barbell__close_grip")).toBe("Bench Press · Barbell, close grip");
    expect(name("bench_press__barbell")).toBe("Bench Press · Barbell");
    // Every pushdown is cable, so equipment is left out.
    expect(name("triceps_pushdown__cable__rope")).toBe("Triceps Pushdown · Rope");
    expect(name("lateral_raise__cable__one_side")).toBe("Lateral Raise · Cable, one arm");
  });

  it("a single-version movement is its name alone, even with a non-default axis", () => {
    expect(name("pec_deck__machine")).toBe("Pec Deck (Machine Fly)");
    const facePull = { ...EXERCISE_CATALOG[1], name: "Face Pull", versions: [EXERCISE_CATALOG[1].versions[0]] };
    expect(resolveExerciseName(buildCatalogIndex([facePull]), "triceps_pushdown__cable__rope").title).toBe("Face Pull");
  });

  it("an id not in the catalog shows its snapshot, marked as not current", () => {
    expect(resolveExerciseName(index, "bench_press__pause", "Pause Bench Press")).toEqual({
      title: "Pause Bench Press",
      subtitle: NOT_IN_CATALOG,
      inCatalog: false,
    });
  });

  it("with no snapshot either, says so and shows the id, never a blank", () => {
    expect(resolveExerciseName(index, "deadlifts")).toEqual({
      title: UNKNOWN_EXERCISE,
      subtitle: "deadlifts",
      inCatalog: false,
    });
    expect(resolveExerciseName(index, "deadlifts", "  ").title).toBe(UNKNOWN_EXERCISE);
  });
});

describe("loadCatalog refuses", () => {
  const valid = (): Movement => ({
    id: "row",
    name: "Row",
    primaryMuscles: ["lats"],
    secondaryMuscles: [],
    category: "strength",
    mechanic: "compound",
    aliases: [],
    versions: [
      {
        id: "row__barbell",
        equipment: "barbell",
        unilateral: false,
        measure: "weight_reps",
        fields: [
          { name: "Weight", role: "weight", unit: "kg" },
          { name: "Reps", role: "reps" },
        ],
        aliases: [],
      },
    ],
  });

  it("accepts a valid catalog, and the shipped one", () => {
    expect(loadCatalog([valid()]).kind).toBe("ok");
    expect(validateCatalog(EXERCISE_CATALOG)).toEqual([]);
  });

  // Each case breaks one thing in an otherwise valid catalog. Values arrive
  // untyped from Firestore in stage 2, hence the casts.
  it.each<[string, (catalog: Movement[]) => void, string]>([
    ["a duplicate version id", (c) => c.push({ ...valid(), id: "row2", versions: valid().versions }), "duplicate version id"],
    ["an id that does not match its axes", (c) => (c[0].versions[0].angle = "incline"), 'expected "row__barbell__incline"'],
    ["an unknown muscle", (c) => (c[0].secondaryMuscles = ["pecs" as never]), 'unknown muscle "pecs"'],
    ["an unknown equipment", (c) => (c[0].versions[0].equipment = "barbel" as never), 'unknown equipment "barbel"'],
    ["an unknown measure", (c) => (c[0].versions[0].measure = "wr" as never), 'unknown measure "wr"'],
    ["a field without a role", (c) => (c[0].versions[0].fields[1] = { name: "Reps" } as never), 'field "Reps" has no valid role'],
    ["a unit in a field name", (c) => (c[0].versions[0].fields[0].name = "Weight (kg)"), 'field "Weight (kg)" carries a unit'],
    ["an unknown unit", (c) => (c[0].versions[0].fields[0].unit = "kgs" as never), 'unknown unit "kgs"'],
    ["a movement id that is not snake case", (c) => (c[0].id = "Row Barbell"), "movement id must be lower snake case"],
    ["an empty name", (c) => (c[0].name = " "), "row: has no name"],
    ["no primary muscle", (c) => (c[0].primaryMuscles = []), "row: has no primary muscle"],
    ["missing aliases", (c) => delete (c[0] as Partial<Movement>).aliases, "row: aliases must be a list"],
    [
      "assisted with a weight field",
      (c) => (c[0].versions[0].measure = "assisted"),
      'assisted, so no field may have role "weight"',
    ],
    // Untyped Firestore JSON: refused, not thrown.
    ["versions that are not a list", (c) => (c[0].versions = {} as never), "row: has no versions"],
    ["a null field", (c) => (c[0].versions[0].fields[1] = null as never), "a field is not an object"],
    [
      "input that throws while being read",
      (c) => Object.defineProperty(c[0], "id", { get: () => { throw new Error("boom"); } }),
      "could not be read (Error: boom)",
    ],
  ])("%s", (_, breakIt, message) => {
    const catalog = [valid()];
    breakIt(catalog);
    const result = loadCatalog(catalog);
    expect(result.kind).toBe("invalid");
    expect(result.kind === "invalid" && result.errors.join("\n")).toContain(message);
  });
});
