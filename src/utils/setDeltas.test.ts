import { comparisonText, compareSets, setDelta, setValuesText, todaySummary, volumeText } from "./setDeltas";
import { deriveExerciseHistory } from "./exerciseHistory";
import { resolveNumericFields } from "./exerciseFields";
import { buildStats } from "../test/fixtures";
import { ExerciseStatsDoc, StoredSetFields } from "../types/workoutSession";
import { ExerciseField } from "../types/workoutType";

const KG: ExerciseField = { name: "Weight", role: "weight", unit: "kg" };
const LB: ExerciseField = { name: "Weight", role: "weight", unit: "lb" };
const REPS: ExerciseField = { name: "Reps", role: "reps" };
const BENCH = [KG, REPS];
const PLANK: ExerciseField[] = [
  { name: "Time", role: "time", unit: "s" },
  { name: "Notes", role: "other" },
];

const historyOf = (stats: ExerciseStatsDoc | null, fields: ExerciseField[] = BENCH) =>
  deriveExerciseHistory(
    { exerciseId: "bench-press", status: "ready", stats, fetchedAt: 0, error: null },
    fields
  );

const set = (weight: string, reps: string): StoredSetFields => ({ Weight: weight, Reps: reps });

describe("compareSets", () => {
  const unit = "kg";
  it.each([
    ["reps up", { weight: 65, reps: 9 }, "improved", "+1 rep"],
    ["reps down", { weight: 65, reps: 6 }, "down", "−2 reps"],
    ["weight up", { weight: 67.5, reps: 8 }, "improved", "+2.5 kg"],
    ["weight down", { weight: 60, reps: 8 }, "down", "−5 kg"],
    ["both up", { weight: 67.5, reps: 9 }, "improved", "+2.5 kg · +1 rep"],
    ["heavier, fewer reps, more volume", { weight: 75, reps: 7 }, "improved", "+10 kg · −1 rep"],
    ["heavier, fewer reps, less volume", { weight: 67.5, reps: 6 }, "down", "+2.5 kg · −2 reps"],
    ["exactly equal", { weight: 65, reps: 8 }, "matched", "matched"],
  ])("%s", (_name, today, verdict, label) => {
    expect(compareSets(today, { weight: 65, reps: 8 }, unit)).toEqual({ verdict, label });
  });

  it("calls equal volume from different numbers even, and says both changes", () => {
    expect(compareSets({ weight: 50, reps: 12 }, { weight: 60, reps: 10 }, unit)).toEqual({
      verdict: "even",
      label: "−10 kg · +2 reps",
    });
  });

  it("lets the moved dimension decide when a 0 factor ties volume", () => {
    // Bodyweight logged as 0 kg: 0×8 → 0×10 is two more reps, not "even".
    expect(compareSets({ weight: 0, reps: 10 }, { weight: 0, reps: 8 }, unit).verdict).toBe("improved");
  });
});

describe("setDelta", () => {
  const today = resolveNumericFields(BENCH);
  const lastTime = buildStats("Bench Press", [{ sets: [set("65", "8"), set("abc", "8")] }]);

  it("compares today's set n with last session's set n", () => {
    expect(setDelta(historyOf(lastTime), 1, set("65", "9"), today)).toEqual({
      kind: "delta",
      verdict: "improved",
      label: "+1 rep",
    });
  });

  it("gives no delta, not 0, for a null weight or reps last time", () => {
    expect(setDelta(historyOf(lastTime), 2, set("65", "8"), today)).toEqual({
      kind: "none",
      reason: "pastUnparsed",
    });
  });

  it("gives no delta for an unparseable set today", () => {
    expect(setDelta(historyOf(lastTime), 1, set("65", ""), today).kind).toBe("none");
  });

  it("gives no delta past the sets last session reached", () => {
    expect(setDelta(historyOf(lastTime), 3, set("65", "8"), today)).toEqual({
      kind: "none",
      reason: "setNotReached",
    });
  });

  it("gives no delta first time, for a plank, or when last time was another unit", () => {
    expect(setDelta(historyOf(null), 1, set("65", "8"), today)).toMatchObject({ reason: "firstTime" });
    const plank = buildStats("Plank", [{ fields: PLANK, sets: [{ Time: "60" }] }]);
    expect(setDelta(historyOf(plank, PLANK), 1, { Time: "60" }, null)).toMatchObject({
      reason: "noComparison",
    });
    const lb = buildStats("Bench Press", [{ fields: [LB, REPS], sets: [set("135", "8")] }]);
    expect(setDelta(historyOf(lb), 1, set("60", "8"), today)).toMatchObject({ reason: "unitChanged" });
  });
});

