// src/test/fixtures.ts
//
// Builders for test data. Each returns a complete, valid value with defaults,
// so a test spells out only what its scenario is about.

import { ActiveWorkout, LoggedExercise } from "../types/zustandWorkoutType";
import { ExerciseField } from "../types/workoutType";
import {
  Effort,
  ExerciseSessionDoc,
  ExerciseStatsDoc,
  StoredSetFields,
} from "../types/workoutSession";
import { rebuildStatsFromSessions } from "../utils/exerciseStats";
import type { Movement } from "../types/catalog";

/** A weight/reps exercise with no sets logged. Id is a slug of the name. */
export function buildExercise(name: string, overrides: Partial<LoggedExercise> = {}): LoggedExercise {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    fields: [
      { name: "Weight", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ],
    sets: [],
    ...overrides,
  };
}

/** An active workout over the named exercises, open on the first. */
export function buildWorkout(
  exerciseNames: string[],
  overrides: Partial<ActiveWorkout> = {}
): ActiveWorkout {
  return {
    id: "test-workout",
    name: "Test Workout",
    startTime: Date.now(),
    lastUpdated: Date.now(),
    exercises: exerciseNames.map((name) => buildExercise(name)),
    currentExerciseIndex: exerciseNames.length > 0 ? 0 : null,
    ...overrides,
  };
}

/** One past session for `buildStats`. Only `sets` is required. */
export type StatsSessionSpec = {
  /**
   * Positional: index 0 is set 1. Keyed by field name, as logged. Each is a
   * one-segment set; stored as `{ segments: [values], effort }` (TICKET-055).
   */
  sets: StoredSetFields[];
  /** Field definitions that session was logged with. Default: kg weight + reps. */
  fields?: ExerciseField[];
  /** Default: one day earlier per position, so the first spec is the newest. */
  performedAt?: number;
  workoutName?: string;
  /** Per-set effort marks, positional like `sets` (TICKET-034). Default: none marked. */
  setEffort?: (Effort | null)[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The cached `exercise_stats` doc for an exercise with the given past sessions,
 * newest first — `sessions[0]` is "last time". Seed it through `renderScreen`:
 *
 *   const stats = buildStats("Bench Press", [{ sets: [{ Weight: "60", Reps: "8" }] }]);
 *   renderScreen(Screen, { workout, history: { [stats.exerciseId]: stats } });
 *
 * Built by folding each session through `rebuildStatsFromSessions`, the same
 * code the repair script uses, so volume, best-by-reps and ordering are what the
 * write path would have stored rather than hand-written guesses. For "fetched,
 * never done" pass `null` in `history` instead; this needs at least one session.
 */
export function buildStats(name: string, sessions: StatsSessionSpec[]): ExerciseStatsDoc {
  const exerciseId = buildExercise(name).id;
  const now = Date.now();
  const docs: ExerciseSessionDoc[] = sessions.map((spec, index) => {
    const sessionId = `test-session-${index + 1}`;
    return {
      exerciseId,
      exerciseName: name,
      sessionId,
      workoutId: "test-workout",
      workoutName: spec.workoutName ?? "Test Workout",
      performedAt: spec.performedAt ?? now - (index + 1) * DAY_MS,
      fields: spec.fields ?? buildExercise(name).fields,
      sets: spec.sets.map((values, i) => ({ segments: [values], effort: spec.setEffort?.[i] ?? null })),
    };
  });

  const stats = rebuildStatsFromSessions(exerciseId, docs, now);
  if (!stats) {
    throw new Error("buildStats needs at least one session; seed `null` for never-done");
  }
  return stats;
}

/** A one-version movement that passes `loadCatalog`, for catalog cache tests. */
export const CATALOG_ROW: Movement = {
  id: "row",
  name: "Row",
  primaryMuscles: ["lats"],
  secondaryMuscles: [],
  category: "strength",
  mechanic: "compound",
  aliases: [],
  versions: [
    {
      id: "row__barbell",
      equipment: "barbell",
      unilateral: false,
      measure: "weight_reps",
      fields: [
        { name: "Weight", role: "weight", unit: "kg" },
        { name: "Reps", role: "reps" },
      ],
      aliases: [],
    },
  ],
};
