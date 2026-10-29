import { ExerciseField } from "./workoutType";
import { Effort } from "./workoutSession";

// Type for a single set in an exercise
export interface ExerciseSet {
  /**
   * AN ORDINAL, NOT AN IDENTITY. The set's 1-based position in its exercise:
   * `addSetToExercise` appends at `last + 1`, and `removeSet` / `restoreSet`
   * renumber the rest to 1..n (TICKET-019). That is what lets set id, list
   * position and `ExerciseHistory.setAt(n)` agree.
   *
   * So an id held across a removal is stale: after removing set 2, "set 3" is
   * a different set. `updateSet(exerciseId, setId, …)` keys on it — read the id
   * fresh from the store, never from something captured before a removal.
   */
  id: number;
  /**
   * The set's values, one entry per segment, never empty (TICKET-055). A normal
   * set is one segment; a set split mid-way (TICKET-033) is more: 15 kg × 5,
   * then 12.5 kg × 3 is `[15 × 5, 12.5 × 3]`. Each segment holds the
   * exercise's own fields by name (reps, weight, time, …), as the card typed
   * them.
   *
   * `segments[0]` is the set as planned: everything that compares a set with
   * last time (ghosts, deltas, `bestByReps`) reads it and never a later
   * segment. Volume counts every segment.
   *
   * One list because the card drafts one list (`rows[0]` is the set). Replaced:
   * `fields` (the first segment) plus an optional `splits` (the rest), which
   * every write split apart and every reader stitched back. Not converted on
   * read: an older build's workout is cleared at load (`LOCAL_DATA_VERSION` 3).
   *
   * Written once, on Log, from the card's rows; replaced whole by `updateSet`.
   * On the set object, so `removeSet` / `restoreSet` carry every segment.
   */
  segments: Record<string, string | number>[];
  /**
   * How the set felt, marked by the user (TICKET-034). Absent or null: not
   * marked. Lives on the set object so `removeSet` / `restoreSet` carry it with
   * the set they move. Optional because a workout stored before 034 lacks it;
   * every reader treats absent as null.
   */
  effort?: Effort | null;
}

// Type for logged exercises
export interface LoggedExercise {
  id: string;
  name: string;
  /**
   * The plan's `Exercise.nameSnapshot` (TICKET-042), so a workout still names
   * its exercises when an id is missing from the catalog; the session doc keeps
   * it as `ExerciseSessionDoc.exerciseName`. Copied by `startWorkout`, refreshed
   * from the catalog as it reads then.
   */
  nameSnapshot?: string;
  /** Carried from the plan's `Exercise.fields`, roles included. */
  fields: ExerciseField[];
  sets: ExerciseSet[];
}

// Type for active workout
export interface ActiveWorkout {
  id: string;
  name: string;
  startTime: number;
  lastUpdated: number;
  exercises: LoggedExercise[];
  currentExerciseIndex: number | null; // Track the current exercise index
}
/**
 * A finished workout that has not reached the server yet (TICKET-028). Lives in
 * the upload queue from the moment Finish succeeds on the phone until its upload
 * succeeds, and survives an app restart.
 */
export interface PendingUpload {
  /** `buildSessionId(workout.id, workout.startTime)`. One entry per session. */
  sessionId: string;
  /**
   * The user who did the workout — not whoever is signed in when the upload
   * runs. The rules only let a uid write under `users/{uid}`, so an entry is
   * uploaded only while its own user is signed in, and waits otherwise.
   */
  uid: string;
  workout: ActiveWorkout;
  /** When Finish was tapped; recorded as the session's end, however late the upload. */
  endedAt: number;
  /** Uploads that were rejected. A hang (offline) is not a failure and does not count. */
  failedAttempts: number;
  /** Message of the latest rejection, or null if none yet. */
  lastError: string | null;
}
