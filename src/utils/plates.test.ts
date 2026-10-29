import { StoredSetFields } from "../types/workoutSession";
// TICKET-044: plates as a weight unit. The ticket's load-bearing fact is that
// every comparison already checks unit equality, so a plates session next to a
// kg session reads as a unit change with no new logic. These tests check that
// claim on every path that compares, through the real hook derivation.

import { buildStats } from "../test/fixtures";
import { ExerciseStatsDoc } from "../types/workoutSession";
import { ExerciseField } from "../types/workoutType";
import { deriveExerciseHistory } from "./exerciseHistory";
import { resolveNumericFields } from "./exerciseFields";
import { personalBest } from "./personalBest";
import { compareSets, setDelta, setValuesText, todaySummary } from "./setDeltas";
import { ghostNotice, resolveGhostTarget, stepFieldValue } from "./setLogger";
import { lastTopSet } from "./startWorkout";

const REPS: ExerciseField = { name: "Reps", role: "reps" };
const KG: ExerciseField[] = [{ name: "Weight", role: "weight", unit: "kg" }, REPS];
const PLATES: ExerciseField[] = [{ name: "Weight", role: "weight", unit: "plates" }, REPS];

const set = (weight: string, reps: string) => ({ Weight: weight, Reps: reps });
/** Today\'s live sets, one segment each (TICKET-055). */
const live = (sets: StoredSetFields[]) => sets.map((values) => ({ segments: [values] }));
const historyOf = (stats: ExerciseStatsDoc | null, fields: ExerciseField[]) =>
  deriveExerciseHistory({ exerciseId: "pec-deck", status: "ready", stats, fetchedAt: 0, error: null }, fields);

describe("plates against kg", () => {
  it("a plates session after a kg session is a unit change on every path", () => {
    const history = historyOf(buildStats("Pec Deck", [{ fields: KG, sets: [set("40", "12")] }]), PLATES);
    const today = [set("5", "12")];

    expect(resolveGhostTarget(history, 1).kind).toBe("unitChanged");
    expect(setDelta(history, 1, today[0], resolveNumericFields(PLATES))).toMatchObject({ reason: "unitChanged" });
    expect(todaySummary(history, live(today), PLATES).comparison).toMatchObject({ reason: "unitChanged" });
    expect(lastTopSet(history)).toEqual({ kind: "none", reason: "unit_changed" });
  });

  it("a best in plates never beats, or is beaten by, a best in kg", () => {
    // Stored: 40 kg × 12 and 5 plates × 12, two records under one rep count.
    const stats = buildStats("Pec Deck", [
      { fields: KG, sets: [set("40", "12")] },
      { fields: PLATES, sets: [set("5", "12")] },
    ]);

    const plates = historyOf(stats, PLATES);
    expect(plates.bestAtReps(12)).toMatchObject({ weight: 5, unit: "plates" });
    // 6 plates beats 5 plates, not 40 kg.
    expect(personalBest(plates, [set("6", "12")], 1, resolveNumericFields(PLATES))).toMatchObject({
      kind: "beat",
      beaten: { weight: 5 },
    });

    const kg = historyOf(stats, KG);
    expect(kg.bestAtReps(12)).toMatchObject({ weight: 40, unit: "kg" });
    // 41 kg beats 40 kg; the 5-plate record neither blocks nor counts.
    expect(personalBest(kg, [set("41", "12")], 1, resolveNumericFields(KG))).toMatchObject({
      kind: "beat",
      beaten: { weight: 40 },
    });
  });
});

describe("plates on the set card", () => {
  const weight = PLATES[0];

  it("steps by one plate, from a typed half plate too", () => {
    expect(stepFieldValue(weight, "5", 1, null)).toBe("6");
    expect(stepFieldValue(weight, "4.5", -1, null)).toBe("3.5");
  });

  it("reads 1 plate, +1 plate, 5 plates", () => {
    expect(setValuesText(PLATES, set("1", "12"))).toBe("1 plate × 12");
    expect(setValuesText(PLATES, set("5", "12"))).toBe("5 plates × 12");
    expect(compareSets({ weight: 6, reps: 10 }, { weight: 5, reps: 10 }, "plates").label).toBe("+1 plate");
  });

  it("names last time's unit and numbers when it was kg", () => {
    const history = historyOf(buildStats("Pec Deck", [{ fields: KG, sets: [set("40", "12")] }]), PLATES);
    expect(ghostNotice(resolveGhostTarget(history, 1), "ready")).toBe(
      "Last time was in kg (40 kg × 12), so no targets"
    );
    // Set 2 was not done last time: the unit, without numbers it does not have.
    expect(ghostNotice(resolveGhostTarget(history, 2), "ready")).toBe("Last time was in kg, so no targets");
  });
});
