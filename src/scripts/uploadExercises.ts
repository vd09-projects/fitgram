// src/scripts/uploadExercises.ts
import { addPredefinedExercise } from "../services/db/exercises";
import { Exercise } from "../types/workoutType";

// Extended predefined exercises data.
//
// Every field carries a declared role, so the history layer never infers
// semantics from the name. "Sets" was removed from every exercise: it counted
// sets inside a per-set row, which cannot mean anything now that a set's
// number is its position in the array.
const predefinedExercises: Exercise[] = [
  {
    name: "Bicep Curls",
    id: "bicep_curls",
    fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ],
  },
  {
    name: "Leg Extensions",
    id: "leg_extensions",
    fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ],
  },
  { name: "Rowing", id: "rowing", fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ] },
  {
    name: "Treadmill",
    id: "treadmill",
    fields: [
      { name: "Total Time (min)", role: "time", unit: "min" },
      { name: "Incline Level", role: "other" },
      { name: "Speed (km/h)", role: "other" },
    ],
  },
  {
    name: "Bench Press",
    id: "bench_press",
    fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ],
  },
  {
    name: "Deadlifts",
    id: "deadlifts",
    fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ],
  },
  { name: "Squats", id: "squats", fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ] },
  { name: "Pull-Ups", id: "pull_ups", fields: [
      { name: "Reps", role: "reps" },
    ] },
  {
    name: "Cycling",
    id: "cycling",
    fields: [
      { name: "Total Time (min)", role: "time", unit: "min" },
      { name: "Resistance Level", role: "other" },
      { name: "Speed (km/h)", role: "other" },
    ],
  },
  {
    name: "Jump Rope",
    id: "jump_rope",
    fields: [
      { name: "Total Time (min)", role: "time", unit: "min" },
      { name: "Jumps", role: "reps" },
    ],
  },
  { name: "Plank", id: "plank", fields: [
      { name: "Total Time (min)", role: "time", unit: "min" },
    ] },
  { name: "Lunges", id: "lunges", fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ] },
  {
    name: "Lat Pulldown",
    id: "lat_pulldown",
    fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ],
  },
  {
    name: "Overhead Press",
    id: "overhead_press",
    fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ],
  },
  {
    name: "Battle Ropes",
    id: "battle_ropes",
    fields: [
      { name: "Total Time (min)", role: "time", unit: "min" },
    ],
  },
  {
    name: "Hammer Curls",
    id: "hammer_curls",
    fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ],
  },
  { name: "Triceps Dips", id: "triceps_dips", fields: [
      { name: "Reps", role: "reps" },
    ] },
  {
    name: "Russian Twists",
    id: "russian_twists",
    fields: [
      { name: "Reps", role: "reps" },
    ],
  },
  { name: "Sit-Ups", id: "sit_ups", fields: [
      { name: "Reps", role: "reps" },
    ] },
  { name: "Leg Raises", id: "leg_raises", fields: [
      { name: "Reps", role: "reps" },
    ] },
  { name: "Side Plank", id: "side_plank", fields: [
      { name: "Total Time (min)", role: "time", unit: "min" },
    ] },
  { name: "Burpees", id: "burpees", fields: [
      { name: "Reps", role: "reps" },
    ] },
  {
    name: "Mountain Climbers",
    id: "mountain_climbers",
    fields: [
      { name: "Reps", role: "reps" },
    ],
  },
  { name: "Jump Squats", id: "jump_squats", fields: [
      { name: "Reps", role: "reps" },
    ] },
  {
    name: "Kettlebell Swings",
    id: "kettlebell_swings",
    fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ],
  },
  {
    name: "Farmer’s Walk",
    id: "farmers_walk",
    fields: [
      { name: "Total Distance (m)", role: "distance", unit: "m" },
      { name: "Weight (kg)", role: "weight", unit: "kg" },
    ],
  },
  {
    name: "Sled Push",
    id: "sled_push",
    fields: [
      { name: "Total Distance (m)", role: "distance", unit: "m" },
      { name: "Weight (kg)", role: "weight", unit: "kg" },
    ],
  },
  {
    name: "Box Jumps",
    id: "box_jumps",
    fields: [
      { name: "Reps", role: "reps" },
      { name: "Box Height (cm)", role: "other" },
    ],
  },
  {
    name: "Hip Thrusts",
    id: "hip_thrusts",
    fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ],
  },
  {
    name: "Seated Calf Raises",
    id: "seated_calf_raises",
    fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ],
  },
  {
    name: "Standing Calf Raises",
    id: "standing_calf_raises",
    fields: [
      { name: "Reps", role: "reps" },
    ],
  },
  {
    name: "Chest Flys",
    id: "chest_flys",
    fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ],
  },
  {
    name: "Bent-Over Rows",
    id: "bent_over_rows",
    fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ],
  },
  {
    name: "Reverse Lunges",
    id: "reverse_lunges",
    fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ],
  },
  {
    name: "Face Pulls",
    id: "face_pulls",
    fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ],
  },
  {
    name: "Arnold Press",
    id: "arnold_press",
    fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ],
  },
  {
    name: "Sumo Deadlifts",
    id: "sumo_deadlifts",
    fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ],
  },
  {
    name: "Trap Bar Deadlifts",
    id: "trap_bar_deadlifts",
    fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ],
  },
  {
    name: "Landmine Press",
    id: "landmine_press",
    fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ],
  },
  {
    name: "Step-Ups",
    id: "step_ups",
    fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
      { name: "Step Height (cm)", role: "other" },
    ],
  },
  {
    name: "Hanging Leg Raises",
    id: "hanging_leg_raises",
    fields: [
      { name: "Reps", role: "reps" },
    ],
  },
  {
    name: "Cable Lateral Raises",
    id: "cable_lateral_raises",
    fields: [
      { name: "Weight (kg)", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
    ],
  },
];

// Function to upload exercises to Firestore
const uploadExercises = async () => {
  try {
    for (const exercise of predefinedExercises) {
      await addPredefinedExercise(exercise);
      console.log(`Uploaded: ${exercise.name}`);
    }

    console.log("✅ All exercises have been uploaded successfully!");
  } catch (error) {
    console.error("❌ Error uploading exercises:", error);
  }
};

// Run the upload function
uploadExercises();
