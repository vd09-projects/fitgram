// src/utils/exerciseStats.ts
//
// Pure builders for the stored session docs and the exercise_stats rollup.
// No Firestore, no React — the write path and the rebuild script both call
// these, so the rollup they produce is identical by construction.

import { ActiveWorkout } from "../types/zustandWorkoutType";
import {
  ExerciseSessionDoc,
  ExerciseStatsDoc,
  WorkoutSessionDoc,
  StatsBestEntry,
  StatsSessionEntry,
  StatsVolumePoint,
  StoredSetFields,
} from "../types/workoutSession";
import { NumericFieldMap, parseSet, resolveNumericFields } from "./exerciseFields";

/** Sessions embedded in the rollup. Deeper history comes from exercise_sessions. */
export const STATS_RECENT_SESSION_CAP = 10;
/** Volume trend points kept in the rollup. */
export const STATS_VOLUME_HISTORY_CAP = 12;

export type SessionVolume = {
  /** Sum of weight x reps, or null. Never a partial sum — see below. */
  value: number | null;
  setsCounted: number;
  setsTotal: number;
};

/**
 * volume = sum of weight x reps across a session's sets.
 *
 * **All or nothing.** A session reports a number only when every one of its sets
 * parsed for both weight and reps. One unparseable set and `value` is null,
 * because a partial sum reads as a genuinely smaller session and silently
 * understates what was done. `setsCounted` / `setsTotal` travel alongside so a
 * consumer can show "volume unavailable (3 of 4 sets)" rather than a wrong total.
 *
 * No sets, or no weight/reps pair on the exercise, also reports null.
 */
export function computeSessionVolume(
  sets: StoredSetFields[],
  numeric: NumericFieldMap | null
): SessionVolume {
  const setsTotal = sets.length;
  if (!numeric || setsTotal === 0) {
    return { value: null, setsCounted: 0, setsTotal };
  }

  let total = 0;
  let setsCounted = 0;
  for (const set of sets) {
    const { weight, reps } = parseSet(set, numeric);
    if (weight === null || reps === null) continue;
    total += weight * reps;
    setsCounted += 1;
  }

  return {
    value: setsCounted === setsTotal ? total : null,
    setsCounted,
    setsTotal,
  };
}

export function buildStatsSessionEntry(
  doc: ExerciseSessionDoc
): StatsSessionEntry {
  const numeric = resolveNumericFields(doc.fields);
  return {
    sessionId: doc.sessionId,
    workoutId: doc.workoutId,
    workoutName: doc.workoutName,
    performedAt: doc.performedAt,
    fields: doc.fields,
    sets: doc.sets,
    volume: computeSessionVolume(doc.sets, numeric).value,
  };
}

/**
 * best = **heaviest weight at equal reps**, all-time.
 *
 * "Heaviest 8-rep set" is `max(weight)` over every logged set whose reps parse
 * to exactly 8. Not an estimated 1RM, not the heaviest set overall; rep counts
 * are never ranked against each other, so a 100kg triple and an 80kg set of ten
 * are separate records. One entry per distinct rep count.
 *
 * Excluded: non-integer reps (a set of 8.5 is a typo) and zero reps. A weight of
 * 0 is kept — that is how a bodyweight movement is logged. Ties keep the
 * existing record: it stands until it is beaten, not until it is matched.
 *
 * Records are kept per (reps, unit), never per reps alone. A set of 8 at 160 lb
 * is not a heavier 8-rep set than 67.5 kg, it is a different record, and letting
 * one overwrite the other would destroy real history on a unit change. Readers
 * select the records matching the exercise's current unit; see
 * `bestSetsFromStats`.
 */
export const bestKey = (reps: number, unit?: string) => `${reps}|${unit ?? ""}`;

function applyBest(
  bestByReps: Record<string, StatsBestEntry>,
  doc: ExerciseSessionDoc
): Record<string, StatsBestEntry> {
  const numeric = resolveNumericFields(doc.fields);
  if (!numeric) return bestByReps;

  const unit = numeric.weight.unit;
  const next = { ...bestByReps };

  doc.sets.forEach((set, index) => {
    const { weight, reps } = parseSet(set, numeric);
    if (weight === null || reps === null) return;
    if (!Number.isInteger(reps) || reps <= 0) return;

    const key = bestKey(reps, unit);
    const current = next[key];

    if (!current || weight > current.weight) {
      next[key] = {
        reps,
        weight,
        unit,
        performedAt: doc.performedAt,
        sessionId: doc.sessionId,
        workoutId: doc.workoutId,
        setNumber: index + 1,
      };
    }
  });

  return next;
}

