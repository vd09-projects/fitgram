// TICKET-033-1: a split set's rows count toward volume, are stored with their
// set, and never become a record. The first segment is the set. TICKET-055:
// one record per set, `{ segments, effort }`.

import { buildExercise, buildWorkout } from "../test/fixtures";
import { ExerciseField } from "../types/workoutType";
import { ExerciseSet } from "../types/zustandWorkoutType";
import { buildSessionDocs, computeSessionVolume, rebuildStatsFromSessions } from "./exerciseStats";
import { deriveExerciseHistory } from "./exerciseHistory";
import { buildLoggedSet, keptSplitRows } from "./splits";

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
  it("counts every segment of a split set", () => {
    const sets = [
      { segments: [{ Weight: "20", Reps: "8" }] },
      { segments: [{ Weight: "20", Reps: "5" }, { Weight: "17.5", Reps: "3" }, { Weight: "15", Reps: "3" }] },
    ];
    expect(computeSessionVolume(sets, NUMERIC).value).toBe(160 + 100 + 52.5 + 45);
  });

  it("is null, not a partial sum, when a split row lacks weight or reps, or a set's segments are incomplete", () => {
    const FIRST = { Weight: "20", Reps: "5" };
    expect(computeSessionVolume([{ segments: [FIRST, { Weight: "17.5" }] }], NUMERIC)).toEqual({
      value: null,
      setsCounted: 0,
      setsTotal: 1,
    });
    expect(computeSessionVolume([{ segments: [FIRST], segmentsIncomplete: true }], NUMERIC).value).toBeNull();
  });

  it("reaches the stored session total", () => {
    const { session } = finished([
      { id: 1, segments: [{ Weight: "20", Reps: "5" }, { Weight: "17.5", Reps: "3" }] },
    ]);
    expect(session.volume?.totals).toEqual([{ unit: "kg", value: 152.5 }]);
  });
});

describe("stored shape", () => {
  it("stores each set as one record: every segment and the mark, null when unmarked", () => {
    const { exerciseSessions } = finished([
      { id: 1, segments: [{ Weight: "20", Reps: "8" }] },
      { id: 2, segments: [{ Weight: "20", Reps: "5" }, { Weight: "17.5", Reps: "3" }], effort: "hard" },
    ]);
    expect(exerciseSessions[0].sets).toEqual([
      { segments: [{ Weight: "20", Reps: "8" }], effort: null },
      { segments: [{ Weight: "20", Reps: "5" }, { Weight: "17.5", Reps: "3" }], effort: "hard" },
    ]);
    expect(Object.keys(exerciseSessions[0])).not.toContain("setSplits");
  });

  it("never lets a split row become a record", () => {
    const { exerciseSessions } = finished([
      { id: 1, segments: [{ Weight: "20", Reps: "5" }, { Weight: "40", Reps: "3" }] },
    ]);
    const stats = rebuildStatsFromSessions("bench-press", exerciseSessions);
    expect(Object.values(stats!.bestByReps).map((best) => [best.weight, best.reps])).toEqual([[20, 5]]);
  });
});

describe("reading stored rows back", () => {
  it("carries the rows from the live set through upload and the rollup into last time's volume", () => {
    const { exerciseSessions } = finished([
      { id: 1, segments: [{ Weight: "20", Reps: "5" }, { Weight: "17.5", Reps: "3" }] },
    ]);
    const history = deriveExerciseHistory({
      exerciseId: "bench-press",
      status: "ready",
      stats: rebuildStatsFromSessions("bench-press", exerciseSessions),
      fetchedAt: 0,
      error: null,
    });
    expect(history.lastSession?.volume.value).toBe(152.5);
    expect(history.setAt(1)?.segments).toEqual([{ Weight: "20", Reps: "5" }, { Weight: "17.5", Reps: "3" }]);
  });
});

describe("the set Log stores", () => {
  const FIRST = { Weight: "20", Reps: "5" };

  it("stores the card's rows as segments, one for a normal set", () => {
    expect(buildLoggedSet(KG, [FIRST], 1)).toEqual({ kind: "ok", set: { segments: [FIRST] } });
  });

  it("drops a blank last row, and refuses a half-filled one rather than drop what was typed", () => {
    // The card's "· N splits" counts these, so it matches what Log stores.
    expect(keptSplitRows(KG, [{ Weight: "17.5", Reps: "3" }, { Weight: " " }])).toHaveLength(1);
    expect(buildLoggedSet(KG, [FIRST, { Weight: "17.5", Reps: "3" }, {}], 3)).toEqual({
      kind: "ok",
      set: { segments: [FIRST, { Weight: "17.5", Reps: "3" }] },
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
