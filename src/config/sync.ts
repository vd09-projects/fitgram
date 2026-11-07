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
 * Ids per Firestore `in` query; reads of more ids are split into chunks of
 * this size. Firestore `in` accepts at most 30 values, so this is a ceiling
 * set by Firestore, not a free knob: lower is allowed (more queries), higher
 * makes every chunked read fail.
 */
export const IN_QUERY_CHUNK = 30;
