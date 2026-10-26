// src/types/workoutType.ts

// Units, and all that is known about each, live in one table: constants/units.ts.
import type { FieldUnit } from "../constants/units";
export type { FieldUnit };

/**
 * What a logged field *means*, declared once when the exercise is defined.
 *
 * This replaces inferring semantics from user-authored field names. Names are
 * free text ("Weight (kg)", "KG", "Load"), so any inference is a guess that
 * degrades silently; the role is the typed answer. Everything numeric — volume,
 * best, deltas — reads the role, never the name.
 */
export type FieldRole = "weight" | "reps" | "time" | "distance" | "other";

export interface ExerciseField {
  /**
   * Display name, still free text and still what set `fields` is keyed by.
   *
   * RENAMING IS NOT COSMETIC. Every logged set stores its values under this
   * name, and history (`buildHistorySession`) looks past sessions up by the
   * exercise's *current* name. Rename "Weight (kg)" to "Weight" and every
   * earlier session's weight parses to null — while the session stays
   * `comparable` (same unit), so nothing flags it and the set card shows no
   * reason. TICKET-030 makes history resolve by role from each session's own
   * field snapshot; until it lands, do not rename a field that has history.
   */
  name: string;
  role: FieldRole;
  /** Omitted for `other`, and for roles where a unit is meaningless. */
  unit?: FieldUnit;
}

export interface Exercise {
  /**
   * Shared across every workout that contains this exercise — a catalog
   * version id (TICKET-042), or a slug of the name for a custom one. This
   * is what makes cross-workout history ("my last bench press, in any workout")
   * a real join.
   */
  id: string;
  /**
   * A custom exercise's own name. `""` for a catalog exercise, whose name is
   * built from `id` (TICKET-042). Never display it directly: go through
   * `exerciseDisplayName` / `useExerciseNames`.
   */
  name: string;
  /**
   * The name as it read when the exercise was added to the plan (TICKET-042),
   * e.g. "Bench Press · Dumbbell, incline". A FALLBACK, read only when `id` is
   * not in the catalog (`resolveExerciseName`): catalog names are built from
   * the id, never stored. Never run through the custom-name rule, so its "·"
   * never meets it. Optional: plans saved before 042 lack it, and custom
   * exercises never have it. Written by the picker (AddExerciseScreen) with
   * `name: ""`. Its presence is what marks a catalog exercise
   * (`isCustomExercise`). Read every name through `exerciseDisplayName`.
   */
  nameSnapshot?: string;
  fields: ExerciseField[];
}

export type WorkoutPlan = {
  id: string;
  name: string;
  exercises: Exercise[];
};

export type WorkoutPlanDB = {
  id?: string;
  name: string;
  exercise: Exercise;
};
