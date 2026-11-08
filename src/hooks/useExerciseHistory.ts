// src/hooks/useExerciseHistory.ts

import { useMemo } from "react";
import { useExerciseHistoryStore } from "../stores/useExerciseHistoryStore";
import { useWorkoutStore } from "../stores/useWorkoutStore";
import { ExerciseHistory } from "../types/exerciseHistory";
import { ExerciseField } from "../types/workoutType";
import { deriveExerciseHistory } from "../utils/exerciseHistory";
import { summaryEntry } from "../utils/exerciseSummariesSync";

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
 * on an exercise switch, not on a miss. It selects from the saved summaries in
 * `useExerciseHistoryStore` and derives everything with pure functions. Keeping
 * those fresh is a separate, explicit call,
 * `useExerciseHistoryStore.getState().open(uid)`, which `startWorkout` already
 * makes. That split is the point: logging a set never waits on the network, and
 * no number of readers costs a read.
 *
 * Before any check the result is `status: "idle"` with `hasHistory: false` —
 * distinguishable from `"ready"` with no history, which is a brand-new exercise
 * (`summaryEntry` says when that may be claimed). Neither is an error and both
 * render.
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
  // Field by field: an object built in a selector is new on every store change.
  const stats = useExerciseHistoryStore((state) =>
    exerciseId ? state.byId?.[exerciseId] : undefined
  );
  const checking = useExerciseHistoryStore((state) => state.checking);
  const waitOver = useExerciseHistoryStore((state) => state.waitOver);
  const lastResult = useExerciseHistoryStore((state) => state.lastResult);
  const lastError = useExerciseHistoryStore((state) => state.lastError);
  const entry = useMemo(
    () =>
      exerciseId
        ? summaryEntry({ exerciseId, stats, checking, waitOver, lastResult, lastError })
        : undefined,
    [exerciseId, stats, checking, waitOver, lastResult, lastError]
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
