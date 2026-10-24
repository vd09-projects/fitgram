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

/**
 * How one set felt, marked by the user (TICKET-034).
 *
 * - `easy`: could have done more. Push next time.
 * - `hard`: missed reps, lost form, or needed a spot.
 * - `null`: **not marked**, which the user reads as "done in good form, as
 *   planned". Stored as null, never as a third value: the app cannot tell an
 *   ordinary set from one nobody thought to mark, so it must not claim the
 *   first. Rejected: a stored "ok" (TICKET-034's three-value option) — the user
 *   marks exceptions, not every set, so "ok" would be indistinguishable from
 *   unmarked in practice and only add a button.
 *
 * Per set, not per exercise as the ticket first said: "hard" is about the set
 * where reps were missed, and comparing it with the same set last time is the
 * axis ghosts and deltas already use.
 */
export const Effort = { Easy: "easy", Hard: "hard" } as const;
export type Effort = (typeof Effort)[keyof typeof Effort];
/**
 * Every mark, in the order the controls offer them. The strings are what
 * Firestore stores: renaming one orphans every mark already written.
 */
export const EFFORTS: readonly Effort[] = [Effort.Easy, Effort.Hard];

/** One logged set's values, keyed by `ExerciseField.name`. */
export type StoredSetFields = Record<string, string | number>;

/** Why a session has no totals. See `computeSessionTotalVolume`. */
export type SessionVolumeUnavailableReason = "unparseable" | "no_weighted_exercises";

/** One weight unit's share of a session's volume. */
export type UnitVolume = {
  /** null means the weight field has no unit. */
  unit: string | null;
  value: number;
};

/**
 * A whole session's volume, stored at write time (TICKET-022). Stored rather
 * than aggregated on read because the alternative is one exercise read per plan
 * on the Start screen; stored now because the app is pre-launch and adding it
 * after launch means migrating every session.
 *
 * One total per weight unit (TICKET-044): kg exercises sum with kg, plates with
 * plates, and nothing is converted. Replaced a single `value` + `unit` that
 * went null whenever two units met, which with plates meant most plans.
 * Pre-launch, so sessions stored in the old shape are not migrated; readers
 * show them as "volume not recorded".
 */
export type SessionTotalVolume = {
  /**
   * One entry per weight unit, in the order the units first appear in the
   * session. Empty when `unavailableReason` is set.
   */
  totals: UnitVolume[];
  unavailableReason: SessionVolumeUnavailableReason | null;
  /** Weighted exercises whose volume was summed. */
  exercisesCounted: number;
  /** Exercises with a weight+reps pair. */
  exercisesWeighted: number;
  /** All exercises in the session. `total − weighted` were excluded (a plank). */
  exercisesTotal: number;
};

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
  /**
   * Always written. Optional only because dev sessions saved before TICKET-022
   * lack it; readers treat absence as unavailable, never as 0.
   */
  volume?: SessionTotalVolume;
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
  /**
   * Per-set effort marks, positional: index i is `sets[i]`'s (TICKET-034).
   *
   * A parallel array rather than a field inside each set, so TICKET-033's
   * reshape of the stored set does not have to carry it, and the volume and
   * record code that reads `sets` is untouched. Built in one place
   * (`buildSessionDocs`) from the live sets, so it is aligned by construction;
   * a reader that finds a length mismatch reads every mark as null and says so
   * (`zipSetEffort`) rather than pair marks with the wrong sets.
   *
   * Always written, as nulls when nothing was marked: Firestore here rejects
   * `undefined`. Optional only for dev docs saved before 034.
   */
  setEffort?: (Effort | null)[];
};

/** A session as embedded in the rollup. Same data, bounded count. */
export type StatsSessionEntry = {
  sessionId: string;
  workoutId: string;
  workoutName: string;
  performedAt: number;
  fields: ExerciseField[];
  sets: StoredSetFields[];
  /** Copied from `ExerciseSessionDoc.setEffort`; same rules. */
  setEffort?: (Effort | null)[];
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