const newestFirst = (a: { performedAt: number }, b: { performedAt: number }) =>
  b.performedAt - a.performedAt;

/**
 * Fold one session into the rollup.
 *
 * Idempotent per session: re-applying the same `sessionId` replaces its entry
 * rather than duplicating it, so a retried write is safe.
 *
 * One thing this cannot do is *lower* a record — if a session is edited down,
 * `bestByReps` keeps the old maximum. That is inherent to an incremental fold
 * and is why `exercise_sessions` stays authoritative and
 * `src/scripts/rebuildExerciseStats.ts` exists. Editing or deleting a logged set
 * must trigger a rebuild for that exercise.
 */
export function applySessionToStats(
  previous: ExerciseStatsDoc | null,
  doc: ExerciseSessionDoc,
  now: number = Date.now()
): ExerciseStatsDoc {
  const entry = buildStatsSessionEntry(doc);

  const recentSessions = [
    entry,
    ...(previous?.recentSessions ?? []).filter(
      (s) => s.sessionId !== doc.sessionId
    ),
  ]
    .sort(newestFirst)
    .slice(0, STATS_RECENT_SESSION_CAP);

  const volumeHistory: StatsVolumePoint[] = [
    { sessionId: doc.sessionId, performedAt: doc.performedAt, volume: entry.volume },
    ...(previous?.volumeHistory ?? []).filter(
      (p) => p.sessionId !== doc.sessionId
    ),
  ]
    .sort(newestFirst)
    .slice(0, STATS_VOLUME_HISTORY_CAP)
    .reverse();

  // The newest session owns the name and field definitions.
  const isNewest =
    !previous || doc.performedAt >= previous.lastPerformedAt;

  return {
    exerciseId: doc.exerciseId,
    exerciseName: isNewest ? doc.exerciseName : previous.exerciseName,
    lastPerformedAt: Math.max(previous?.lastPerformedAt ?? 0, doc.performedAt),
    fields: isNewest ? doc.fields : previous.fields,
    recentSessions,
    bestByReps: applyBest(previous?.bestByReps ?? {}, doc),
    volumeHistory,
    updatedAt: now,
  };
}

/**
 * Recompute a rollup from scratch. The repair path for drift, and the only way
 * a record can go down after an edit.
 */
export function rebuildStatsFromSessions(
  exerciseId: string,
  docs: ExerciseSessionDoc[],
  now: number = Date.now()
): ExerciseStatsDoc | null {
  const relevant = docs
    .filter((doc) => doc.exerciseId === exerciseId)
    .sort((a, b) => a.performedAt - b.performedAt);

  if (relevant.length === 0) return null;

  let stats: ExerciseStatsDoc | null = null;
  for (const doc of relevant) {
    stats = applySessionToStats(stats, doc, now);
  }
  return stats;
}

/** Doc ids cannot contain `/`; whitespace is normalised for readability. */
const safeId = (value: string) => value.replace(/\s+/g, "_").replace(/\//g, "-");

export const buildSessionId = (workoutId: string, startTime: number) =>
  safeId(`${workoutId}_${startTime}`);

export const buildExerciseSessionId = (sessionId: string, exerciseId: string) =>
  safeId(`${sessionId}__${exerciseId}`);

/**
 * Turn the live workout into the docs that get stored.
 *
 * Exercises with no logged sets are dropped: writing them would put "last time:
 * 0 sets" into history for an exercise that was skipped.
 */
export function buildSessionDocs(
  workout: ActiveWorkout,
  endedAt: number
): { session: WorkoutSessionDoc; exerciseSessions: ExerciseSessionDoc[] } {
  const sessionId = buildSessionId(workout.id, workout.startTime);

  const exerciseSessions: ExerciseSessionDoc[] = workout.exercises
    .filter((exercise) => exercise.sets.length > 0)
    .map((exercise) => ({
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      sessionId,
      workoutId: workout.id,
      workoutName: workout.name,
      performedAt: workout.startTime,
      fields: exercise.fields,
      // Positional only. The live `ExerciseSet.id` is a Date.now() stamp and is
      // deliberately not persisted — it was never a set number.
      sets: exercise.sets.map((set) => set.fields),
    }));

  return {
    session: {
      sessionId,
      workoutId: workout.id,
      workoutName: workout.name,
      startedAt: workout.startTime,
      endedAt,
      exerciseIds: exerciseSessions.map((e) => e.exerciseId),
      rollupPending: true,
    },
    exerciseSessions,
  };
}
