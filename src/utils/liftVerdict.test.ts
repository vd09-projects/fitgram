import { liftVerdict, LiftSession, workoutVerdict } from "./liftVerdict";
import { ExerciseField } from "../types/workoutType";
import { StoredSet } from "../types/workoutSession";

const KG: ExerciseField = { name: "Weight", role: "weight", unit: "kg" };
const LB: ExerciseField = { name: "Weight", role: "weight", unit: "lb" };
const REPS: ExerciseField = { name: "Reps", role: "reps" };
const BENCH = [KG, REPS];

const set = (weight: string | number, reps: string | number, field = "Weight"): StoredSet => ({
  segments: [{ [field]: weight, Reps: reps }],
  effort: null,
});
const session = (fields: ExerciseField[], sets: StoredSet[]): LiftSession => ({ fields, sets, performedAt: 1 });
const bench = (...sets: StoredSet[]) => session(BENCH, sets);

describe("liftVerdict", () => {
  it("has no previous session: First time, before any maths (a first plank too)", () => {
    expect(liftVerdict(bench(set(60, 8)), null)).toEqual({ verdict: null, reason: "first_time" });
    const plank = session([{ name: "Time", role: "time", unit: "s" }], [{ segments: [{ Time: 45 }], effort: null }]);
    expect(liftVerdict(plank, null).reason).toBe("first_time");
  });

  it("compares total weight x reps: better, lower", () => {
    const last = bench(set(60, 8), set(60, 8));
    expect(liftVerdict(bench(set(62.5, 8), set(60, 8)), last).verdict).toBe("better");
    expect(liftVerdict(bench(set(60, 8), set(60, 6)), last).verdict).toBe("lower");
  });

  it("is Same for equal totals from different numbers, and for decimal-plate float noise", () => {
    expect(liftVerdict(bench(set(50, 12)), bench(set(60, 10)))).toEqual({ verdict: "same", reason: null });
    // 3 x 1.1 sums to 3.3000000000000003, not 3.3.
    expect(liftVerdict(bench(set(1.1, 1), set(1.1, 1), set(1.1, 1)), bench(set(3.3, 1), set(0, 1), set(0, 1))).verdict).toBe("same");
  });

  it("compares the first N sets when there are fewer sets today", () => {
    const last = bench(set(60, 8), set(60, 8), set(60, 8), set(60, 8));
    // Two sets equal to the first two of four: Same, not Lower by half.
    expect(liftVerdict(bench(set(60, 8), set(60, 8)), last).verdict).toBe("same");
    // More sets than last time compare totals: the extra set is Better.
    expect(liftVerdict(bench(set(60, 8), set(60, 8), set(60, 8), set(60, 8), set(60, 8)), last).verdict).toBe("better");
  });

  it("has a reason and no verdict for a unit change, never a number", () => {
    expect(liftVerdict(bench(set(60, 8)), session([LB, REPS], [set(130, 8)]))).toEqual({
      verdict: null,
      reason: "unit_changed",
    });
  });

  it("is unreadable when a set on either side does not parse, not a partial sum", () => {
    expect(liftVerdict(bench(set(60, 8), set("abc", 8)), bench(set(60, 8), set(60, 8))).reason).toBe("unreadable");
    expect(liftVerdict(bench(set(60, 8)), bench(set(60, ""))).reason).toBe("unreadable");
  });

  it("reads each side by its own fields: a renamed weight field is not null", () => {
    const renamed = session([{ name: "Load", role: "weight", unit: "kg" }, REPS], [set(50, 8, "Load")]);
    expect(liftVerdict(bench(set(60, 8)), renamed).verdict).toBe("better");
  });

  it("totals reps for a reps-only lift, and keeps it apart from a weighted one", () => {
    const dips = (...reps: number[]) =>
      session([REPS], reps.map((r) => ({ segments: [{ Reps: r }], effort: null })));
    expect(liftVerdict(dips(10, 8), dips(9, 8)).verdict).toBe("better");
    expect(liftVerdict(dips(10, 8), dips(10, 10)).verdict).toBe("lower");
    expect(liftVerdict(dips(10), bench(set(0, 10))).reason).toBe("unit_changed");
  });

  it("has no volume to compare for a time lift, or a previous total of 0", () => {
    const plank = (s: number) => session([{ name: "Time", role: "time", unit: "s" }], [{ segments: [{ Time: s }], effort: null }]);
    expect(liftVerdict(plank(60), plank(45)).reason).toBe("no_volume");
    expect(liftVerdict(bench(set(20, 8)), bench(set(0, 8))).reason).toBe("no_volume");
    expect(liftVerdict(bench(), bench(set(60, 8))).reason).toBe("no_volume");
  });
});

describe("workoutVerdict", () => {
  const b = { verdict: "better", reason: null } as const;
  const l = { verdict: "lower", reason: null } as const;
  const s = { verdict: "same", reason: null } as const;
  const first = { verdict: null, reason: "first_time" } as const;
  const none = { verdict: null, reason: "no_volume" } as const;

  it("counts better first, and lower only when nothing is better", () => {
    expect(workoutVerdict([b, l, b, first])).toEqual({ word: "better", count: 2, amber: true });
    expect(workoutVerdict([l, s, l, first])).toEqual({ word: "lower", count: 2, amber: false });
  });

  it("says Same, First time or Not compared, counting none of the lifts with no verdict", () => {
    expect(workoutVerdict([s, first, none])).toEqual({ word: "same", amber: false });
    expect(workoutVerdict([first, first])).toEqual({ word: "first_time", amber: false });
    expect(workoutVerdict([first, none])).toEqual({ word: "not_compared", amber: false });
    expect(workoutVerdict([])).toEqual({ word: "not_compared", amber: false });
  });

  it("gives no word while any lift is pending", () => {
    expect(workoutVerdict([b, { verdict: null, reason: "pending" }])).toEqual({ word: "pending", amber: false });
  });
});
