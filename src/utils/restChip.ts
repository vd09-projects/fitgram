// src/utils/restChip.ts
//
// What the header's rest chip shows (TICKET-099): the rest running somewhere
// other than on screen. Pure, derived from the store's `rest` and `now`, so the
// chip holds no timer state and a remount or a return from the background reads
// the right thing. Tests: restChip.test.ts, next to this file.

import { REST_DONE_CHIP_MS } from "../config/workout";
import { formatCountdown, restCountdown, RestTimer } from "./restTimer";

/** Whether `rest` belongs to the exercise on screen, where the card is and the chip is not wanted. */
export function isRestingExercise(rest: RestTimer, viewingExerciseId: string | null): boolean {
  return rest.exerciseId === viewingExerciseId;
}

/**
 * The wall-clock time after which the chip has nothing left to show for `rest`
 * (the end of the "Rest over" window), for the component to stop its clock.
 * `restChipState` reads the same moment, so the two cannot disagree. Moves
 * later when add-time lengthens the rest.
 */
export function restChipEndsAt(rest: RestTimer): number {
  return rest.startedAt + rest.durationMs + REST_DONE_CHIP_MS;
}

export type RestChipState =
  | {
      kind: "running";
      /** `m:ss`, as the card shows it. */
      remaining: string;
      /** 0–1, how much of the rest has passed. Drives the fill. */
      elapsedFraction: number;
    }
  | { kind: "done" };

/**
 * The chip for `rest` while `viewingExerciseId` is on screen, or `null` for no chip.
 *
 * - No chip on the resting exercise itself: the full card is there.
 * - **Done is shown for a window after the end, then the chip goes.** Display
 *   only: the rest stays in the store until the user acts on it (the card
 *   withholds Log set and reads "Rest done"; RestPanel), so this never ends it.
 *   Rejected: ending the rest when the chip clears. That would change what the
 *   resting exercise shows while the user is looking at another one.
 * - **A clock that moved backwards shows no chip**, not "Rest over".
 *   `restCountdown` reads it as done, but the end has not come, and a chip
 *   saying so would be a statement that never happened. The rest's real age is
 *   unknowable (see `restCountdown`), so the chip stays out.
 * - A rest with no usable duration has nothing to show: `null`.
 */
export function restChipState(
  rest: RestTimer | null,
  viewingExerciseId: string | null,
  now: number
): RestChipState | null {
  if (rest === null || isRestingExercise(rest, viewingExerciseId)) return null;

  const countdown = restCountdown(rest.startedAt, rest.durationMs, now);
  if (countdown === null) return null;
  if (countdown.state === "running") {
    return {
      kind: "running",
      remaining: formatCountdown(countdown.remainingSeconds),
      elapsedFraction: countdown.elapsedFraction,
    };
  }

  const sinceEnd = now - (rest.startedAt + rest.durationMs);
  return sinceEnd >= 0 && now < restChipEndsAt(rest) ? { kind: "done" } : null;
}
