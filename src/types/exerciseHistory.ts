// src/types/exerciseHistory.ts
//
// What `useExerciseHistory` returns. Read-only view over the exercise_stats
// rollup, keyed by exercise and therefore cross-workout: "my last bench press"
// means the last time bench press was done in ANY workout, which is the question
// the active-workout flow actually asks.

import { ExerciseStatsDoc, StoredSetFields } from "./workoutSession";
import { ExerciseField } from "./workoutType";
import { NumericFieldMap } from "../utils/exerciseFields";
import { SessionVolume } from "../utils/exerciseStats";

export type { NumericFieldMap, SessionVolume };

/**
 * Cache entry lifecycle.
 * - `idle`    never prefetched for this exercise (not the same as "no history")
 * - `loading` a prefetch is in flight
 * - `ready`   data present and authoritative for this app session
 * - `error`   the only fetch attempt failed and there is nothing cached to serve
 */
export type ExerciseHistoryStatus = "idle" | "loading" | "ready" | "error";

export type ExerciseHistoryEntry = {
  exerciseId: string;
  status: ExerciseHistoryStatus;
  /** null when the exercise has never been performed, or nothing was fetched. */
  stats: ExerciseStatsDoc | null;
  fetchedAt: number | null;
  /**
   * Last fetch failure. Stays set alongside `status: "ready"` when a refetch
   * failed but older cached data is still being served.
   */
  error: string | null;
};

export type HistorySet = {
  /** 1-based position in the session's set array. The join key for "set 4". */
  setNumber: number;
  /** Raw values as logged, for display of non-numeric fields. */
  fields: StoredSetFields;
  /** null when the value is absent, unparseable, or the exercise has no such role. */
  weight: number | null;
  reps: number | null;
};

export type ExerciseHistorySession = {
  sessionId: string;
  workoutId: string;
  /** Which workout this was done in — "last time, in Push B". */
  workoutName: string;
  performedAt: number;
  sets: HistorySet[];
  volume: SessionVolume;
  /**
   * False when this session's weight unit differs from the exercise's current
   * definition. Its numbers are still shown; comparing them is not valid.
   */
  comparable: boolean;
};

/** Heaviest weight recorded at one exact rep count, all-time. */
export type BestSet = {
  reps: number;
  weight: number;
  unit?: string;
  performedAt: number;
  sessionId: string;
  workoutId: string;
  setNumber: number;
};

export type VolumePoint = {
  sessionId: string;
  performedAt: number;
  /** null when that session's volume is unavailable, so a chart can break the line. */
  volume: number | null;
};

export type ExerciseHistory = {
  status: ExerciseHistoryStatus;
  /** House convention. True only while a prefetch is in flight. */
  loading: boolean;
  /** True when at least one session recorded this exercise. */
  hasHistory: boolean;
  /** The exercise's current field definitions, as last recorded. */
  fields: ExerciseField[];
  /** null when the exercise has no weight+reps pair — a plank, say. */
  numericFields: NumericFieldMap | null;
  /**
   * False when `numericFields` is null. Every number below is then null or empty,
   * and a consumer must say "no comparison available" instead of rendering 0/NaN.
   */
  numericComparisonAvailable: boolean;
  /**
   * True when some session in the window used a different weight unit than the
   * current definition. Units are never converted, so those sessions are marked
   * `comparable: false` and excluded from deltas. Consumers should say so.
   */
  unitMismatch: boolean;
  lastSession: ExerciseHistorySession | null;
  /** 1-based lookup into `lastSession`. null when that set was not done last time. */
  setAt: (setNumber: number) => HistorySet | null;
  /** Newest first, at most `HISTORY_RECENT_SESSION_COUNT`. */
  sessions: ExerciseHistorySession[];
  /** One entry per distinct rep count, ascending by reps. All-time. */
  best: BestSet[];
  bestAtReps: (reps: number) => BestSet | null;
  /** Oldest to newest, at most `HISTORY_TREND_SESSION_COUNT`. */
  volumeTrend: VolumePoint[];
  /** Last fetch failure, if any. Present even when cached data is being served. */
  error: string | null;
};
