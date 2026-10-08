// src/types/workoutType.ts

/**
 * What a logged field *means*, declared once when the exercise is defined.
 *
 * This replaces inferring semantics from user-authored field names. Names are
 * free text ("Weight (kg)", "KG", "Load"), so any inference is a guess that
 * degrades silently; the role is the typed answer. Everything numeric — volume,
 * best, deltas — reads the role, never the name.
 */
export type FieldRole = "weight" | "reps" | "time" | "distance" | "other";

/**
 * Unit of a numeric field. Used for comparability, not conversion: two sessions
 * are comparable only when the unit matches exactly (see `areFieldsComparable`).
 */
export type FieldUnit = "kg" | "lb" | "s" | "min" | "m" | "km";

export interface ExerciseField {
  /** Display name, still free text and still what set `fields` is keyed by. */
  name: string;
  role: FieldRole;
  /** Omitted for `other`, and for roles where a unit is meaningless. */
  unit?: FieldUnit;
}

export interface Exercise {
  /**
   * Shared across every workout that contains this exercise — a
   * `predefined_exercises` doc id, or a slug of the name for a custom one. This
   * is what makes cross-workout history ("my last bench press, in any workout")
   * a real join.
   */
  id: string;
  name: string;
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
