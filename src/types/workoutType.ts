// src/types/workoutType.ts

export interface Exercise {
  id?: string;
  label: string;
  value: string;
  fields: string[];
}

export type WorkoutPlan = {
  id?: string;
  name: string;
  exercises: Exercise[];
};
