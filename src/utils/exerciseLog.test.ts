import { averageWeight, exerciseLog, rowCells, rowUnit, unitBreakText } from "./exerciseLog";
import type { RailWorkout } from "./historyRail";
import type { LiftRecord } from "../types/workoutSession";

const kg = [
  { name: "Weight", role: "weight", unit: "kg" },
  { name: "Reps", role: "reps" },
] as LiftRecord["fields"];
const lb = [
  { name: "Weight", role: "weight", unit: "lb" },
  { name: "Reps", role: "reps" },
] as LiftRecord["fields"];
const timed = [{ name: "Time", role: "time", unit: "s" }] as unknown as LiftRecord["fields"];

const set = (weight: number | string, reps = 8) => ({ segments: [{ Weight: weight, Reps: reps }], effort: null });
const lift = (id: string, sets: LiftRecord["sets"], fields = kg): LiftRecord => ({ id, name: id, fields, sets, verdict: null, reason: "pending" });

let n = 0;
const workout = (
  startedAt: number,
  lifts: LiftRecord[],
  extra: Partial<RailWorkout["session"]> = {},
  state: RailWorkout["state"] = "uploaded"
): RailWorkout => ({
  state,
  session: {
    sessionId: `s${n++}`,
    workoutId: "push",
    workoutName: "Push",
    startedAt,
    endedAt: startedAt + 1,
    exerciseIds: lifts.map((l) => l.id),
    lifts,
    ...extra,
  },
});

describe("averageWeight", () => {
  it("is the mean of the set weights, a drop set counting its first weight, and says why when it cannot be", () => {
    const drop = { segments: [{ Weight: 60, Reps: 5 }, { Weight: 40, Reps: 5 }], effort: null };
    expect(averageWeight(lift("bench", [set(60), set(55), drop]))).toEqual({ kind: "value", value: (60 + 55 + 60) / 3, unit: "kg" });
    // One set that does not parse: no number at all, never the mean of the other two.
    expect(averageWeight(lift("bench", [set(60), set(""), set(55)]))).toEqual({ kind: "none", reason: "unreadable" });
    expect(averageWeight(lift("run", [{ segments: [{ Time: 600 }], effort: null }], timed))).toEqual({ kind: "none", reason: "no_weight" });
    expect(averageWeight(lift("bench", []))).toEqual({ kind: "none", reason: "no_sets" });
  });
});

describe("exerciseLog", () => {
  it("lists the lift newest first across workouts, once per workout held twice, and keeps both slots of one workout", () => {
    const older = workout(1_000, [lift("bench", [set(60)])]);
    const newer = workout(2_000, [lift("bench", [set(62.5)]), lift("fly", [set(10)]), lift("bench", [set(50)])]);
    const log = exerciseLog([older, newer, { ...newer, state: "waiting" }], "bench");
    const entries = log.segments.flatMap((s) => s.entries);
    expect(entries.map((e) => [e.startedAt, e.average.kind === "value" ? e.average.value : null, e.state])).toEqual([
      [2_000, 62.5, "uploaded"],
      [2_000, 50, "uploaded"],
      [1_000, 60, "uploaded"],
    ]);
    expect(new Set(entries.map((e) => e.key)).size).toBe(3);
  });

  it("starts a new segment where the weight unit changes, and not between two lifts with no weight", () => {
    const log = exerciseLog(
      [workout(3_000, [lift("fly", [set(40)], lb)]), workout(2_000, [lift("fly", [set(15)], kg)]), workout(1_000, [lift("fly", [set(15)], kg)])],
      "fly"
    );
    expect(log.segments.map((s) => [s.unit, s.entries.length])).toEqual([["lb", 1], ["kg", 2]]);
    expect(unitBreakText("kg")).toBe("Before this the sets were in kg, so they are not compared");

    const run = (t: number) => workout(t, [lift("run", [{ segments: [{ Time: 60 }], effort: null }], timed)]);
    expect(exerciseLog([run(2_000), run(1_000)], "run").segments).toHaveLength(1);
  });

  it("counts a workout that did the lift but could not be read, instead of dropping it", () => {
    const unreadable = workout(2_000, [], { exerciseIds: ["bench"], liftsUnreadable: true });
    const other = workout(3_000, [], { exerciseIds: ["squat"], liftsUnreadable: true });
    const log = exerciseLog([unreadable, other, workout(1_000, [lift("bench", [set(60)])])], "bench");
    expect(log.unreadable).toBe(1);
    expect(log.segments.flatMap((s) => s.entries)).toHaveLength(1);
  });

  it("writes a set without its unit when it has a weight and reps, and keeps the unit when it has neither", () => {
    const drop = { segments: [{ Weight: 60, Reps: 5 }, { Weight: 52.5, Reps: 3 }], effort: null };
    const bench = exerciseLog([workout(2_000, [lift("bench", [set(62.5, 8), drop])])], "bench").segments[0].entries[0];
    expect(bench.sets.map((s) => s.text)).toEqual(["62.5 × 8", "60 × 5"]);
    expect(bench.sets[1].split).toEqual(["52.5 × 3"]);
    const run = exerciseLog([workout(1_000, [lift("run", [{ segments: [{ Time: 600 }], effort: null }], timed)])], "run").segments[0].entries[0];
    expect(run.sets[0].text).toContain("600");
    expect(run.sets[0].text).toContain("s");
  });

  it("writes a symbol unit beside a row's average and leaves a word unit to the figure", () => {
    expect([rowUnit("kg"), rowUnit("lb"), rowUnit("plates")]).toEqual(["kg", "lb", null]);
  });

  it("shapes the table by the newest session, with the rest of an older row's sets counted under +N", () => {
    const log = exerciseLog(
      [workout(2_000, [lift("bench", [set(60), set(60), set(55)])]), workout(1_000, [lift("bench", [set(60), set(60), set(60), set(57.5), set(55)])])],
      "bench"
    );
    expect(log.columns).toBe(3);
    const [, older] = log.segments[0].entries;
    expect(rowCells(older.sets, log.columns).more).toBe(2);
    expect(rowCells(older.sets.slice(0, 1), log.columns).cells.map((c) => c === null)).toEqual([false, true, true]);
    expect(exerciseLog([], "bench")).toEqual({ segments: [], columns: 0, unreadable: 0 });
  });
});
