import {
  buildSetFields,
  ghostNotice,
  ghostValues,
  missingFields,
  missingFieldsMessage,
  repeatValues,
  resolveGhostTarget,
  stepFieldValue,
  stepSizeFor,
  withUnlistedFields,
} from "./setLogger";
import { deriveExerciseHistory } from "./exerciseHistory";
import { buildExercise, buildStats } from "../test/fixtures";
import { ExerciseStatsDoc } from "../types/workoutSession";
import { ExerciseField } from "../types/workoutType";

const KG: ExerciseField = { name: "Weight", role: "weight", unit: "kg" };
const LB: ExerciseField = { name: "Weight", role: "weight", unit: "lb" };
const REPS: ExerciseField = { name: "Reps", role: "reps" };
const PLANK: ExerciseField[] = [
  { name: "Time", role: "time", unit: "s" },
  { name: "Notes", role: "other" },
];

/** What the hook returns once `stats` is cached, logged today with `fields`. */
const historyOf = (stats: ExerciseStatsDoc | null, fields: ExerciseField[] = [KG, REPS]) =>
  deriveExerciseHistory(
    { exerciseId: "bench-press", status: "ready", stats, fetchedAt: 0, error: null },
    fields
  );

const fourSets = buildStats("Bench Press", [
  {
    sets: [
      { Weight: "60", Reps: "8" },
      { Weight: "62.5", Reps: "8" },
      { Weight: "62.5", Reps: "7" },
      { Weight: "60", Reps: "6" },
    ],
  },
]);

describe("stepFieldValue", () => {
  it("steps weight by plate pair per unit and reps by 1", () => {
    expect(stepFieldValue(KG, "60", 1, null)).toBe("62.5");
    expect(stepFieldValue(LB, "135", 1, null)).toBe("140");
    expect(stepFieldValue(REPS, "8", -1, null)).toBe("7");
  });

  it("gives no stepper to a unitless weight or a non weight/reps field", () => {
    expect(stepSizeFor({ name: "Weight", role: "weight" })).toBeNull();
    expect(stepFieldValue(PLANK[0], "30", 1, null)).toBeNull();
  });

  it("steps an empty field from its ghost, or from 0 without one", () => {
    expect(stepFieldValue(KG, "", 1, 60)).toBe("62.5");
    expect(stepFieldValue(KG, "", -1, 60)).toBe("57.5");
    expect(stepFieldValue(REPS, "  ", 1, null)).toBe("1");
  });

  it("refuses rather than writing 0: below zero, or unparseable text", () => {
    expect(stepFieldValue(REPS, "", -1, null)).toBeNull();
    expect(stepFieldValue(KG, "1", -1, null)).toBeNull();
    expect(stepFieldValue(KG, "abc", 1, null)).toBeNull();
  });

  it("writes back without float noise", () => {
    // 0.28 + 2.5 is 2.7800000000000002 in floating point.
    expect(stepFieldValue(KG, "0.28", 1, null)).toBe("2.78");
    expect(stepFieldValue(KG, "57.5", 1, null)).toBe("60");
  });
});

describe("resolveGhostTarget", () => {
  it("returns last session's set at the same 1-based number", () => {
    const target = resolveGhostTarget(historyOf(fourSets), 2);
    expect(target).toMatchObject({ kind: "available", set: { setNumber: 2, weight: 62.5, reps: 8 } });
  });

  it("separates never-prefetched from fetched-and-never-done", () => {
    expect(resolveGhostTarget(deriveExerciseHistory(undefined, [KG, REPS]), 1).kind).toBe("notLoaded");
    expect(resolveGhostTarget(historyOf(null), 1).kind).toBe("firstTime");
  });

  it("has no target past the sets last session reached", () => {
    expect(resolveGhostTarget(historyOf(fourSets), 5)).toEqual({
      kind: "setNotReached",
      lastSessionSetCount: 4,
    });
  });

  it("has no target for an exercise without a weight+reps pair", () => {
    const plank = buildStats("Plank", [{ fields: PLANK, sets: [{ Time: "60", Notes: "" }] }]);
    expect(resolveGhostTarget(historyOf(plank, PLANK), 1).kind).toBe("noComparison");
  });

  it("decides unit change by the last session alone, not the whole window", () => {
    const lbLastTime = buildStats("Bench Press", [
      { fields: [LB, REPS], sets: [{ Weight: "135", Reps: "8" }] },
      { sets: [{ Weight: "60", Reps: "8" }] },
    ]);
    expect(resolveGhostTarget(historyOf(lbLastTime), 1).kind).toBe("unitChanged");

    // An older lb session sets `unitMismatch`, but last time was kg: ghost stands.
    const lbEarlier = buildStats("Bench Press", [
      { sets: [{ Weight: "60", Reps: "8" }] },
      { fields: [LB, REPS], sets: [{ Weight: "135", Reps: "8" }] },
    ]);
    const history = historyOf(lbEarlier);
    expect(history.unitMismatch).toBe(true);
    expect(resolveGhostTarget(history, 1)).toMatchObject({ kind: "available", set: { weight: 60 } });
  });
});

