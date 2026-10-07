import { ExerciseField } from "./workoutType";

// Type for a single set in an exercise
export interface ExerciseSet {
  id: number;
  fields: Record<string, string | number>; // Dynamic fields (e.g., reps, weight, time)
}

// Type for logged exercises
export interface LoggedExercise {
  id: string;
  name: string;
  /** Carried from the plan's `Exercise.fields`, roles included. */
  fields: ExerciseField[];
  sets: ExerciseSet[];
}

// Type for active workout
export interface ActiveWorkout {
  id: string;
  name: string;
  startTime: number;
  lastUpdated: number;
  exercises: LoggedExercise[];
  isPersisted: boolean;
  currentExerciseIndex: number | null; // Track the current exercise index
}