import { ExerciseField } from "./workoutType";

// Type for a single set in an exercise
export interface ExerciseSet {
  id: number;
  fields: Record<string, string | number>; // Dynamic fields (e.g., reps, weight, time)
}

// Type for logged exercises
export interface LoggedExercise {
  id: string;
  name: string;
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
