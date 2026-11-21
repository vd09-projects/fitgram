// src/utils/finishSummary.ts
//
// What a Finish would save (TICKET-096), for the confirmation before it. Pure, so the counts are tested without a screen.
//
// "Has sets" is `exercise.sets.length > 0`, the filter `buildSessionDocs` applies. Counting it any other way would make
// the dialog promise something the save does not do. A set is counted whatever its units or segments: this says how
// much will be saved, not how much was lifted.

import type { ActiveWorkout } from "../types/zustandWorkoutType";

export type FinishSummary = {
  /** Sets across all exercises. */
  sets: number;
  /** Exercises with at least one set: the ones the save keeps. */
  exercisesWithSets: number;
  /** Exercises with no set: the save drops them (they are named nowhere, only counted). */
  exercisesWithoutSets: number;
};

export function finishSummary(workout: Pick<ActiveWorkout, "exercises">): FinishSummary {
  let sets = 0;
  let exercisesWithSets = 0;
  let exercisesWithoutSets = 0;
  for (const exercise of workout.exercises) {
    if (exercise.sets.length > 0) {
      sets += exercise.sets.length;
      exercisesWithSets += 1;
    } else {
      exercisesWithoutSets += 1;
    }
  }
  return { sets, exercisesWithSets, exercisesWithoutSets };
}
