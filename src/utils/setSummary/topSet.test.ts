import { buildStats } from "../../test/fixtures";
import { ExerciseField } from "../../types/workoutType";
import { deriveExerciseHistory } from "../exerciseHistory";
import { lastTopSet } from ".";

const KG: ExerciseField[] = [
  { name: "Weight", role: "weight", unit: "kg" },
  { name: "Reps", role: "reps" },
];
const LB: ExerciseField[] = [
  { name: "Weight", role: "weight", unit: "lb" },
  { name: "Reps", role: "reps" },
];
const PLANK: ExerciseField[] = [{ name: "Time", role: "other" }];

const set = (weight: string, reps: string) => ({ Weight: weight, Reps: reps });

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

  it("reports why there is no number instead of returning one", () => {
    expect(lastTopSet(historyFor(PLANK, [{ Time: "60" }]))).toEqual({ kind: "none", reason: "no_numeric_pair" });
    expect(lastTopSet(historyFor(LB, [set("100", "5")], KG))).toEqual({ kind: "none", reason: "unit_changed" });
    expect(lastTopSet(deriveExerciseHistory(undefined))).toEqual({ kind: "none", reason: "no_history" });
  });
});
