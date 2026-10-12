// src/utils/workoutProgress.ts
//
// The derived values behind the active-workout shell: which exercise is in
// view, how far through the workout the user is, and how long they have been
// at it. Pure, so the maths is exercised directly by
// `src/scripts/verifyWorkoutShell.ts` instead of being judged off a screen.

import { LoggedExercise } from "../types/zustandWorkoutType";

/**
 * Clamp a requested exercise index into `[0, count - 1]`.
 *
 * `null` when there is nothing to point at (no exercises) or the request is not
 * a finite number — never `0`, which would claim an exercise exists. Fractions
 * truncate toward zero so a computed index cannot land between two exercises.
 */
export function clampExerciseIndex(index: number, count: number): number | null {
  if (!Number.isFinite(index) || !Number.isFinite(count) || count < 1) return null;
  const whole = Math.trunc(index);
  return Math.min(Math.max(whole, 0), Math.floor(count) - 1);
}

/**
 * The index the screen should show for a stored `currentExerciseIndex`.
 *
 * A stored `null` with exercises present (a session saved before the index was
 * set) opens on the first exercise. A stale index past the end — the plan
 * cannot shrink mid-session today, but storage can be old — lands on the last.
 */
export function resolveCurrentIndex(stored: number | null, count: number): number | null {
  return clampExerciseIndex(stored ?? 0, count);
}

/**
 * One segment of the progress bar.
 *
 * Definitions, pinned because each has a defensible alternative:
 *
 * - `done` — not the exercise in view, and at least one set logged. There is no
 *   planned set count anywhere in the data model (`Exercise` carries id, name
 *   and fields only), so "completed" cannot mean "all planned sets logged".
 *   Rejected: "every exercise before the current one", which marks a skipped
 *   exercise as done and an exercise logged out of order as not done.
 * - `current` — the exercise in view, whatever its sets.
 * - `untouched` — not in view, no sets logged. Skipped and not-yet-reached look
 *   the same, deliberately: both have nothing logged.
 *
 * The current segment's fill needs a denominator and the plan does not have
 * one. Last session's set count for the exercise is used when it is known
 * (`fill`, capped at 1 — beating last time does not overflow the segment).
 * When it is not known — a new exercise, or a cold cache — `fill` is `null` and
 * the screen shows one tick per logged set instead. Rejected: a fixed guess of
 * the target (3, 4, 5 sets), which renders a plausible ratio of nothing.
 */
export type ProgressSegment =
  | { state: "done"; setsLogged: number }
  | { state: "untouched" }
  | {
      state: "current";
      setsLogged: number;
      /** Last session's set count, or null when unknown. Never 0. */
      targetSets: number | null;
      /** setsLogged / targetSets capped at 1; null whenever targetSets is. */
      fill: number | null;
    };

export function buildProgressSegments(
  exercises: Pick<LoggedExercise, "sets">[],
  currentIndex: number | null,
  currentTargetSets: number | null
): ProgressSegment[] {
  const target =
    currentTargetSets !== null &&
    Number.isFinite(currentTargetSets) &&
    currentTargetSets > 0
      ? Math.floor(currentTargetSets)
      : null;

  return exercises.map((exercise, index): ProgressSegment => {
    const setsLogged = exercise.sets.length;
    if (index === currentIndex) {
      return {
        state: "current",
        setsLogged,
        targetSets: target,
        fill: target === null ? null : Math.min(setsLogged / target, 1),
      };
    }
    return setsLogged > 0 ? { state: "done", setsLogged } : { state: "untouched" };
  });
}

/**
 * Elapsed session time as `m:ss` under an hour, `h:mm:ss` from an hour on.
 *
 * Derived from the session's `startTime` on every call, never accumulated, so it
 * is right after navigating away, backgrounding, or restarting the app.
 *
 * `null` for a missing or non-finite start. A start in the future (device clock
 * moved back) reads as `0:00` rather than a negative duration.
 */
export function formatElapsed(startTime: number | null | undefined, now: number): string | null {
  if (startTime === null || startTime === undefined) return null;
  if (!Number.isFinite(startTime) || !Number.isFinite(now)) return null;

  const totalSeconds = Math.max(0, Math.floor((now - startTime) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, "0");

  if (hours === 0) return `${minutes}:${ss}`;
  return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
}
