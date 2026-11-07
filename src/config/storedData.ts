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
 * Changes stored data: existing rollups keep the old length until each
 * exercise's next workout re-folds it, so raising it shows nothing new until
 * then. Run `src/scripts/rebuildExerciseStats.ts` per user to apply it to every
 * exercise at once. Must stay at or above `HISTORY_RECENT_SESSION_COUNT` and
 * `HISTORY_TREND_SESSION_COUNT` (config.test.ts).
 */
export const STATS_RECENT_SESSION_CAP = 10;

/**
 * Volume trend points kept in the rollup (`volumeHistory`).
 *
 * Changes stored data: as `STATS_RECENT_SESSION_CAP`, existing rollups change
 * only when re-folded; rebuild with `src/scripts/rebuildExerciseStats.ts`. Must
 * stay at or above `HISTORY_TREND_SESSION_COUNT` (config.test.ts).
 */
export const STATS_VOLUME_HISTORY_CAP = 12;
