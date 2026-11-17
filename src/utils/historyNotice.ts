import type { PendingUpload } from "../types/zustandWorkoutType";

export type HistoryNotice =
  | { kind: "didNotUpload"; text: string; tryAgain: true }
  | { kind: "waiting"; text: string; tryAgain: false }
  | { kind: "checkFailed"; text: string; tryAgain: false };

const workouts = (n: number) => `${n} workout${n === 1 ? "" : "s"}`;

/**
 * The one line under the History tabs (TICKET-085a, boards HistHome09 to 11). One notice at a time,
 * in this order, the most actionable first:
 * - `didNotUpload`: an entry of this user's was rejected by the server (`failedAttempts > 0`), so
 *   retrying can help and the strip offers Try again. Counts the rejected entries only.
 * - `waiting`: entries of this user's that are queued with no rejection yet (offline, or not yet
 *   drained). A hang is not a failure (`PendingUpload.failedAttempts`), so no Try again.
 * - `checkFailed`: the workouts store's last check failed and nothing is waiting.
 * Entries of another account are not this user's and are never counted (`PendingUpload.uid`).
 *
 * Decision: `checkFailed` does not say "Offline". The store records that a check failed and its
 * message, not why (`SyncFields.lastResult`); the board's "Offline" would assert a cause this code
 * cannot know (CLAUDE.md 2.4). Rejected: adding an offline flag to the shared sync runner for one
 * strip. The wording is flagged on the ticket for the user to overrule.
 */
export function historyNotice(
  pending: readonly Pick<PendingUpload, "uid" | "failedAttempts">[],
  uid: string | undefined,
  checkFailed: boolean
): HistoryNotice | null {
  const mine = uid === undefined ? [] : pending.filter((entry) => entry.uid === uid);
  const rejected = mine.filter((entry) => entry.failedAttempts > 0).length;
  if (rejected > 0) return { kind: "didNotUpload", text: `${workouts(rejected)} didn’t upload`, tryAgain: true };
  if (mine.length > 0) return { kind: "waiting", text: `${workouts(mine.length)} waiting to upload`, tryAgain: false };
  if (checkFailed)
    return { kind: "checkFailed", text: "Couldn’t check for new workouts", tryAgain: false };
  return null;
}
