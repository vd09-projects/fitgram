// src/services/restNotification/adapter.ts
//
// Keeps the lock-screen rest notification in step with the store's `rest`
// (TICKET-079). It takes a `RestTimer` and knows nothing about a platform: the
// native module is the Android half, and a platform with none reports "not
// posted" and the rest timer carries on. iOS slots in behind the same calls.
//
// One subscriber on `rest` sees every start, add-time, skip, finish and removal,
// since each of them replaces or clears that one field. Nothing re-posts on a
// timer: the OS draws the ticking from the end time.

import RestNotification from "../../../modules/rest-notification";
import { useCatalogStore } from "../../stores/useCatalogStore";
import { useWorkoutStore } from "../../stores/useWorkoutStore";
import { CATALOG_NOT_LOADED, exerciseDisplayName } from "../../utils/catalog";
import { restEndAt, RestTimer } from "../../utils/restTimer";
import { buildRestCopy } from "./copy";

export type RestNotificationAction = { kind: "show"; endAt: number } | { kind: "clear" } | null;

const sameRest = (a: RestTimer | null, b: RestTimer | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.exerciseId === b.exerciseId &&
    a.startedAt === b.startedAt &&
    a.durationMs === b.durationMs &&
    a.setNumber === b.setNumber);

/**
 * What to do when `rest` goes from `prev` to `next`. `prev` of `undefined` is the
 * first look, at app start.
 *
 * - A running rest: show it, ending at `restEndAt`. Add-time arrives here too, as
 *   the same rest with a later end, and the native side replaces the old post.
 * - Anything else, including a rest that is already over: clear. Nothing may
 *   stand for a rest that is not running. At app start this is also what removes
 *   a notification the last run left behind: `rest` is memory only, so a restart
 *   always begins with none, and a notification from the killed process would
 *   otherwise count down past zero for good.
 * - Same rest as before: nothing. The store notifies on every change, not only
 *   this field's.
 */
export function planRestNotification(
  prev: RestTimer | null | undefined,
  next: RestTimer | null,
  now: number
): RestNotificationAction {
  if (prev !== undefined && sameRest(prev, next)) return null;
  const endAt = next === null ? null : restEndAt(next, now);
  return endAt === null ? { kind: "clear" } : { kind: "show", endAt };
}

/**
 * The exercise's name and the set it leads to, as the notification words them.
 * The name goes through `exerciseDisplayName`, as the screen does: a catalog
 * exercise stores `name: ""` and keeps its built name elsewhere, so reading
 * `name` gave a blank (found on the emulator). Where the catalog is not loaded
 * the screen's placeholder is no name for a lock screen; the line then drops the
 * exercise (`fillLine`) rather than show it.
 */
function copyFor(rest: RestTimer) {
  const exercise = useWorkoutStore.getState().activeWorkout?.exercises.find((e) => e.id === rest.exerciseId);
  const title = exercise ? exerciseDisplayName(exercise, useCatalogStore.getState().catalog?.index ?? null).title : "";
  return buildRestCopy(title === CATALOG_NOT_LOADED ? "" : title, (exercise?.sets.length ?? rest.setNumber) + 1);
}

function apply(prev: RestTimer | null | undefined, next: RestTimer | null, now: number): void {
  const action = planRestNotification(prev, next, now);
  if (action === null) return;
  // A native error must never reach the timer on screen.
  try {
    if (action.kind === "clear") RestNotification.clear();
    else if (next !== null) RestNotification.show(action.endAt, copyFor(next));
  } catch (error) {
    console.warn("Rest notification failed:", error);
  }
}

/** Start following `rest`. Call once at app start; returns the unsubscribe. */
export function startRestNotificationSync(): () => void {
  apply(undefined, useWorkoutStore.getState().rest, Date.now());
  return useWorkoutStore.subscribe((state, previous) => {
    if (state.rest !== previous.rest) apply(previous.rest, state.rest, Date.now());
  });
}

/** Post again from the current `rest`, for when permission arrives after the rest began. */
export function resyncRestNotification(): void {
  apply(undefined, useWorkoutStore.getState().rest, Date.now());
}

/**
 * The in-app path to the 0:00 layout, for a process that is alive while the
 * native swap did not run on time: a phone in deep sleep (the swap is a Handler,
 * which runs on uptime) or a missed callback. The post is then still counting
 * past zero when the user is back in the app, and the rest panel calls this.
 * Posting the same layout twice changes nothing.
 *
 * Not the killed-process case: `rest` is memory only, so after a kill there is
 * no rest for the panel to see. That post is removed at the next launch by the
 * start-up `clear` in `planRestNotification`, and stands, counting past zero and
 * not swipeable, until then (a known gap, TICKET-079).
 */
export function announceRestDone(rest: RestTimer): void {
  try {
    RestNotification.showDone(copyFor(rest));
  } catch (error) {
    console.warn("Rest notification failed:", error);
  }
}
