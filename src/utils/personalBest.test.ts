import { buildStats } from "../test/fixtures";
import { ExerciseStatsDoc, StoredSetFields } from "../types/workoutSession";
import { ExerciseField } from "../types/workoutType";
import { deriveExerciseHistory } from "./exerciseHistory";
import { resolveNumericFields } from "./exerciseFields";
import { personalBest, personalBestText } from "./personalBest";

const KG: ExerciseField[] = [
  { name: "Weight", role: "weight", unit: "kg" },
  { name: "Reps", role: "reps" },
];
const KG_NUMERIC = resolveNumericFields(KG);

// The real hook derivation, so `bestAtReps` is the definition the sheet uses.
const historyFrom = (stats: ExerciseStatsDoc | null, fields: ExerciseField[] = KG) =>
  deriveExerciseHistory({ exerciseId: "bench-press", status: "ready", stats, fetchedAt: 0, error: null }, fields);

const set = (weight: string, reps: string): StoredSetFields => ({ Weight: weight, Reps: reps });

// Stored record at 8 reps: 65 kg.
const stored = historyFrom(buildStats("Bench Press", [{ sets: [set("65", "8"), set("80", "5")] }]));

describe("personalBest", () => {
  it("beats the stored record at the same reps", () => {
    const best = personalBest(stored, [set("70", "8")], 1, KG_NUMERIC);
    expect(best).toMatchObject({ kind: "beat", weight: 70, reps: 8, beaten: { source: "stored", weight: 65 } });
  });

  it("a worse set after a better one at the same reps is not a best", () => {
    // 67.5 still beats the stored 65, but not the 70 three minutes earlier.
    const today = [set("70", "8"), set("67.5", "8")];
    expect(personalBest(stored, today, 2, KG_NUMERIC)).toEqual({ kind: "none", reason: "notBeaten" });
  });

  it("names today's earlier set when it is the higher bar", () => {
    const today = [set("70", "8"), set("90", "5"), set("72.5", "8")];
    expect(personalBest(stored, today, 3, KG_NUMERIC)).toMatchObject({
      kind: "beat",
      beaten: { source: "today", weight: 70, setNumber: 1 },
    });
  });

  it("a tie with the stored record or today's best is not a best", () => {
    expect(personalBest(stored, [set("65", "8")], 1, KG_NUMERIC)).toEqual({ kind: "none", reason: "notBeaten" });
    expect(personalBest(stored, [set("70", "8"), set("70", "8")], 2, KG_NUMERIC)).toEqual({
      kind: "none",
      reason: "notBeaten",
    });
  });

  it("with no stored record at those reps, beating today's own set is no claim", () => {
    const today = [set("60", "10"), set("62.5", "10")];
    expect(personalBest(stored, today, 2, KG_NUMERIC)).toEqual({ kind: "none", reason: "noRecord" });
    expect(personalBest(historyFrom(null), [set("60", "8")], 1, KG_NUMERIC)).toEqual({
      kind: "none",
      reason: "noRecord",
    });
  });

  it("a plank never has a best", () => {
    const PLANK: ExerciseField[] = [{ name: "Time", role: "time", unit: "s" }];
    const plank = historyFrom(buildStats("Plank", [{ fields: PLANK, sets: [{ Time: "60" }] }]), PLANK);
    expect(personalBest(plank, [{ Time: "90" }], 1, resolveNumericFields(PLANK))).toEqual({
      kind: "none",
      reason: "noComparison",
    });
  });

  it("an unparseable set makes no claim", () => {
    expect(personalBest(stored, [set("seventy", "8")], 1, KG_NUMERIC)).toEqual({ kind: "none", reason: "unparsed" });
  });

  it("makes no claim before history is loaded", () => {
    expect(personalBest({ ...stored, status: "loading" }, [set("70", "8")], 1, KG_NUMERIC)).toEqual({
      kind: "none",
      reason: "notLoaded",
    });
  });
});

describe("personalBestText", () => {
  it("says what was beaten and where it came from", () => {
    const fromStored = personalBestText(personalBest(stored, [set("67.5", "8")], 1, KG_NUMERIC));
    expect(fromStored?.reps).toBe("8");
    expect(fromStored?.detail).toMatch(/^67\.5 kg · beat 65 kg from \d{1,2} [A-Z][a-z]{2}$/);

    const fromToday = personalBestText(personalBest(stored, [set("70", "8"), set("72.5", "8")], 2, KG_NUMERIC));
    expect(fromToday?.detail).toBe("72.5 kg · beat 70 kg from set 1 today");
  });
});
