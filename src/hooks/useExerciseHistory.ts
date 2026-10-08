// src/hooks/useExerciseHistory.ts

import { useMemo } from "react";
import { useExerciseHistoryStore } from "../stores/useExerciseHistoryStore";
import { useWorkoutStore } from "../stores/useWorkoutStore";
import { ExerciseHistory } from "../types/exerciseHistory";
import { ExerciseField } from "../types/workoutType";
import { deriveExerciseHistory } from "../utils/exerciseHistory";

type UseExerciseHistoryOptions = {
  /**
   * The exercise's current field definitions, when the caller has them and the
   * exercise is not the one being logged — a plan picker holding
   * `Exercise.fields`. Otherwise the live `LoggedExercise.fields` of the active
   * workout is used, falling back to what the last session recorded.
   */
  fields?: ExerciseField[];
};

/**
 * What did I do last time on this exercise — in any workout?
 *
 * Keyed by exercise alone. Bench press done in Push A and in Full Body is one
 * history; `lastSession.workoutName` says which plan it was, so a consumer can
 * label or filter without the data being partitioned by plan.
 *
 * Read-only. This hook issues no network reads at any point — not on mount, not
 * on an exercise switch, not on a cache miss. It selects from the per-exercise
 * cache in `useExerciseHistoryStore` and derives everything with pure functions.
 * Filling that cache is a separate, explicit call,
 * `useExerciseHistoryStore.getState().prefetchExerciseHistory(uid, ids)`, which
 * `startWorkout` already makes for the whole plan. That split is the point:
 * logging a set never waits on the network, and no number of readers costs a read.
 *
 * Before any prefetch the result is `status: "idle"` with `hasHistory: false` —
 * distinguishable from `"ready"` with no history, which is a brand-new exercise.
 * Neither is an error and both render.
 *
 * Two flags consumers must branch on rather than render numbers from:
 * - `numericComparisonAvailable` false — the exercise has no weight+reps pair at
 *   all (a plank). Sessions and raw values are still returned; every derived
 *   number is null or empty.
 * - `unitMismatch` true — some session in the window used a different weight
 *   unit. Units are never converted, so those sessions are marked
 *   `comparable: false` and contribute no numbers.
 */
export function useExerciseHistory(
  exerciseId: string | undefined,
  options?: UseExerciseHistoryOptions
): ExerciseHistory {
  const entry = useExerciseHistoryStore((state) =>
    exerciseId ? state.entries[exerciseId] : undefined
  );

  // The live definitions, only when this is the exercise currently being logged.
  const liveFields = useWorkoutStore((state) =>
    state.activeWorkout?.exercises.find(
      (exercise) => exercise.id === exerciseId
    )?.fields
  );

  const overrideFields = options?.fields ?? liveFields;
  // Callers pass array literals, so memoise on contents rather than identity.
  const overrideFieldsKey = JSON.stringify(overrideFields ?? null);

  return useMemo(
    () => deriveExerciseHistory(entry, overrideFields),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entry, overrideFieldsKey]
  );
}

export default useExerciseHistory;
