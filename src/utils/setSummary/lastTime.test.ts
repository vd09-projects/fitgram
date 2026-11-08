import { buildStats } from "../../test/fixtures";
import { ExerciseStatsDoc } from "../../types/workoutSession";
import { ExerciseField } from "../../types/workoutType";
import { deriveExerciseHistory } from "../exerciseHistory";
import { partsToString } from "../startWorkout";
import { lastTimeSummary } from ".";

const KG: ExerciseField[] = [
  { name: "Weight", role: "weight", unit: "kg" },
  { name: "Reps", role: "reps" },
];
const LB: ExerciseField[] = [
  { name: "Weight", role: "weight", unit: "lb" },
  { name: "Reps", role: "reps" },
];
const BODYWEIGHT: ExerciseField[] = [{ name: "Reps", role: "reps" }];
const SECONDS: ExerciseField[] = [{ name: "Time", role: "time", unit: "s" }];
const MINUTES: ExerciseField[] = [{ name: "Time", role: "time", unit: "min" }];
/** No measured field at all: nothing to name a best on. */
const UNMEASURED: ExerciseField[] = [{ name: "Band", role: "other" }];

const set = (weight: string, reps: string) => ({ Weight: weight, Reps: reps });

const summaryOf = (stats: ExerciseStatsDoc | null, status: "ready" | "error" = "ready", fields?: ExerciseField[]) =>
  partsToString(
    lastTimeSummary(deriveExerciseHistory({ exerciseId: "x", status, stats, error: null }, fields))
  );
const summary = (fields: ExerciseField[], sets: Record<string, string>[], currentFields?: ExerciseField[]) =>
  summaryOf(buildStats("Overhead Press", [{ fields, sets }]), "ready", currentFields);

describe("lastTimeSummary", () => {
  it("counts the sets and names the heaviest, a weight tie going to more reps", () => {
    expect(summary(KG, [set("60", "8"), set("70", "5"), set("70", "6"), set("65", "10")])).toBe(
      "4 sets · top 70 kg × 6"
    );
  });

  it("names the best on the first measured field without a weight+reps pair", () => {
    expect(summary(BODYWEIGHT, [{ Reps: "10" }, { Reps: "12" }, { Reps: "8" }])).toBe("3 sets · best 12 reps");
    expect(summary(SECONDS, [{ Time: "40" }, { Time: "45" }])).toBe("2 sets · best 45 s");
  });

  it("gives the count alone when no figure can be read, never a guessed one", () => {
    expect(summary(KG, [set("", "8"), set("abc", "8"), set("60", "")])).toBe("3 sets");
    expect(summary(UNMEASURED, [{ Band: "red" }])).toBe("1 set");
  });

  it("keeps the count and says the unit changed instead of comparing", () => {
    expect(summary(LB, [set("100", "5")], KG)).toBe("1 set · unit changed");
    expect(summary(SECONDS, [{ Time: "45" }, { Time: "50" }], MINUTES)).toBe("2 sets · unit changed");
  });

  it("says new only once history has loaded empty", () => {
    expect(summaryOf(null)).toBe("new");
    expect(partsToString(lastTimeSummary(deriveExerciseHistory(undefined)))).toBe("…");
    expect(summaryOf(null, "error")).toBe("unavailable");
  });
});
