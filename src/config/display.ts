// src/config/display.ts
//
// How much each screen shows, and how many docs it reads to show it. Rule for
// this folder: src/config/README.md.

/** Most tiles the Workout hub shows (TICKET-066). The rest are under All plans. */
export const HUB_TILE_LIMIT = 6;

/** Recent sessions read on open. Plans not done within this window show no date. */
export const RECENT_SESSIONS_WINDOW = 20;

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
 * chart with no notice. Asserted in historySheet.test.ts; TICKET-036 removes
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
