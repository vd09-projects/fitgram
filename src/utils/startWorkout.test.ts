import { buildExercise, buildWorkout } from "../test/fixtures";
import { StoredSetFields, WorkoutSessionDoc } from "../types/workoutSession";
import { ExerciseField, WorkoutPlan } from "../types/workoutType";
import { PendingUpload } from "../types/zustandWorkoutType";
import { buildSessionDocs, computeSessionTotalVolume } from "./exerciseStats";
import {
  buildPlanRows,
  formatSince,
  formatVolume,
  groupPlanRows,
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
const PLATES: ExerciseField[] = [
  { name: "Weight", role: "weight", unit: "plates" },
  { name: "Reps", role: "reps" },
];

const set = (weight: string, reps: string) => ({ Weight: weight, Reps: reps });
/** One-segment stored sets, unmarked (TICKET-055). */
const stored = (...values: StoredSetFields[]) => values.map((v) => ({ segments: [v], effort: null }));

describe("computeSessionTotalVolume", () => {
  it("sums weighted exercises and excludes a plank without failing the total", () => {
    const volume = computeSessionTotalVolume([
      { fields: KG, sets: stored(set("60", "8"), set("60", "8")) },
      { fields: PLANK, sets: stored({ Time: "60" }) },
      { fields: KG, sets: stored(set("20", "10")) },
    ]);
    expect(volume).toEqual({
      totals: [{ unit: "kg", value: 60 * 8 * 2 + 20 * 10 }],
      unavailableReason: null,
      exercisesCounted: 2,
      exercisesWeighted: 2,
      exercisesTotal: 3,
    });
  });

  it("is null, not a partial sum, when one exercise has an unparseable set", () => {
    const volume = computeSessionTotalVolume([
      { fields: KG, sets: stored(set("60", "8")) },
      { fields: KG, sets: stored(set("20", "")) },
    ]);
    expect(volume.totals).toEqual([]);
    expect(volume.unavailableReason).toBe("unparseable");
    expect(volume.exercisesCounted).toBe(1);
  });

  it("keeps one total per unit, never converted, in exercise order", () => {
    const volume = computeSessionTotalVolume([
      { fields: PLATES, sets: stored(set("5", "12")) },
      { fields: KG, sets: stored(set("60", "8")) },
      { fields: LB, sets: stored(set("20", "10")) },
      { fields: NO_UNIT, sets: stored(set("10", "10")) },
      { fields: KG, sets: stored(set("20", "10")) },
    ]);
    expect(volume.totals).toEqual([
      { unit: "plates", value: 60 },
      { unit: "kg", value: 680 },
      { unit: "lb", value: 200 },
      { unit: null, value: 100 },
    ]);
    expect(volume.unavailableReason).toBeNull();
  });

  it("is written onto the session doc by buildSessionDocs", () => {
    const workout = buildWorkout(["Bench Press"]);
    workout.exercises[0].sets = [{ id: 1, segments: [set("60", "8")] }];
    expect(buildSessionDocs(workout, workout.startTime + 1).session.volume?.totals).toEqual([
      { unit: "kg", value: 480 },
    ]);
  });

  it("reports no_weighted_exercises when every exercise lacks a weight+reps pair", () => {
    const volume = computeSessionTotalVolume([{ fields: PLANK, sets: stored({ Time: "60" }) }]);
    expect(volume.totals).toEqual([]);
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
      totals: value === null ? [] : [{ unit: "kg", value }],
      unavailableReason: value === null ? "unparseable" : null,
      exercisesCounted: 1,
      exercisesWeighted: 1,
      exercisesTotal: 1,
    },
  });

  const pending = (uid: string, workoutId: string, startTime: number): PendingUpload => {
    const workout = buildWorkout(["Bench Press"], { id: workoutId, startTime });
    workout.exercises[0].sets = [{ id: 1, segments: [set("50", "10")] }];
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
    expect(rows.map((r) => [r.id, r.exerciseCount, r.lastDoneAt, r.volume?.totals[0]?.value ?? null])).toEqual([
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
    expect(rows[0].volume?.totals).toEqual([{ unit: "kg", value: 50 * 10 }]);
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
    expect(rows.map((r) => r.id)).toEqual(["pull", "push"]);
  });

  // TICKET-061: last done first; undated plans after, A–Z, never document order.
  it("sorts by last done, newest first, then undated plans A–Z", () => {
    const abs = plan("abs", "abs");
    const rows = buildPlanRows([legs, push, abs, pull], [session("pull", 100), session("legs", 300)], [], "me", "");
    expect(rows.map((r) => r.id)).toEqual(["legs", "pull", "abs", "push"]);
  });

  it("hides archived plans from results until shown, counting the matches", () => {
    const old = { ...plan("old", "Push v1"), archived: true };
    const rows = buildPlanRows([push, old, pull], [], [], "me", "push");
    expect(groupPlanRows(rows, false)).toMatchObject({ archived: [], hiddenArchived: 1 });
    expect(groupPlanRows(rows, false).plans.map((r) => r.id)).toEqual(["push"]);
    expect(groupPlanRows(rows, true).archived.map((r) => r.id)).toEqual(["old"]);
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
    expect(text(volume([{ fields: KG, sets: stored(set("1000", "5")) }, { fields: PLANK, sets: stored({ Time: "60" }) }]))).toBe(
      "5,000 kg · 1 not weighted"
    );
    expect(text(volume([{ fields: KG, sets: stored(set("60", "8")) }, { fields: PLATES, sets: stored(set("5", "23")) }]))).toBe(
      "480 kg · 115 plates"
    );
    expect(text(volume([{ fields: KG, sets: stored(set("60", "8")) }, { fields: KG, sets: stored(set("", "10")) }]))).toBe(
      "volume n/a · 1 of 2 lifts readable"
    );
    expect(text(null)).toBe("volume not recorded");
    // Stored before TICKET-044, as a single value and unit.
    expect(text({ value: 480, unit: "kg" } as unknown as ReturnType<typeof volume>)).toBe("volume not recorded");
    expect(text(null, false)).toBe("");
  });
});
