// src/config/sync.ts
//
// How often the phone asks the server, and how long it waits: the plan checks
// (TICKET-070) and the size of a batched Firestore read. Rule for this folder:
// src/config/README.md.
//
// No store re-reads everything on a timer (TICKET-076): every app write is
// stamped, so a change check finds it (`fullReloadDue` in utils/syncCore.ts).

/**
 * A check that succeeded this recently makes the next screen skip its own (D4).
 * Its job is quick back-and-forth between screens, which takes seconds. Keep it
 * short (TICKET-076): a longer window only delays what another phone wrote, and
 * the reads it saves cost nothing at this scale. It also limits how often the
 * stored copies are rewritten: every successful check rewrites them, changed or
 * not.
 */
export const PLANS_CHECK_SKIP_MS = 60 * 1000;

/**
 * How long a screen with nothing stored waits on a check before it shows
 * "Couldn't load plans" (D9). The check is not cancelled: its answer still
 * applies when it arrives. Its own constant, not `SAVE_GRACE_MS`: a save and a
 * read fail offline differently, and one may need tuning without the other.
 */
export const PLANS_CHECK_WAIT_MS = 10_000;

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
 * load: up to N reads per plan, plus 1).
 */
export const WORKOUTS_PER_PLAN = 5;

/**
 * How many workouts the phone keeps at least (TICKET-082, decided in TICKET-087).
 * It keeps whole months, newest first, until it has this many, so the number
 * floats up by the last month it takes. What it feeds: the Workouts list, its
 * month rows, the filter counts and a recent month opened offline. Sized for
 * the busiest user the ticket named, two workouts a day for three months.
 * Not everything: a copy of every workout grows with history, a new phone reads
 * all of it, and it reaches Android's database cap at about a thousand workouts.
 * Older months are fetched when asked (`getWorkoutsOfMonth`) and not kept.
 *
 * Changes stored data only at the next trim: a copy built with another value
 * is read as it is, and the next Finish or first load applies the new one.
 * Raising it fetches nothing by itself.
 */
export const WORKOUTS_ON_PHONE_MIN = 180;

/**
 * The workouts' check skip and wait: the plans' values (D4, D9), own names so
 * either can be tuned alone. One hub → Start → Manage visit costs one check.
 */
export const WORKOUTS_CHECK_SKIP_MS = PLANS_CHECK_SKIP_MS;
export const WORKOUTS_CHECK_WAIT_MS = PLANS_CHECK_WAIT_MS;

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
