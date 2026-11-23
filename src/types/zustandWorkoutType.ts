import { Exercise, ExerciseField } from "./workoutType";
import { Effort, LiftRecord } from "./workoutSession";

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
  /**
   * The plan's exercise this slot replaced, while it is swapped (TICKET-047):
   * what "Back to plan: <name>" in the swap picker offers. Absent when the slot
   * holds what the plan has. Set by the first `swapExercise`, kept by a second
   * one (it is still the plan's), dropped by swapping back.
   *
   * Live state only, in AsyncStorage with the rest of the workout. It never
   * reaches Firestore: `buildSessionDocs` builds each session doc from named
   * fields, not a spread. That is the edge of the ticket's "Not recorded",
   * which rules out a stored `substitutedFor`, not what Back to plan needs.
   * Rejected: rereading the plan, which Manage Workout can change mid-workout
   * and which is not on the phone offline. Optional, so a workout stored
   * before it loads unchanged (no `LOCAL_DATA_VERSION` bump).
   */
  planned?: Exercise;
  /**
   * The slot was added during the workout (TICKET-056), so the plan has no
   * exercise here. Kept through swaps, and a swapped added slot never gets a
   * `planned`: there is no plan's exercise to go back to.
   *
   * Live state only, like `planned`, and for the same reason. The ticket's "not
   * marked as added" rules out the screen and Firestore, not this: without it,
   * swapping an added slot would record the added exercise as the plan's and
   * offer "Back to plan" to it. Rejected: `planned: null` for "added", one
   * field instead of two, but a meaning hidden in null.
   */
  added?: true;
  /**
   * The stored record's "Swapped in for X" (`LiftRecord.swappedFrom`), on a slot of an edit draft only
   * (TICKET-102). A draft is built from the stored workout, which keeps only the plan exercise's id and name,
   * not the whole `Exercise` that `planned` holds, so the caption travels here and `buildLiftRecord` writes it
   * back. Rejected: a `planned` made up from the id and name, which would offer a "Back to plan" with no fields.
   */
  swappedFrom?: { id: string; name: string };
}

// Type for active workout
export interface ActiveWorkout {
  id: string;
  name: string;
  startTime: number;
  exercises: LoggedExercise[];
  currentExerciseIndex: number | null; // Track the current exercise index
  /**
   * Set when the slot holds an edit of a past workout (TICKET-102), not a workout in progress. The draft keeps
   * the workout's own `id`, `name` and `startTime`, so `buildSessionId` names the same stored doc. Every reader
   * that takes the slot as "a workout is running" reads `liveWorkoutOf` instead; Finish refuses a draft.
   * In the slot, so a draft survives an app kill like a workout does. Optional: a workout saved before it
   * loads unchanged.
   */
  editOf?: EditOf;
}

/** What an edit draft remembers of the workout it edits (TICKET-102). */
export interface EditOf {
  sessionId: string;
  /** The stored end, kept on Save: an edit is not the end of a workout. */
  endedAt: number;
  /**
   * The draft's lifts as they were when the edit opened (`draftLifts`), to tell whether anything changed:
   * Cancel asks first only then, and Save is on only then.
   */
  original: LiftRecord[];
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
