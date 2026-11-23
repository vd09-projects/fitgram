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
import { comparisonSegment, decodeStoredSets } from "./storedSets";
import { HISTORY_RECENT_SESSION_COUNT, HISTORY_TREND_SESSION_COUNT } from "../config/display";
import { STATS_RECENT_SESSION_CAP } from "../config/storedData";

// HISTORY_RECENT_SESSION_COUNT, HISTORY_TREND_SESSION_COUNT: value and reason in src/config/display.ts.

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
  // Segments and marks are kept raw on an incomparable session: it shows its
  // values and how the sets felt, and contributes no numbers.
  const sets: HistorySet[] = decodeStoredSets(entry.sets).map((set, index) => {
    const { weight, reps } = parseSet(comparisonSegment(set), sessionNumeric);
    return {
      // Array position is the only source of set order.
      setNumber: index + 1,
      ...set,
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
    fields: entry.fields,
    volume: computeSessionVolume(sets, sessionNumeric),
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
  overrideFields?: ExerciseField[],
  /**
   * An edit draft's start (TICKET-102): only sessions that started before it count, so the edited workout and
   * every later one are left out of "last time", ghosts and deltas, and the bests are hidden (`asOf`).
   */
  before?: number
): ExerciseHistory {
  const stats = entry?.stats ?? null;

  // The caller's definition wins when given: a plan screen knows the exercise's
  // current fields even if the last session was logged with older ones.
  const fields = overrideFields ?? stats?.fields ?? NO_FIELDS;
  const numericFields = resolveNumericFields(fields);
  const numericAvailable = numericFields !== null;

  const heldSessions = stats?.recentSessions ?? NO_SESSIONS;
  const rawSessions = before === undefined ? heldSessions : heldSessions.filter((session) => session.performedAt < before);
  const allSessions = rawSessions
    .map((session) => buildHistorySession(session, numericFields, fields))
    .sort((a, b) => b.performedAt - a.performedAt);

  const lastSession = allSessions[0] ?? null;
  const best = before === undefined ? bestSetsFromStats(stats?.bestByReps, numericFields) : [];
  // The summary keeps the newest sessions only, so a full one with none before the cutoff may still have older
  // sessions on the server: say they are not here, not "first time" (CLAUDE.md 2.4).
  const asOf =
    before === undefined
      ? undefined
      : { earlierNotHeld: allSessions.length === 0 && heldSessions.length >= STATS_RECENT_SESSION_CAP, bestHidden: true as const };

  return {
    ...(asOf ? { asOf } : {}),
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
    // A trend to the edited workout's own volume would include it: none while editing.
    volumeTrend: before === undefined ? volumeTrendFromStats(stats?.volumeHistory) : [],
    error: entry?.error ?? null,
  };
}
