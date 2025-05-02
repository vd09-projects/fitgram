import { DropdownSelection } from "../components/SearchableInputDropdown";
import { Exercise, WorkoutPlan } from "../types/workoutType";

/**
 * Validates if a workout is selected and has a proper name.
 */
export const validateWorkoutSelection = (
  workout: DropdownSelection<WorkoutPlan> | undefined
): string | null => {
  if (!workout || !workout.value) return "Please select a workout.";
  if (!workout.label.trim()) return "Workout name cannot be empty.";
  return null;
};

/**
 * Validates the selected exercise:
 * - Is present
 * - Has a valid name
 * - Is not already in the workout
 */
export const validateExerciseSelection = (
  exercise: DropdownSelection<Exercise>,
  existingExerciseIds: Set<string>
): string | null => {
  if (!exercise.value) return "Please select or enter an exercise.";
  if (!exercise.label.trim()) return "Exercise name cannot be empty.";
  if (existingExerciseIds.has(exercise.value.id)) {
    return `Exercise "${exercise.label}" already exists in this workout.`;
  }
  return null;
};

/**
 * Validates the custom fields list:
 * - At least one field
 * - No empty field
 * - No duplicate fields
 */
export const validateCustomFields = (fields: string[]): string | null => {
  if (fields.length === 0) return "At least one field is required.";

  const trimmed = fields.map(f => f.trim());
  if (trimmed.some(f => f === "")) return "Fields cannot be empty.";

  const duplicate = findDuplicate(trimmed);
  if (duplicate) return `Field "${duplicate}" is duplicated.`;

  return null;
};

/**
 * Helper to find duplicates in a string array (case-insensitive).
 */
export const findDuplicate = (arr: string[]): string | undefined => {
  const seen = new Set<string>();
  for (const item of arr) {
    const lower = item.toLowerCase();
    if (seen.has(lower)) return item;
    seen.add(lower);
  }
  return undefined;
};