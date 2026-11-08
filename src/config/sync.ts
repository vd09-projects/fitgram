// src/config/sync.ts
//
// How often the phone asks the server, and how long it waits: the plan checks
// (TICKET-070) and the size of a batched Firestore read. Rule for this folder:
// src/config/README.md.

/** A check that succeeded this recently makes the next screen skip its own (D4). */
export const PLANS_CHECK_SKIP_MS = 2 * 60 * 1000;

/**
 * How long a screen with nothing stored waits on a check before it shows
 * "Couldn't load plans" (D9). The check is not cancelled: its answer still
 * applies when it arrives. Its own constant, not `SAVE_GRACE_MS`: a save and a
 * read fail offline differently, and one may need tuning without the other.
 */
export const PLANS_CHECK_WAIT_MS = 10_000;

/**
 * D5: a check is a full reload when this long has passed since the last one,
 * so plans removed outside the app (console, scripts), which leave no doc for
 * a change check to return, go from the phone within a week. 7 days, not 2:
 * nothing in the app removes a plan yet, so this catches only hand edits, and
 * a full reload costs one read per plan (up to 20) against 1 for a change
 * check. The future Delete's `REMOVAL_WINDOW` must be at least this long (D5);
 * that ticket adds the test that pins it. Timed by the phone's clock: unlike
 * `lastSeen`, it is only a schedule, and a wrong clock costs a reload early
 * or late, never a missed change (`isFullReloadDue` in utils/planSync.ts).
 */
export const PLANS_FULL_RELOAD_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * How many workouts the phone keeps per plan (TICKET-075), Freestyle counted
 * as one plan. What it feeds: each plan's last-done date, time and volume
 * (needs 1), and the picker's Recent, newest 10 movements across every held
 * workout. 5, not 1: Recent needs a few workouts per plan to find 10
 * movements, and a plan's last 5 cover a movement swapped out of it lately.
 * Not 20 (the old window across all plans): the first load reads N per plan,
 * so 20 would cost up to 20 × plans reads on a fresh install. A movement whose
 * newest use is in a plan's 6th-or-older workout is not in Recent (TICKET-075
 * fact 2); search still finds it.
 *
 * Changes stored data: the stored copy records the N it was built with, and a
 * copy with another N is discarded and refilled at the next check (one first
 * load: one read per plan, plus 1).
 */
export const WORKOUTS_PER_PLAN = 5;

/**
 * The workouts' check skip and wait: the plans' values (D4, D9), own names so
 * either can be tuned alone. One hub → Start → Manage visit costs one check.
 */
export const WORKOUTS_CHECK_SKIP_MS = PLANS_CHECK_SKIP_MS;
export const WORKOUTS_CHECK_WAIT_MS = PLANS_CHECK_WAIT_MS;

/**
 * A check is a full reload of the workouts when this long has passed since the
 * last one: one read per plan, plus 1. What only a full reload catches: a
 * workout deleted on the server (the wipe scripts; nothing in the app deletes
 * one). It also keeps dates right (per-plan reads) while a hand-set future
 * `updatedAt` pins `lastSeen`, but does not unpin it: the baseline is that
 * doc while it exists, so it unpins only once the doc is fixed or gone
 * (070 S1, `workoutsLastSeenAfter`). 7 days, as plans: both are hand edits.
 */
export const WORKOUTS_FULL_RELOAD_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The exercise summaries' check skip and wait (TICKET-076): the plans' values
 * (D4, D9), own names so either can be tuned alone. One plan card → Start costs
 * one check.
 */
export const EXERCISE_SUMMARIES_CHECK_SKIP_MS = PLANS_CHECK_SKIP_MS;
export const EXERCISE_SUMMARIES_CHECK_WAIT_MS = PLANS_CHECK_WAIT_MS;

/**
 * How many AsyncStorage entries the saved exercise summaries are split across
 * (TICKET-076), besides the head entry. Sized at 10× today's data: 480 exercises
 * × ~6 KB full ≈ 2.9 MB. One entry would not survive that: Android's AsyncStorage
 * reads through a plain SQLite cursor, whose window holds about 2 MB per row. 8
 * gives ~360 KB each, with room for an uneven split. Not 1 per exercise: the
 * key list would have to be stored and kept right to remove them on sign-out.
 *
 * Total limit: the library caps its database at 6 MB by default, shared with
 * every other key, so 10× fits and much more would not.
 *
 * Changes stored data: the stored copy records the count, and a copy with
 * another count is discarded and refilled (one first load: one read per doc).
 */
export const EXERCISE_SUMMARIES_SHARDS = 8;
