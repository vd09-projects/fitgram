export const SetsString = "Sets";
export type SetLog = {
  id: number;
  fields: {
    [key: string]: string; // e.g., "Reps", "Sets", "Weight (kg)"
  };
};

export type ExerciseLog = {
  exerciseId: string; // Unique Exercise ID
  exerciseName: string; // Exercise Name
  timestamp: number; // Timestamp when the exercise was logged
  sets: SetLog[]; // Array of sets with dynamic key-value attributes
};

export type WorkoutLog = {
  id: string; // Unique Log ID (e.g., `log_${workout.id}_${Date.now()}`)
  workoutId: string; // ID of the workout being logged
  userId: string; // User performing the workout
  exercises: ExerciseLog[]; // List of exercises within this workout session
};

