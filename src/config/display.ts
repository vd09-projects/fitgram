// src/config/display.ts
//
// How much each screen shows, and how many docs it reads to show it. Rule for
// this folder: src/config/README.md.

/** Most tiles the Workout hub shows (TICKET-066). The rest are under All plans. */
export const HUB_TILE_LIMIT = 6;

/** Recent rows shown in the exercise picker (user, 2026-10-27, D5). */
export const RECENT_LIMIT = 10;

/** Search results shown at once. Totals beyond it are not listed; a longer query narrows them. */
export const PICKER_RESULT_LIMIT = 100;

/** The history sheet's `sessions` window. */
export const HISTORY_RECENT_SESSION_COUNT = 3;

/**
 * The history sheet's `volumeTrend` window.
 *
 * Must not exceed `STATS_RECENT_SESSION_CAP` (10) while `VolumePoint` carries
 * no unit. The history sheet hides the trend when `unitMismatch` is set, and
 * `unitMismatch` only scans `recentSessions`. Past that cap a shown point can
 * come from a session it never scanned, and kg and lb volumes would share one
 * chart with no notice. Asserted in config.test.ts; TICKET-036 removes
 * the limit by putting a unit on `VolumePoint`.
 */
export const HISTORY_TREND_SESSION_COUNT = 6;

/**
 * Exercise sessions the History filter screen reads per exercise, newest
 * first, before narrowing them to the selected plan. A plan whose sessions of
 * this exercise are all older than this window shows none.
 */
export const HISTORY_FILTER_SESSION_WINDOW = 50;

/**
 * Freestyle sessions read to list its exercises: one query, the
 * `sessions (workoutId, startedAt desc)` index, newest first. Matches
 * `HISTORY_FILTER_SESSION_WINDOW`, the exercise sessions the filter reads per
 * exercise. An exercise done only in an older Freestyle is not offered;
 * rejected: paging through every Freestyle on each History open.
 */
export const FREESTYLE_HISTORY_WINDOW = 50;

/**
 * The History home's Workouts rail shows the current month in full; when that month has fewer
 * workouts than this, it runs back into earlier months until it has this many (TICKET-085a). A
 * month that gets cut is split: its newest workouts are in the rail, the rest sit in its Earlier
 * row. What is shown is a count of workouts, not days, so a quiet month does not leave the top of
 * History nearly empty.
 */
export const HISTORY_RAIL_MIN_FULL = 10;

/**
 * How many older workouts one tap on "Older workouts" loads (TICKET-085a, decided in TICKET-088).
 * Each is one document read, so a tap costs about this many reads. The row's label reads this value.
 */
export const OLDER_WORKOUTS_PAGE_SIZE = 20;


/**
 * How many of a lift's earlier sessions the Session screen's compare sets beside today's (TICKET-083).
 * They come from the exercise summaries already held, so a bigger number costs no read, only width.
 */
export const SESSION_COMPARE_COUNT = 3;

/**
 * How many sets a closed lift card on the Session screen lists before "+N more" (TICKET-083). Opening the card
 * lists every set in the compare. Boards 07 and 12 do not agree on a number (their rows differ in width), so
 * this is the ticket's "up to 4 sets" read as a count, to be judged against the boards on the device.
 */
export const SESSION_CARD_SETS_SHOWN = 4;