describe("todaySummary", () => {
  const lastTime = buildStats("Bench Press", [
    { sets: [set("60", "10"), set("60", "10"), set("60", "10")] },
  ]);

  it("compares with last session's first N sets while today has fewer", () => {
    const summary = todaySummary(historyOf(lastTime), [set("60", "11"), set("60", "11")], BENCH);
    expect(summary.volume).toEqual({ value: 1320, setsCounted: 2, setsTotal: 2 });
    expect(summary.comparison).toMatchObject({ kind: "percent", direction: 1, base: { kind: "firstN", n: 2 } });
    expect(comparisonText(summary.comparison)).toBe("+10.0% volume vs first 2 sets");
  });

  it("compares full totals once today has as many sets, and names the session", () => {
    const today = [set("60", "10"), set("60", "10"), set("60", "10"), set("60", "10")];
    const summary = todaySummary(historyOf(lastTime), today, BENCH);
    expect(summary.comparison).toMatchObject({ kind: "percent", base: { kind: "session" } });
    expect(summary.comparison.kind === "percent" && Math.round(summary.comparison.percent)).toBe(33);
    expect(comparisonText(summary.comparison)).toMatch(/^\+33\.3% volume vs \d{1,2} [A-Z][a-z]{2}$/);
  });

  it("reports today's volume unavailable with counts, never a partial sum", () => {
    const summary = todaySummary(historyOf(lastTime), [set("60", "10"), set("60", "")], BENCH);
    expect(summary.volume).toEqual({ value: null, setsCounted: 1, setsTotal: 2 });
    expect(volumeText(summary.volume, "kg")).toBe("volume unavailable (1 of 2 sets)");
    expect(summary.comparison).toEqual({ kind: "none", reason: "todayUnavailable" });
  });

  it("has no comparison when last time's first N sets did not all parse", () => {
    const partial = buildStats("Bench Press", [{ sets: [set("60", "10"), set("?", "10"), set("60", "10")] }]);
    const summary = todaySummary(historyOf(partial), [set("60", "10"), set("60", "10")], BENCH);
    expect(summary.volume?.value).toBe(1200);
    expect(comparisonText(summary.comparison)).toBe("Last session's volume unavailable (1 of 2 sets)");
  });

  it("has no comparison when last session was in another unit", () => {
    const lb = buildStats("Bench Press", [{ fields: [LB, REPS], sets: [set("135", "10")] }]);
    const summary = todaySummary(historyOf(lb), [set("60", "10")], BENCH);
    expect(comparisonText(summary.comparison)).toBe("Last time was in lb, so no comparison");
  });

  it("gives no percentage of a 0 kg session", () => {
    const bodyweight = buildStats("Bench Press", [{ sets: [set("0", "10")] }]);
    const summary = todaySummary(historyOf(bodyweight), [set("5", "10")], BENCH);
    expect(summary.comparison).toEqual({ kind: "none", reason: "pastZero" });
  });

  it("has no volume at all for a plank, rather than 0", () => {
    const summary = todaySummary(historyOf(null, PLANK), [{ Time: "60" }], PLANK);
    expect(summary.volume).toBeNull();
    expect(volumeText(summary.volume, undefined)).toBeNull();
  });

  it("reads today's fields from the live exercise, not last session's shape", () => {
    // Last session had no weight+reps pair; today the exercise does.
    const plankBefore = buildStats("Bench Press", [{ fields: PLANK, sets: [{ Time: "60" }] }]);
    const summary = todaySummary(historyOf(plankBefore, PLANK), [set("60", "10")], BENCH);
    expect(summary.volume?.value).toBe(600);
  });
});

describe("setValuesText", () => {
  it("reads weight × reps, or every logged field with its unit", () => {
    expect(setValuesText(BENCH, set("60", "12"))).toBe("60 kg × 12");
    expect(setValuesText(PLANK, { Time: "45", Notes: "light band" })).toBe("45 s · light band");
    expect(setValuesText(BENCH, set("6o", "12"))).toBe("6o kg · 12");
  });
});
