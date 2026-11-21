import { finishSummary } from "./finishSummary";
import { buildExercise } from "../test/fixtures";

const set = (id: number) => ({ id, segments: [{ Weight: 60, Reps: 5 }] });

describe("finishSummary", () => {
  it("counts sets, and splits exercises by whether they have any", () => {
    const workout = {
      exercises: [buildExercise("Bench Press", { sets: [set(1), set(2)] }), buildExercise("Squat"), buildExercise("Row", { sets: [set(1)] })],
    };
    expect(finishSummary(workout)).toEqual({ sets: 3, exercisesWithSets: 2, exercisesWithoutSets: 1 });
  });

  it("a workout with nothing logged has no sets, whatever the exercise count", () => {
    expect(finishSummary({ exercises: [buildExercise("A"), buildExercise("B")] })).toEqual({
      sets: 0,
      exercisesWithSets: 0,
      exercisesWithoutSets: 2,
    });
  });
});
