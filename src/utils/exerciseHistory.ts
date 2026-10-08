// src/utils/exerciseHistory.ts
//
// Derivation of the hook's return value from a cached exercise_stats doc. Pure:
// reads only its arguments and issues no reads of any kind, which is what makes
// "many readers, zero further fetches" true rather than merely intended.

import {
  BestSet,
  ExerciseHistory,
  ExerciseHistoryEntry,
  ExerciseHistorySession,
  HistorySet,
  VolumePoint,
} from "../types/exerciseHistory";
import { StatsSessionEntry } from "../types/workoutSession";
import { ExerciseField } from "../types/workoutType";
import {
  areFieldsComparable,
  NumericFieldMap,
  parseSet,
  resolveNumericFields,
} from "./exerciseFields";
import { computeSessionVolume } from "./exerciseStats";

/** `sessions` window. */
export const HISTORY_RECENT_SESSION_COUNT = 3;
/** `volumeTrend` window. */
export const HISTORY_TREND_SESSION_COUNT = 6;

const NO_FIELDS: ExerciseField[] = [];
const NO_SESSIONS: StatsSessionEntry[] = [];

export function buildHistorySession(
  entry: StatsSessionEntry,
  numeric: NumericFieldMap | null,
  currentFields: ExerciseField[]
): ExerciseHistorySession {
  const comparable = areFieldsComparable(entry.fields, currentFields);
  // A session logged in different units keeps its raw values but contributes no
  // numbers, so nothing downstream can compare 80 lb against 70 kg.
  const sessionNumeric = comparable ? numeric : null;

  const sets: HistorySet[] = entry.sets.map((fields, index) => {
    const { weight, reps } = parseSet(fields, sessionNumeric);
    return {
      // Array position is the only source of set order.
      setNumber: index + 1,
      fields,
      weight,
      reps,
    };
  });

  return {
    sessionId: entry.sessionId,
    workoutId: entry.workoutId,
    workoutName: entry.workoutName,
    performedAt: entry.performedAt,
    sets,
    volume: computeSessionVolume(entry.sets, sessionNumeric),
    comparable,
  };
}

/**
 * Rollup's `bestByReps` map into an ascending array, restricted to records in
 * the exercise's **current** weight unit.
 *
 * Records in another unit are real history but are not comparable to today's
 * numbers, and are not converted. They are left out rather than shown alongside;
 * `ExerciseHistory.unitMismatch` is what tells a consumer they exist.
 */
export function bestSetsFromStats(
  bestByReps: Record<string, BestSet> | undefined,
  numeric: NumericFieldMap | null
): BestSet[] {
  if (!numeric || !bestByReps) return [];
  return Object.values(bestByReps)
    .filter((entry) => entry.unit === numeric.weight.unit)
    .sort((a, b) => a.reps - b.reps);
}

/** Volume per session, oldest to newest, windowed to the most recent `limit`. */
export function volumeTrendFromStats(
  points: VolumePoint[] | undefined,
  limit: number = HISTORY_TREND_SESSION_COUNT
): VolumePoint[] {
  return [...(points ?? [])]
    .sort((a, b) => b.performedAt - a.performedAt)
    .slice(0, limit)
    .reverse();
}

/**
 * Everything `useExerciseHistory` returns.
 *
 * A missing entry, a `null` stats doc and an exercise with no sets are all
 * ordinary results, not errors.
 */
export function deriveExerciseHistory(
  entry: ExerciseHistoryEntry | undefined,
  overrideFields?: ExerciseField[]
): ExerciseHistory {
  const stats = entry?.stats ?? null;

  // The caller's definition wins when given: a plan screen knows the exercise's
  // current fields even if the last session was logged with older ones.
  const fields = overrideFields ?? stats?.fields ?? NO_FIELDS;
  const numericFields = resolveNumericFields(fields);
  const numericAvailable = numericFields !== null;

  const rawSessions = stats?.recentSessions ?? NO_SESSIONS;
  const allSessions = rawSessions
    .map((session) => buildHistorySession(session, numericFields, fields))
    .sort((a, b) => b.performedAt - a.performedAt);

  const lastSession = allSessions[0] ?? null;
  const best = bestSetsFromStats(stats?.bestByReps, numericFields);

  return {
    status: entry?.status ?? "idle",
    loading: entry?.status === "loading",
    hasHistory: allSessions.length > 0,
    fields,
    numericFields,
    numericComparisonAvailable: numericAvailable,
    unitMismatch: allSessions.some((session) => !session.comparable),
    lastSession,
    setAt: (setNumber: number) =>
      lastSession?.sets.find((set) => set.setNumber === setNumber) ?? null,
    sessions: allSessions.slice(0, HISTORY_RECENT_SESSION_COUNT),
    best,
    bestAtReps: (reps: number) => best.find((set) => set.reps === reps) ?? null,
    volumeTrend: volumeTrendFromStats(stats?.volumeHistory),
    error: entry?.error ?? null,
  };
}
