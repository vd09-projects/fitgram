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
 * How many workouts the phone keeps at least (TICKET-082, decided in TICKET-087).
 * It keeps whole months, newest first, until it has this many, so the number
 * floats up by the last month it takes. What it feeds: the Workouts list, its
 * month rows, the filter counts and a recent month opened offline. Sized for
 * the busiest user the ticket named, two workouts a day for three months.
 * Not everything: a copy of every workout grows with history, a new phone reads
 * all of it, and it reaches Android's database cap at about a thousand workouts.
 * Older months are fetched when asked (`getWorkoutsOfMonth`) and not kept.
 * Not part of this number: the newest workout of every plan is kept as well, however
 * old (the floor, `utils/workoutWindow.ts`), so a plan idle for longer than the window
 * still has a date.
 *
 * Changes stored data only at a trim or a full reload: a copy built with another value
 * is read as it is. A Finish trims when the value is lower than the copy holds and never
 * widens it, and a held copy does not first-load, so a raised value reaches a phone only
 * with a full reload.
 */
export const WORKOUTS_ON_PHONE_MIN = 180;

/**
 * The workouts' check skip and wait: the plans' values (D4, D9), own names so
 * either can be tuned alone. One hub → Start → Manage visit costs one check.
 */
export const WORKOUTS_CHECK_SKIP_MS = PLANS_CHECK_SKIP_MS;
export const WORKOUTS_CHECK_WAIT_MS = PLANS_CHECK_WAIT_MS;

/**
 * The least time between a refused read of an older month (`offline` or `failed`) and the next
 * read of it. A caller that asks again from an effect, or a screen focused twice, must not turn a
 * refusal that comes back at once (a permission error) into a read per render. Short: a person
 * who reconnects and taps again should not be made to wait. An ask inside it is ignored and the
 * refusal stays shown. Not applied to a month still loading (that ask joins the read, or after the
 * wait starts a new one) or to a month already loaded.
 */
export const WORKOUTS_MONTH_RETRY_GAP_MS = 2_000;

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
