// src/types/workoutLogs.ts
//
// VIEW MODELS for the log tables on WorkoutLogsScreen — not storage shapes.
// Storage lives in `src/types/workoutSession.ts` and is exercise-first.
// `WorkoutHistoricalLogsFilter` adapts `ExerciseSessionDoc` into these so the
// existing tables keep working unchanged.
//
// `SetsString = "Sets"` used to live here. It was never a schema contract — the
// catalog seeded "Sets" as a per-set field, which is meaningless when each
// logged row *is* a set. Set number is now the array position.

export type SetLog = {
  /**
   * 1-based set number. In this view model the id IS the set's position, filled
   * in by the adapter. Stored data carries no set id at all.
   */
  id: number;
  /** Values as logged. A number can arrive here despite any narrower typing. */
  fields: Record<string, string | number>;
};

export type ExerciseLog = {
  exerciseId: string;
  exerciseName: string;
  /** ms epoch of the session this exercise was performed in. */
  timestamp: number;
  sets: SetLog[];
};

export type WorkoutLog = {
  /** sessionId. */
  id: string;
  workoutId: string;
  userId: string;
  exercises: ExerciseLog[];
};
