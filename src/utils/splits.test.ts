// TICKET-033-1: a split set's rows count toward volume, are stored aligned with
// the sets, and never become a record. The first segment stays the set.

import { buildExercise, buildWorkout } from "../test/fixtures";
import { ExerciseField } from "../types/workoutType";
import { ExerciseSet } from "../types/zustandWorkoutType";
import { buildSessionDocs, computeSessionVolume, rebuildStatsFromSessions } from "./exerciseStats";
import { deriveExerciseHistory } from "./exerciseHistory";
import { buildLoggedSet, keptSplitRows, zipSetSplits } from "./splits";

const KG: ExerciseField[] = [
  { name: "Weight", role: "weight", unit: "kg" },
  { name: "Reps", role: "reps" },
];
const NUMERIC = { weight: KG[0], reps: KG[1] };

/** Bench Press finished with these sets, through a JSON round trip as the upload queue does. */
function finished(sets: ExerciseSet[]) {
  const workout = buildWorkout([], { startTime: 1_000, exercises: [buildExercise("Bench Press", { sets })] });
  return buildSessionDocs(JSON.parse(JSON.stringify(workout)), 2_000);
}

describe("volume", () => {
  it("counts every row of a split set", () => {
    const sets = [{ Weight: "20", Reps: "8" }, { Weight: "20", Reps: "5" }];
    expect(computeSessionVolume(sets, NUMERIC).value).toBe(260);
    const splits = [[], [{ Weight: "17.5", Reps: "3" }, { Weight: "15", Reps: "3" }]];
    expect(computeSessionVolume(sets, NUMERIC, splits).value).toBe(160 + 100 + 52.5 + 45);
  });

  it("is null, not a partial sum, when a split row lacks weight or reps", () => {
    const sets = [{ Weight: "20", Reps: "5" }];
    expect(computeSessionVolume(sets, NUMERIC, [[{ Weight: "17.5" }]])).toEqual({ value: null, setsCounted: 0, setsTotal: 1 });
    expect(computeSessionVolume(sets, NUMERIC, [[{ Reps: "3" }]]).value).toBeNull();
  });

  it("reaches the stored session total", () => {
    const { session } = finished([
      { id: 1, fields: { Weight: "20", Reps: "5" }, splits: [{ Weight: "17.5", Reps: "3" }] },
    ]);
    expect(session.volume?.totals).toEqual([{ unit: "kg", value: 152.5 }]);
  });
});

describe("stored shape", () => {
  it("keeps sets, setEffort and setSplits the same length, null where not split", () => {
    const { exerciseSessions } = finished([
      { id: 1, fields: { Weight: "20", Reps: "8" } },
      { id: 2, fields: { Weight: "20", Reps: "5" }, effort: "hard", splits: [{ Weight: "17.5", Reps: "3" }] },
      { id: 3, fields: { Weight: "18", Reps: "8" }, splits: [] },
    ]);
    const doc = exerciseSessions[0];
    expect(doc.sets).toHaveLength(3);
    expect(doc.setEffort).toHaveLength(3);
    expect(doc.setSplits).toEqual([null, { rows: [{ Weight: "17.5", Reps: "3" }] }, null]);
    expect(doc.sets[1]).toEqual({ Weight: "20", Reps: "5" });
  });

  it("never lets a split row become a record", () => {
    const { exerciseSessions } = finished([
      { id: 1, fields: { Weight: "20", Reps: "5" }, splits: [{ Weight: "40", Reps: "3" }] },
    ]);
    const stats = rebuildStatsFromSessions("bench-press", exerciseSessions);
    expect(Object.values(stats!.bestByReps).map((best) => [best.weight, best.reps])).toEqual([[20, 5]]);
  });
});

describe("reading stored rows back", () => {
  it("trusts no rows when setSplits and sets differ in length", () => {
    expect(zipSetSplits(2, [null])).toEqual({ rows: [null, null], unavailable: true });
  });

  it("marks one malformed entry unknown and keeps the others", () => {
    const row = { Weight: "17.5", Reps: "3" };
    expect(zipSetSplits(3, [{ rows: 5 }, [row], { rows: [row] }])).toEqual({
      rows: [null, null, [row]],
      unavailable: false,
    });
  });

  it("carries the rows from the live set through upload and the rollup into last time's volume", () => {
    const { exerciseSessions } = finished([
      { id: 1, fields: { Weight: "20", Reps: "5" }, splits: [{ Weight: "17.5", Reps: "3" }] },
    ]);
    const history = deriveExerciseHistory({
      exerciseId: "bench-press",
      status: "ready",
      stats: rebuildStatsFromSessions("bench-press", exerciseSessions),
      fetchedAt: 0,
      error: null,
    });
    expect(history.lastSession?.volume.value).toBe(152.5);
    expect(history.setAt(1)?.splits).toEqual([{ Weight: "17.5", Reps: "3" }]);
  });
});

describe("the set Log stores", () => {
  const FIRST = { Weight: "20", Reps: "5" };

  it("drops a blank last row, and refuses a half-filled one rather than drop what was typed", () => {
    // The card's "· N splits" counts these, so it matches what Log stores.
    expect(keptSplitRows(KG, [{ Weight: "17.5", Reps: "3" }, { Weight: " " }])).toHaveLength(1);
    expect(buildLoggedSet(KG, [FIRST, { Weight: "17.5", Reps: "3" }, {}], 3)).toEqual({
      kind: "ok",
      set: { fields: FIRST, splits: [{ Weight: "17.5", Reps: "3" }] },
    });
    expect(buildLoggedSet(KG, [FIRST, { Weight: "17.5", Reps: "3" }, { Weight: "15" }], 3)).toEqual({
      kind: "refused",
      message: "Split 2: Enter Reps to log set 3",
    });
    expect(buildLoggedSet(KG, [FIRST, { Weight: "", Reps: "3" }], 3)).toEqual({
      kind: "refused",
      message: "Split 1: Enter Weight to log set 3",
    });
  });
});
