// src/test/fixtures.ts
//
// Builders for test data. Each returns a complete, valid value with defaults,
// so a test spells out only what its scenario is about.

import { ActiveWorkout, LoggedExercise } from "../types/zustandWorkoutType";

/** A weight/reps exercise with no sets logged. Id is a slug of the name. */
export function buildExercise(name: string, overrides: Partial<LoggedExercise> = {}): LoggedExercise {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    fields: [
      { name: "Weight", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ],
    sets: [],
    ...overrides,
  };
}

/** An active workout over the named exercises, open on the first. */
export function buildWorkout(
  exerciseNames: string[],
  overrides: Partial<ActiveWorkout> = {}
): ActiveWorkout {
  return {
    id: "test-workout",
    name: "Test Workout",
    startTime: Date.now(),
    lastUpdated: Date.now(),
    exercises: exerciseNames.map((name) => buildExercise(name)),
    currentExerciseIndex: exerciseNames.length > 0 ? 0 : null,
    ...overrides,
  };
}
