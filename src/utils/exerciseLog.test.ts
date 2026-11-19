import { averageWeight, exerciseLog, limitLog, measureReason, measureText, rowCells, rowUnit, spokenSet, totalLifted, unitBreakText, valueOf } from "./exerciseLog";
import { buildStats } from "../test/fixtures";
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

describe("Total lifted, the marks and the limit (stage 4)", () => {
  const bench = (...weights: number[]) => lift("bench", weights.map((w) => set(w, 10)));

  it("totals weight × reps over every set, a drop set's later segments included, and gives no total for a set that does not parse", () => {
    const drop = { segments: [{ Weight: 60, Reps: 5 }, { Weight: 40, Reps: 5 }], effort: null };
    expect(totalLifted(lift("bench", [set(60, 8), drop]))).toEqual({ kind: "value", value: 480 + 300 + 200, unit: "kg" });
    expect(totalLifted(lift("bench", [set(60, 8), set("", 8)]))).toEqual({ kind: "none", reason: "unreadable" });
    expect(totalLifted(lift("run", [{ segments: [{ Time: 600 }], effort: null }], timed))).toEqual({ kind: "none", reason: "no_weight" });
    expect(totalLifted(lift("bench", []))).toEqual({ kind: "none", reason: "no_sets" });
  });

  it("writes a total with thousands separators and a decimal only when it has one, an average to one decimal, and picks by measure", () => {
    expect(measureText("total", 1590)).toBe("1,590");
    expect(measureText("total", 1405.5)).toBe("1,405.5");
    expect(measureText("total", 980)).toBe("980");
    expect(measureText("total", 1234567)).toBe("1,234,567");
    expect(measureText("average", 59.25)).toBe("59.3");
    const entry = exerciseLog([workout(1_000, [bench(60, 60)])], "bench").segments[0].entries[0];
    expect(valueOf(entry, "average")).toMatchObject({ value: 60 });
    expect(valueOf(entry, "total")).toMatchObject({ value: 1200 });
  });

  it("says which measure had no weight to work with, and the same for a set that could not be read", () => {
    expect(measureReason("average", "no_weight")).toBe("No weight to average");
    expect(measureReason("total", "no_weight")).toBe("No weight to total");
    expect(measureReason("total", "unreadable")).toBe("A set could not be read");
  });

  it("marks each set against the same-numbered set of the entry just older, and none on the oldest, across a unit change or where it did not change", () => {
    const log = exerciseLog(
      [workout(3_000, [bench(65, 60, 50)]), workout(2_000, [bench(60, 60, 55)]), workout(1_000, [bench(50, 50, 50)])],
      "bench"
    );
    const [newest, middle, oldest] = log.segments[0].entries;
    expect(newest.sets.map((x) => x.arrow)).toEqual(["up", null, "down"]);
    expect(middle.sets.map((x) => x.arrow)).toEqual(["up", "up", "up"]);
    expect(oldest.sets.map((x) => x.arrow)).toEqual([null, null, null]);

    const changed = exerciseLog([workout(2_000, [lift("fly", [set(100)], lb)]), workout(1_000, [lift("fly", [set(15)])])], "fly").segments[0].entries[0];
    expect(changed.sets.map((x) => x.arrow)).toEqual([null]);
  });

  it("keeps the newest sessions up to the count across unit segments, and every session for null, with the table's shape unchanged", () => {
    const log = exerciseLog(
      [workout(4_000, [lift("fly", [set(40)], lb)]), workout(3_000, [lift("fly", [set(15)])]), workout(2_000, [lift("fly", [set(15)])]), workout(1_000, [lift("fly", [set(15)])])],
      "fly"
    );
    const two = limitLog(log, 2);
    expect(two.segments.map((x) => x.entries.length)).toEqual([1, 1]);
    expect(two.segments.map((x) => x.entries[0].startedAt)).toEqual([4_000, 3_000]); // the newest of each run, not the oldest
    expect(limitLog(log, 1).segments).toHaveLength(1);
    expect(limitLog(log, null)).toBe(log);
    expect(two.columns).toBe(log.columns);
  });
});

describe("review of PR #77", () => {
  const bench = (...weights: number[]) => lift("bench", weights.map((w) => set(w, 10)));

  it("agrees with the held summaries (the ticket's proof): the same sessions in the same order, each total the volume the write path stored", () => {
    const T = (n: number) => 1_800_000_000_000 + n * 86_400_000;
    const drop = { segments: [{ Weight: 60, Reps: 5 }, { Weight: 40, Reps: 5 }] };
    const specs = [
      { performedAt: T(3), sets: [{ Weight: 62.5, Reps: 8 }, drop] },
      { performedAt: T(2), sets: [{ Weight: 60, Reps: 9 }, { Weight: 55, Reps: 10 }] },
      { performedAt: T(1), sets: [{ Weight: 57.5, Reps: 8 }] },
    ];
    const stats = buildStats("Bench", specs);
    const workouts = stats.recentSessions.map((entry) =>
      workout(entry.performedAt, [{ id: "bench", name: "Bench", fields: entry.fields, sets: entry.sets, verdict: null, reason: "pending" }])
    );
    const entries = exerciseLog(workouts, "bench").segments.flatMap((segment) => segment.entries);
    expect(entries.map((entry) => entry.startedAt)).toEqual(stats.recentSessions.map((entry) => entry.performedAt));
    expect(entries.map((entry) => (entry.total.kind === "value" ? entry.total.value : null))).toEqual(stats.recentSessions.map((entry) => entry.volume));
    expect(entries.map((entry) => entry.sets.length)).toEqual(stats.recentSessions.map((entry) => entry.sets.length));
  });

  it("takes the table's shape from the newest session that has sets, not from a newest one with none", () => {
    const log = exerciseLog([workout(2_000, [lift("bench", [])]), workout(1_000, [bench(60, 60, 55)])], "bench");
    expect(log.columns).toBe(3);
    expect(exerciseLog([workout(1_000, [lift("bench", [])])], "bench").columns).toBe(0);
  });

  it("marks a set against the previous session, never against the other slot of the same workout", () => {
    const older = workout(1_000, [bench(60)]);
    const newer = workout(2_000, [bench(55), lift("fly", [set(10)]), bench(50)]);
    const [first, second, previous] = exerciseLog([older, newer], "bench").segments[0].entries;
    expect(first.sets[0].arrow).toBe("down"); // 55 against the older session's 60; against its own other slot's 50 it would read "up"
    expect(second.sets[0].arrow).toBe("down"); // 50 against 60
    expect(previous.sets[0].arrow).toBeNull(); // the oldest has nothing older
  });

  it("says a set aloud with its values, split rows, and the effort and mark only when the log shows them", () => {
    const view = { text: "62.5 × 8", split: ["52.5 × 3"], effort: "hard", arrow: "up", number: 1 } as unknown as Parameters<typeof spokenSet>[0];
    expect(spokenSet(view, { effort: true, marks: true })).toBe("62.5 × 8, then 52.5 × 3, felt hard, better than last time");
    expect(spokenSet(view, { effort: false, marks: false })).toBe("62.5 × 8, then 52.5 × 3");
    expect(spokenSet({ ...view, text: null, split: [], effort: null, arrow: "down" }, { effort: true, marks: true })).toBe("not readable, lower than last time");
  });
});
