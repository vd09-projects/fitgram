import { buildExercise, buildStats, buildWorkout } from "../test/fixtures";
import { WorkoutSessionDoc } from "../types/workoutSession";
import { ExerciseField, WorkoutPlan } from "../types/workoutType";
import { PendingUpload } from "../types/zustandWorkoutType";
import { deriveExerciseHistory } from "./exerciseHistory";
import { buildSessionDocs, computeSessionTotalVolume } from "./exerciseStats";
import {
  buildPlanRows,
  formatSince,
  formatTopSet,
  formatVolume,
  lastTopSet,
  partsToString,
} from "./startWorkout";

const KG: ExerciseField[] = [
  { name: "Weight", role: "weight", unit: "kg" },
  { name: "Reps", role: "reps" },
];
const LB: ExerciseField[] = [
  { name: "Weight", role: "weight", unit: "lb" },
  { name: "Reps", role: "reps" },
];
const NO_UNIT: ExerciseField[] = [
  { name: "Weight", role: "weight" },
  { name: "Reps", role: "reps" },
];
const PLANK: ExerciseField[] = [{ name: "Time", role: "other" }];

const set = (weight: string, reps: string) => ({ Weight: weight, Reps: reps });

describe("computeSessionTotalVolume", () => {
  it("sums weighted exercises and excludes a plank without failing the total", () => {
    const volume = computeSessionTotalVolume([
      { fields: KG, sets: [set("60", "8"), set("60", "8")] },
      { fields: PLANK, sets: [{ Time: "60" }] },
      { fields: KG, sets: [set("20", "10")] },
    ]);
    expect(volume).toEqual({
      value: 60 * 8 * 2 + 20 * 10,
      unit: "kg",
      unavailableReason: null,
      exercisesCounted: 2,
      exercisesWeighted: 2,
      exercisesTotal: 3,
    });
  });

  it("is null, not a partial sum, when one exercise has an unparseable set", () => {
    const volume = computeSessionTotalVolume([
      { fields: KG, sets: [set("60", "8")] },
      { fields: KG, sets: [set("20", "")] },
    ]);
    expect(volume.value).toBeNull();
    expect(volume.unavailableReason).toBe("unparseable");
    expect(volume.exercisesCounted).toBe(1);
  });

  it.each([
    ["kg and lb", LB],
    ["kg and no unit", NO_UNIT],
  ])("is null for mixed units: %s", (_label, otherFields) => {
    const volume = computeSessionTotalVolume([
      { fields: KG, sets: [set("60", "8")] },
      { fields: otherFields, sets: [set("20", "10")] },
    ]);
    expect(volume.value).toBeNull();
    expect(volume.unavailableReason).toBe("mixed_units");
  });

  it("is written onto the session doc by buildSessionDocs", () => {
    const workout = buildWorkout(["Bench Press"]);
    workout.exercises[0].sets = [{ id: 1, fields: set("60", "8") }];
    expect(buildSessionDocs(workout, workout.startTime + 1).session.volume?.value).toBe(480);
  });

  it("reports no_weighted_exercises when every exercise lacks a weight+reps pair", () => {
    const volume = computeSessionTotalVolume([{ fields: PLANK, sets: [{ Time: "60" }] }]);
    expect(volume.value).toBeNull();
    expect(volume.unavailableReason).toBe("no_weighted_exercises");
  });
});

describe("buildPlanRows", () => {
  const plan = (id: string, name: string, exerciseNames: string[] = ["Bench Press"]): WorkoutPlan => ({
    id,
    name,
    exercises: exerciseNames.map((n) => buildExercise(n)),
  });
  const push = plan("push", "Push", ["Bench Press", "Overhead Press"]);
  const pull = plan("pull", "Pull");
  const legs = plan("legs", "Legs");

  const session = (workoutId: string, startedAt: number, value: number | null = 1000): WorkoutSessionDoc => ({
    sessionId: `${workoutId}_${startedAt}`,
    workoutId,
    workoutName: workoutId,
    startedAt,
    endedAt: startedAt + 3600_000,
    exerciseIds: [],
    rollupPending: false,
    volume: {
      value,
      unit: "kg",
      unavailableReason: value === null ? "unparseable" : null,
      exercisesCounted: 1,
      exercisesWeighted: 1,
      exercisesTotal: 1,
    },
  });

  const pending = (uid: string, workoutId: string, startTime: number): PendingUpload => {
    const workout = buildWorkout(["Bench Press"], { id: workoutId, startTime });
    workout.exercises[0].sets = [{ id: 1, fields: set("50", "10") }];
    return {
      sessionId: `${workoutId}_${startTime}`,
      uid,
      workout,
      endedAt: startTime + 3600_000,
      failedAttempts: 0,
      lastError: null,
    };
  };

  it("takes the newest session per plan, its volume, and leaves plans outside the window without a date", () => {
    const rows = buildPlanRows(
      [push, pull, legs],
      [session("push", 300, 2000), session("pull", 200), session("push", 100, 500)],
      [],
      "me",
      ""
    );
    expect(rows.map((r) => [r.id, r.exerciseCount, r.lastDoneAt, r.volume?.value ?? null])).toEqual([
      ["push", 2, 300, 2000],
      ["pull", 1, 200, 1000],
      ["legs", 1, null, null],
    ]);
  });

  it("lets this user's newer pending upload win, with its own volume; other accounts are ignored", () => {
    const rows = buildPlanRows(
      [push, pull],
      [session("push", 100, 9999), session("pull", 100)],
      [pending("me", "push", 500), pending("someone-else", "pull", 900)],
      "me",
      ""
    );
    expect(rows[0]).toMatchObject({ lastDoneAt: 500, lastDoneSource: "pending" });
    expect(rows[0].volume?.value).toBe(50 * 10);
    expect(rows[1]).toMatchObject({ lastDoneAt: 100, lastDoneSource: "uploaded" });
  });

  it("prefers the uploaded copy when the same session is in both places", () => {
    const [row] = buildPlanRows([push], [session("push", 500)], [pending("me", "push", 500)], "me", "");
    expect(row.lastDoneSource).toBe("uploaded");
  });

  it("gives no plan a date while sessions are unknown, pending entries included", () => {
    const [row] = buildPlanRows([push], null, [pending("me", "push", 500)], "me", "");
    expect(row.lastDoneAt).toBeNull();
    expect(row.volume).toBeNull();
  });

  it("filters by name, case- and whitespace-insensitively", () => {
    const rows = buildPlanRows([push, pull, legs], [], [], "me", "  PU ");
    expect(rows.map((r) => r.id)).toEqual(["push", "pull"]);
  });
});

