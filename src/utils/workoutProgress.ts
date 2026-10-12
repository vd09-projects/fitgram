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
 * Planned set count assumed for an exercise with no usable history. The plan
 * records no set count, so without last session to go on this is a guess —
 * chosen deliberately over showing nothing. 3 is the common default; at 2 sets
 * the segment reads 67%, at 3 it is full.
 *
 * Rejected, after a device test: one 3px tick per set with no target. It was
 * honest (a count, not a ratio) but any mark inside a bar reads as a
 * percentage, so 2 logged sets looked like 3% progress.
 */
export const DEFAULT_TARGET_SETS = 3;

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
 * The current segment fills `setsLogged / targetSets`, capped at 1 (beating the
 * target does not overflow the segment). `targetSets` is last session's set
 * count when known, else `DEFAULT_TARGET_SETS`; `targetSource` says which, so
 * a caller can tell a measured target from an assumed one.
 */
export type ProgressSegment =
  | { state: "done"; setsLogged: number }
  | { state: "untouched" }
  | {
      state: "current";
      setsLogged: number;
      /** Always >= 1. */
      targetSets: number;
      targetSource: "lastSession" | "default";
      /** setsLogged / targetSets, capped at 1. */
      fill: number;
    };

export function buildProgressSegments(
  exercises: Pick<LoggedExercise, "sets">[],
  currentIndex: number | null,
  lastSessionSetCount: number | null
): ProgressSegment[] {
  const measured =
    lastSessionSetCount !== null &&
    Number.isFinite(lastSessionSetCount) &&
    lastSessionSetCount >= 1
      ? Math.floor(lastSessionSetCount)
      : null;
  const targetSets = measured ?? DEFAULT_TARGET_SETS;
  const targetSource = measured === null ? "default" : "lastSession";

  return exercises.map((exercise, index): ProgressSegment => {
    const setsLogged = exercise.sets.length;
    if (index === currentIndex) {
      return {
        state: "current",
        setsLogged,
        targetSets,
        targetSource,
        fill: Math.min(setsLogged / targetSets, 1),
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
