import { DropdownSelection } from "../components/SearchableInputDropdown";
import { Exercise, ExerciseField, WorkoutPlan } from "../types/workoutType";
import {
  isValidId,
  findDuplicate,
  getInvalidFieldCharacter,
  getInvalidExerciseNameCharacter,
} from "./validation";

export const validateWorkoutSelection = (
  workout: DropdownSelection<WorkoutPlan> | undefined
): string | null => {
  if (!workout || !workout.value) return "Please select a workout.";
  if (!workout.label.trim()) return "Workout name cannot be empty.";
  return null;
};

export const validateExerciseSelection = (
  exercise: DropdownSelection<Exercise>,
  existingExerciseIds: Set<string>
): string | null => {
  const ex = exercise?.value;
  if (!ex) return "Please select or enter an exercise.";

  if (!exercise.label.trim()) return "Exercise name cannot be empty.";

  const invalidChar = getInvalidExerciseNameCharacter(exercise.label);
  if (invalidChar)
    return `Exercise Name contains an invalid character: "${invalidChar}". Only letters and spaces are allowed.`;

  if (!ex.id.trim()) return "Exercise ID cannot be empty.";
  if (!isValidId(ex.id))
    return "Exercise ID can only contain letters, numbers, and underscores.";

  if (existingExerciseIds.has(ex.id))
    return `Exercise "${exercise.label}" already exists in this workout.`;

  // Fields are deliberately NOT checked here. For a custom exercise the
  // selection carries `fields: []` (AddExerciseScreen builds it that way) while
  // the fields the user actually typed live in the screen's `customFields`
  // state, which is validated separately. Checking `ex.fields` here rejected
  // every new custom exercise with "At least one field is required".
  return null;
};

export const validateCustomFields = (
  fields: ExerciseField[]
): string | null => {
  if (fields.length === 0) return "At least one field is required.";

  const trimmed = fields.map((f) => f.name.trim());
  if (trimmed.some((f) => f === "")) return "Fields cannot be empty.";

  for (const field of trimmed) {
    const invalidChar = getInvalidFieldCharacter(field);
    if (invalidChar)
      return `Field contains an invalid character: "${invalidChar}"`;
  }

  const duplicate = findDuplicate(trimmed);
  if (duplicate) return `Field "${duplicate}" is duplicated.`;

  // weight and reps drive every numeric comparison, so each must be unambiguous.
  for (const role of ["weight", "reps"] as const) {
    const count = fields.filter((f) => f.role === role).length;
    if (count > 1) return `Only one field can be the ${role} field.`;
  }

  return null;
};

export const validateWorkoutAndExercises = (
  workout: WorkoutPlan
): string | null => {
  if (!workout?.name.trim()) return "Workout name cannot be empty.";

  const exerciseIds = new Set<string>();

  for (let i = 0; i < workout.exercises.length; i++) {
    const ex = workout.exercises[i];
    const index = i + 1;

    if (!ex.id.trim() || !isValidId(ex.id))
      return `Exercise ${index} has an invalid ID. Only letters, numbers, and underscores are allowed.`;

    const invalidChar = getInvalidExerciseNameCharacter(ex.name);
    if (invalidChar)
      return `Exercise Name contains an invalid character: "${invalidChar}". Only letters and spaces are allowed.`;

    if (exerciseIds.has(ex.id)) return `Exercise "${ex.name}" is duplicated.`;

    exerciseIds.add(ex.id);

    const fieldError = validateCustomFields(ex.fields);
    if (fieldError) return `In exercise "${ex.name}": ${fieldError}`;
  }

  return null;
};