describe("lastTopSet", () => {
  const historyFor = (fields: ExerciseField[], sets: Record<string, string>[], currentFields?: ExerciseField[]) => {
    const stats = buildStats("Bench Press", [{ fields, sets }]);
    return deriveExerciseHistory(
      { exerciseId: stats.exerciseId, status: "ready", stats, fetchedAt: 0, error: null },
      currentFields
    );
  };

  it("picks the heaviest set of the last session, ties going to more reps", () => {
    const top = lastTopSet(historyFor(KG, [set("60", "8"), set("70", "5"), set("70", "6"), set("", "10")]));
    expect(top).toEqual({ kind: "set", weight: 70, reps: 6, unit: "kg", setNumber: 3 });
  });

  it("shows a timed or reps-only exercise's best on its first measured field", () => {
    const TIMED: ExerciseField[] = [{ name: "Total Time (min)", role: "time", unit: "min" }];
    const REPS_ONLY: ExerciseField[] = [{ name: "Reps", role: "reps" }];
    const top = (fields: ExerciseField[], sets: Record<string, string>[], current?: ExerciseField[]) =>
      partsToString(formatTopSet(lastTopSet(historyFor(fields, sets, current))));

    expect(top(TIMED, [{ "Total Time (min)": "1" }, { "Total Time (min)": "1.5" }, { "Total Time (min)": "1.2" }])).toBe(
      "1.5 min"
    );
    expect(top(REPS_ONLY, [{ Reps: "15" }, { Reps: "20" }])).toBe("20 reps");
    expect(
      lastTopSet(historyFor(TIMED, [{ "Total Time (min)": "1" }], [{ name: "Total Time (min)", role: "time", unit: "s" }]))
    ).toEqual({ kind: "none", reason: "unit_changed" });
  });

  it("reports why there is no number instead of returning one", () => {
    expect(lastTopSet(historyFor(PLANK, [{ Time: "60" }]))).toEqual({ kind: "none", reason: "no_numeric_pair" });
    expect(lastTopSet(historyFor(LB, [set("100", "5")], KG))).toEqual({ kind: "none", reason: "unit_changed" });
    expect(lastTopSet(deriveExerciseHistory(undefined))).toEqual({ kind: "none", reason: "no_history" });
  });
});

describe("formatSince", () => {
  const at = (day: number, hour: number) => new Date(2026, 9, day, hour).getTime();

  const since = (time: number, now: number) => partsToString(formatSince(time, now));

  it("counts local calendar days, not 24-hour blocks", () => {
    expect(since(at(19, 23), at(20, 8))).toBe("yesterday");
    expect(since(at(20, 1), at(20, 23))).toBe("today");
    expect(since(at(21, 9), at(20, 8))).toBe("today");
    expect(since(at(1, 9), at(20, 8))).toBe("2 weeks ago");
  });
});

describe("formatVolume", () => {
  const volume = computeSessionTotalVolume;
  const text = (v: ReturnType<typeof volume> | null, hasSession = true) =>
    partsToString(formatVolume(v, hasSession));

  it("says why a session has no figure, and shows an excluded plank", () => {
    expect(text(volume([{ fields: KG, sets: [set("1000", "5")] }, { fields: PLANK, sets: [{ Time: "60" }] }]))).toBe(
      "5,000 kg · 1 not weighted"
    );
    expect(text(volume([{ fields: KG, sets: [set("60", "8")] }, { fields: LB, sets: [set("20", "10")] }]))).toBe(
      "volume n/a · mixed units"
    );
    expect(text(volume([{ fields: KG, sets: [set("60", "8")] }, { fields: KG, sets: [set("", "10")] }]))).toBe(
      "volume n/a · 1 of 2 lifts readable"
    );
    expect(text(null)).toBe("volume not recorded");
    expect(text(null, false)).toBe("");
  });
});
