// src/utils/restTimer.ts
//
// The derived values behind the rest timer (TICKET-021): how much rest is left,
// how far through it the user is, and what adding time does. Kept pure so the
// maths is tested directly rather than judged off a screen. Tests:
// restTimer.test.ts, next to this file.
//
// Everything is derived from a start timestamp and `now`, never from a tick
// counter, the same position `formatElapsed` takes. An interval stops while the
// JS thread is suspended (backgrounded, screen off); a timestamp does not, so
// the value is right the moment the screen renders again.

/** One rest, as the store holds it. */
export type RestTimer = {
  /** The exercise whose set started this rest. The timer shows only there. */
  exerciseId: string;
  /** `Date.now()` when the rest started. */
  startedAt: number;
  /** Total rest, including any time added since. */
  durationMs: number;
  /** The set number whose logging started this rest; the one the panel asks about (TICKET-034). */
  setNumber: number;
};

/** What a rest-duration preference falls back to: 1:30, the design's target. */
export const DEFAULT_REST_MS = 90_000;

/** What one tap of add-time adds. */
export const ADD_REST_MS = 30_000;

export type RestCountdown =
  | {
      state: "running";
      /** Whole seconds left, rounded up: 1:30 at the start, 0:01 until it ends. */
      remainingSeconds: number;
      /** 0–1, how much of the rest has passed. Drives the bar. */
      elapsedFraction: number;
    }
  | { state: "done" };

/**
 * Where a rest stands at `now`.
 *
 * - Rest already over — elapsed while backgrounded or with the screen away —
 *   reads `done`, never a negative time and never a restarted countdown.
 * - **Clock moved backwards** (`now` before `startedAt`) reads `done`.
 *   Rejected: treating it as 0 elapsed, `formatElapsed`'s choice. For an
 *   elapsed time 0:00 is harmless; for a countdown it shows the full rest
 *   again and, since the card is withheld while resting, keeps the user from
 *   logging for however far the clock moved. How long they really rested is
 *   unknowable, and `done` costs them nothing.
 *
 * `null` for a non-finite input or a duration of 0 or less — there is no rest
 * to show, which is not the same as one that has ended.
 */
export function restCountdown(
  startedAt: number,
  durationMs: number,
  now: number
): RestCountdown | null {
  if (!Number.isFinite(startedAt) || !Number.isFinite(durationMs) || !Number.isFinite(now)) {
    return null;
  }
  if (durationMs <= 0) return null;

  const elapsed = now - startedAt;
  if (elapsed < 0 || elapsed >= durationMs) return { state: "done" };

  return {
    state: "running",
    remainingSeconds: Math.ceil((durationMs - elapsed) / 1000),
    elapsedFraction: elapsed / durationMs,
  };
}

/**
 * Seconds as `m:ss`. Negative or non-finite input reads `0:00`: callers pass
 * `remainingSeconds`, which is never negative, so this is only a floor.
 */
export function formatCountdown(totalSeconds: number): string {
  const whole = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * The rest after one add-time tap at `now`.
 *
 * Running: the end moves `addMs` later. Already done: `addMs` from now, not
 * from the old end — adding 30 s to a rest that ended five minutes ago would
 * otherwise still read done. Clock moved backwards (which reads done, see
 * `restCountdown`): a fresh `addMs` rest from now, for the same reason.
 */
export function extendRest(timer: RestTimer, now: number, addMs: number = ADD_REST_MS): RestTimer {
  const elapsed = now - timer.startedAt;
  if (elapsed < 0) return { ...timer, startedAt: now, durationMs: addMs };
  return { ...timer, durationMs: Math.max(timer.durationMs, elapsed) + addMs };
}