describe("ghostValues and repeatValues", () => {
  it("ghosts only the weight and reps fields, null elsewhere", () => {
    const fields = [KG, REPS, { name: "RPE", role: "other" as const }];
    const history = historyOf(
      buildStats("Bench Press", [{ fields, sets: [{ Weight: "60", Reps: "8", RPE: "9" }] }]),
      fields
    );
    const ghosts = ghostValues(fields, resolveGhostTarget(history, 1), history.numericFields);
    expect(ghosts).toEqual({ Weight: 60, Reps: 8, RPE: null });
    expect(repeatValues(ghosts)).toEqual({ Weight: "60", Reps: "8" });
  });

  it("has nothing to ghost or repeat when there is no target", () => {
    const history = historyOf(fourSets);
    const ghosts = ghostValues([KG, REPS], resolveGhostTarget(history, 5), history.numericFields);
    expect(ghosts).toEqual({ Weight: null, Reps: null });
    expect(repeatValues(ghosts)).toBeNull();
  });
});

describe("missingFields", () => {
  it("names every blank measured field in definition order", () => {
    const fields = buildExercise("Bench Press").fields;
    expect(missingFields(fields, {})).toEqual(["Weight", "Reps"]);
    expect(missingFields(fields, { Weight: "60", Reps: "  " })).toEqual(["Reps"]);
    expect(missingFields(fields, { Weight: "60", Reps: "8" })).toEqual([]);
  });

  it("treats role other as optional", () => {
    expect(missingFields(PLANK, { Time: "60" })).toEqual([]);
    expect(missingFields(PLANK, { Notes: "felt easy" })).toEqual(["Time"]);
  });
});

describe("ghostNotice and missingFieldsMessage", () => {
  it("tells apart the three ways history can be unavailable", () => {
    const notLoaded = { kind: "notLoaded" } as const;
    expect(ghostNotice(notLoaded, "idle")).toBe("Last session not loaded");
    expect(ghostNotice(notLoaded, "loading")).toBe("Loading last session…");
    expect(ghostNotice(notLoaded, "error")).toBe("Couldn't load last session");
    expect(ghostNotice({ kind: "setNotReached", lastSessionSetCount: 1 }, "ready")).toBe(
      "Last time stopped at 1 set"
    );
  });

  it("names every missing field", () => {
    expect(missingFieldsMessage(["Weight", "Reps", "Time"], 2, "log")).toBe(
      "Enter Weight, Reps and Time to log set 2"
    );
  });
});

// TICKET-040: one builder for Log set and Save set.
describe("buildSetFields", () => {
  const BAND: ExerciseField[] = [KG, REPS, { name: "Band", role: "other" }];

  it("leaves a blanked optional field out, so an edit that clears it stores the set without it", () => {
    expect(buildSetFields(BAND, { Weight: " 65 ", Reps: "8", Band: "  " }, 2, "save")).toEqual({
      kind: "ok",
      fields: { Weight: "65", Reps: "8" },
    });
  });

  it("refuses a missing required field with the action's own verb", () => {
    expect(buildSetFields(BAND, { Weight: "", Reps: "8", Band: "red" }, 4, "save")).toEqual({
      kind: "refused",
      message: "Enter Weight to save set 4",
    });
    expect(buildSetFields(PLANK, {}, 1, "log")).toEqual({ kind: "refused", message: "Enter Time to log set 1" });
  });
});

describe("withUnlistedFields", () => {
  it("keeps a stored key the exercise no longer defines; listed fields come from the edit only", () => {
    expect(
      withUnlistedFields([KG, REPS], { Weight: 60, Reps: "8", Tempo: "3-1-1" }, { Weight: "65", Reps: "8" })
    ).toEqual({ Tempo: "3-1-1", Weight: "65", Reps: "8" });
  });
});
