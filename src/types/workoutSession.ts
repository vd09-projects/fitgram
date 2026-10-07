// src/types/workoutSession.ts
//
// Firestore storage shapes for workout history, exercise-first.
//
//   users/{uid}/sessions/{sessionId}
//     one per workout session — session browse, plan "last performed"
//
//   users/{uid}/exercise_sessions/{sessionId}__{exerciseId}
//     THE canonical set data. Queryable by exerciseId across every workout,
//     which is the question the active-workout flow actually asks.
//
//   users/{uid}/exercise_stats/{exerciseId}
//     derived rollup, one doc per exercise. The hot read path: a whole plan's
//     history is one query. Rebuildable from exercise_sessions at any time.

import { ExerciseField } from "./workoutType";

/** One logged set's values, keyed by `ExerciseField.name`. */
export type StoredSetFields = Record<string, string | number>;

/**
 * One workout session.
 *
 * `rollupPending` is set when the session was written but its exercise_stats
 * update did not land (offline, or a failed transaction). The rebuild script
 * uses it to find work.
 */
export type WorkoutSessionDoc = {
  sessionId: string;
  workoutId: string;
  workoutName: string;
  startedAt: number;
  endedAt: number;
  exerciseIds: string[];
  rollupPending: boolean;
};

/**
 * One exercise as performed in one session.
 *
 * `sets` is a plain positional array — index 0 is set 1. The live
 * `ExerciseSet.id` (a `Date.now()` stamp) is deliberately not persisted: it was
 * never a set number and storing it invited exactly that misreading.
 *
 * `fields` is snapshotted per session, because an exercise's field definitions
 * can change between sessions. That snapshot is what lets a reader detect a
 * kg-vs-lb mismatch instead of comparing incomparable numbers.
 */
export type ExerciseSessionDoc = {
  exerciseId: string;
  exerciseName: string;
  sessionId: string;
  workoutId: string;
  workoutName: string;
  performedAt: number;
  fields: ExerciseField[];
  sets: StoredSetFields[];
};

/** A session as embedded in the rollup. Same data, bounded count. */
export type StatsSessionEntry = {
  sessionId: string;
  workoutId: string;
  workoutName: string;
  performedAt: number;
  fields: ExerciseField[];
  sets: StoredSetFields[];
  /** Precomputed at write time. null when the session's volume is unavailable. */
  volume: number | null;
};

/** Heaviest weight recorded at one exact rep count, all-time. */
export type StatsBestEntry = {
  reps: number;
  weight: number;
  unit?: string;
  performedAt: number;
  sessionId: string;
  workoutId: string;
  /** 1-based set position within that session. */
  setNumber: number;
};

export type StatsVolumePoint = {
  sessionId: string;
  performedAt: number;
  volume: number | null;
};

/**
 * Rollup doc. Derived, never authoritative — `exercise_sessions` is the source
 * of truth and `rebuildExerciseStats` can regenerate this from it.
 */
export type ExerciseStatsDoc = {
  exerciseId: string;
  /** Most recently recorded name, which may differ from an older session's. */
  exerciseName: string;
  lastPerformedAt: number;
  /** Field definitions from the most recent session. */
  fields: ExerciseField[];
  /** Newest first, capped at STATS_RECENT_SESSION_CAP. */
  recentSessions: StatsSessionEntry[];
  /** Keyed by rep count as a string. All-time, kept incrementally. */
  bestByReps: Record<string, StatsBestEntry>;
  /** Oldest first, capped at STATS_VOLUME_HISTORY_CAP. */
  volumeHistory: StatsVolumePoint[];
  updatedAt: number;
};
