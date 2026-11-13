// src/config/storedData.ts
//
// Caps that set the shape of what is stored in Firestore: the per-exercise
// rollup (`exercise_stats`) keeps at most this many entries. Unlike the other
// files here, these are written into stored docs, so a change does not apply
// to data already saved. Rule for this folder: src/config/README.md.

/**
 * Sessions embedded in the rollup (`recentSessions`). Deeper history comes from
 * exercise_sessions.
 *
 * Changes stored data: each workout re-folds only its own exercises' rollups
 * (`applySessionToStats` keeps `[new, ...old].slice(0, cap)`). Lowering it
 * applies at that exercise's next workout. Raising it does not: the rollup
 * grows by one entry per workout, and sessions already dropped come back only
 * from `src/scripts/rebuildExerciseStats.ts`, run per user. Must stay at or
 * above `HISTORY_RECENT_SESSION_COUNT` and `HISTORY_TREND_SESSION_COUNT`
 * (config.test.ts).
 */
export const STATS_RECENT_SESSION_CAP = 10;

/**
 * Volume trend points kept in the rollup (`volumeHistory`).
 *
 * Changes stored data: as `STATS_RECENT_SESSION_CAP`. Lowering it applies at
 * each exercise's next workout; raising it grows the rollup one point per
 * workout, and only `src/scripts/rebuildExerciseStats.ts` restores dropped
 * points. Must stay at or above `HISTORY_TREND_SESSION_COUNT` (config.test.ts).
 */
export const STATS_VOLUME_HISTORY_CAP = 12;

/**
 * How close two session totals must be to count as the same, as a fraction of
 * the larger one (`compareVolumes`). It absorbs the float noise of summing
 * decimal plates (3 × 1.1 against 3.3), nothing a lifter could feel: it is far
 * below the smallest real change, one rep of one set.
 *
 * Changes stored data: History stores each lift's verdict (TICKET-081). A new
 * value applies to the next workout; verdicts already stored change only when
 * the compare script's repair or `rebuildExerciseStats` rewrites them.
 */
export const VERDICT_SAME_TOLERANCE = 1e-9;
