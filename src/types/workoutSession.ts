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
import type { SyncStamp } from "../utils/syncCore";

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

/**
 * One set as stored (TICKET-055): everything about the set in one record, the
 * live `ExerciseSet` less its id.
 *
 * - `segments`: the set's values, one per segment, never empty. `segments[0]`
 *   is the set as planned; a set split mid-way (TICKET-033) has more. Which
 *   segment a comparison reads (records, deltas, ghosts) is decided in one
 *   place, `comparisonSegment`, not by this shape.
 * - `effort`: the user's mark (TICKET-034), null when not marked. Always
 *   written: Firestore here rejects `undefined`.
 *
 * Built only by `toStoredSets` and read only through `decodeStoredSet`, which
 * says when a stored set is not this shape rather than misread it.
 *
 * A map per set holding an array of maps. Firestore rejects an array directly
 * inside an array (`StoredSetFields[][]` would fail every upload, on every
 * retry, and only at upload); an array inside a map inside an array is fine.
 *
 * Replaced (user, 2026-10-29): `sets[i]` as the first segment's values plus
 * the parallel arrays `setEffort` (034) and `setSplits` (033-1). Each parallel
 * array needed its own pairing function and length-mismatch rule, a reader
 * that forgot one silently showed less (the older logs screen dropped both),
 * and the first-segment rule, which the ticket calls provisional, was fixed in
 * the storage format. Also rejected: `{ segments }` only, with `setEffort`
 * left parallel. Pre-launch, so docs in the old shape are wiped, not migrated.
 */
export type StoredSet = { segments: StoredSetFields[]; effort: Effort | null };

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

/** How a lift compares with its previous session. Rule and reasons: `utils/liftVerdict.ts`. */
export type LiftVerdict = "better" | "lower" | "same";

/**
 * Why a lift has no verdict. Stored as written, so renaming one orphans every
 * record already saved.
 *
 * - `first_time`: no previous session of this exact exercise.
 * - `unit_changed`: the two sessions do not measure the same way (kg then lb,
 *   or a weight × reps lift then a time one). Never converted, never a number.
 * - `no_volume`: nothing to total: a lift with no weight × reps pair and not
 *   reps-only (time, distance, assisted), no sets, or a previous total of 0.
 * - `unreadable`: a set on either side did not parse. Not treated as 0.
 * - `pending`: not computed yet. Written by the first phase of a save, before
 *   the stats transaction ran; also left in place when the previous session is
 *   older than the rollup's window (see `previousSessionOf`), for a repair.
 */
export type LiftReason = "first_time" | "unit_changed" | "no_volume" | "unreadable" | "pending";

/**
 * One lift of a workout as History reads it (TICKET-081, shape B of TICKET-087):
 * what was done, with its sets, and how it compared. `sessions.lifts` is the one
 * source of truth for sets; `exercise_sessions` is written beside it until
 * TICKET-085 retires the old History page.
 *
 * `verdict` is null exactly when `reason` is set. Optional keys are left out,
 * never `undefined`: Firestore here rejects it.
 */
export type LiftRecord = {
  /** The exercise done (a swapped-in exercise's own id), as in `exerciseIds`. */
  id: string;
  /** The session's name snapshot (TICKET-042), as `ExerciseSessionDoc.exerciseName`. */
  name: string;
  /**
   * The plan's exercise this slot replaced (TICKET-047), by id and name: the
   * row says "swapped from X" and a custom exercise is not in the catalog.
   * Absent when the slot held what the plan has.
   */
  swappedFrom?: { id: string; name: string };
  /** Added during the workout (TICKET-056). Never set on Freestyle, where every slot is added. */
  added?: true;
  /** As `ExerciseSessionDoc.fields`: this session's snapshot, so a unit change is detectable. */
  fields: ExerciseField[];
  /** As `ExerciseSessionDoc.sets`, as stored. */
  sets: StoredSet[];
  verdict: LiftVerdict | null;
  reason: LiftReason | null;
};

/**
 * One workout session.
 */
export type WorkoutSessionDoc = {
  sessionId: string;
  workoutId: string;
  workoutName: string;
  startedAt: number;
  endedAt: number;
  /** Derived from `lifts`, in order: what `recents`, `freestyleHistory` and the held copy's validator read. */
  exerciseIds: string[];
  /**
   * Every lift with sets, in workout order (TICKET-081). Written in two phases
   * (`saveWorkoutSession`): first with `reason: "pending"`, then with verdicts.
   * Readers validate it (`readLifts`): `firestore.rules` has no field whitelist.
   */
  lifts: LiftRecord[];
  /**
   * Set by the read boundary (`sessionFromDoc`), never stored: the doc's `lifts`
   * were missing or unreadable (a session from before TICKET-081, or a bad
   * write), so `lifts` is `[]`. A screen says "details not available" instead
   * of showing a workout with no lifts. Without it an empty list would read as
   * data (CLAUDE.md 2.4).
   */
  liftsUnreadable?: true;
  /** The workout's note, written by the Session screen (TICKET-083), never by Finish. */
  note?: string;
  /**
   * Always written. Optional only because dev sessions saved before TICKET-022
   * lack it; readers treat absence as unavailable, never as 0.
   */
  volume?: SessionTotalVolume;
  /**
   * The server's time of the doc's last write (TICKET-075), as plain numbers:
   * `serverTimestamp()` on every write of `sessions`. What a change check
   * filters on. Absent on sessions written before 075 (no backfill), and on a
   * session this phone just uploaded, until a check brings its stamp back.
   */
  updatedAt?: SyncStamp;
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
  /**
   * The name as logged. This is the session's name snapshot (TICKET-042): read
   * only when `exerciseId` is not in the catalog, never validated. Rejected: a
   * separate `nameSnapshot` here, which would hold the same string twice.
   */
  exerciseName: string;
  sessionId: string;
  workoutId: string;
  workoutName: string;
  performedAt: number;
  fields: ExerciseField[];
  /** One record per set, in set order: position is the set number. See `StoredSet`. */
  sets: StoredSet[];
};

/** A session as embedded in the rollup. Same data, bounded count. */
export type StatsSessionEntry = {
  sessionId: string;
  workoutId: string;
  workoutName: string;
  performedAt: number;
  fields: ExerciseField[];
  /** Copied from `ExerciseSessionDoc.sets` as stored. */
  sets: StoredSet[];
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
  /**
   * When the server last wrote this doc (TICKET-076): `serverTimestamp()` on
   * every writer, plain numbers on the phone. Absent on a doc written before
   * 076, whose `updatedAt` is a phone-clock number: reads drop that value
   * (`toStamp`), so the name has one meaning in the app. Also absent on what
   * `applySessionToStats` returns: the writer adds the stamp.
   */
  updatedAt?: SyncStamp;
};
