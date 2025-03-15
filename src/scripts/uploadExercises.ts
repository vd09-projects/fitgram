// src/scripts/uploadExercises.ts
import { addPredefinedExercise } from "../services/db/exercises";
import { db } from "../services/firebase/firebase";
import { collection, doc, setDoc } from "firebase/firestore";
import { Exercise } from "../types/workoutType";

// Extended predefined exercises data
const predefinedExercises: Exercise[] = [
  {
    name: "Bicep Curls",
    id: "bicep_curls",
    fields: ["Sets", "Weight (kg)", "Reps"],
  },
  {
    name: "Leg Extensions",
    id: "leg_extensions",
    fields: ["Sets", "Weight (kg)", "Reps"],
  },
  { name: "Rowing", id: "rowing", fields: ["Sets", "Weight (kg)", "Reps"] },
  {
    name: "Treadmill",
    id: "treadmill",
    fields: ["Total Time (min)", "Incline Level", "Speed (km/h)"],
  },
  {
    name: "Bench Press",
    id: "bench_press",
    fields: ["Sets", "Weight (kg)", "Reps"],
  },
  {
    name: "Deadlifts",
    id: "deadlifts",
    fields: ["Sets", "Weight (kg)", "Reps"],
  },
  { name: "Squats", id: "squats", fields: ["Sets", "Weight (kg)", "Reps"] },
  { name: "Pull-Ups", id: "pull_ups", fields: ["Sets", "Reps"] },
  {
    name: "Cycling",
    id: "cycling",
    fields: ["Total Time (min)", "Resistance Level", "Speed (km/h)"],
  },
  {
    name: "Jump Rope",
    id: "jump_rope",
    fields: ["Total Time (min)", "Jumps"],
  },
  { name: "Plank", id: "plank", fields: ["Total Time (min)"] },
  { name: "Lunges", id: "lunges", fields: ["Sets", "Weight (kg)", "Reps"] },
  {
    name: "Lat Pulldown",
    id: "lat_pulldown",
    fields: ["Sets", "Weight (kg)", "Reps"],
  },
  {
    name: "Overhead Press",
    id: "overhead_press",
    fields: ["Sets", "Weight (kg)", "Reps"],
  },
  {
    name: "Battle Ropes",
    id: "battle_ropes",
    fields: ["Total Time (min)"],
  },
  {
    name: "Hammer Curls",
    id: "hammer_curls",
    fields: ["Sets", "Weight (kg)", "Reps"],
  },
  { name: "Triceps Dips", id: "triceps_dips", fields: ["Sets", "Reps"] },
  {
    name: "Russian Twists",
    id: "russian_twists",
    fields: ["Sets", "Reps"],
  },
  { name: "Sit-Ups", id: "sit_ups", fields: ["Sets", "Reps"] },
  { name: "Leg Raises", id: "leg_raises", fields: ["Sets", "Reps"] },
  { name: "Side Plank", id: "side_plank", fields: ["Total Time (min)"] },
  { name: "Burpees", id: "burpees", fields: ["Sets", "Reps"] },
  {
    name: "Mountain Climbers",
    id: "mountain_climbers",
    fields: ["Sets", "Reps"],
  },
  { name: "Jump Squats", id: "jump_squats", fields: ["Sets", "Reps"] },
  {
    name: "Kettlebell Swings",
    id: "kettlebell_swings",
    fields: ["Sets", "Weight (kg)", "Reps"],
  },
  {
    name: "Farmer’s Walk",
    id: "farmers_walk",
    fields: ["Total Distance (m)", "Weight (kg)"],
  },
  {
    name: "Sled Push",
    id: "sled_push",
    fields: ["Total Distance (m)", "Weight (kg)"],
  },
  {
    name: "Box Jumps",
    id: "box_jumps",
    fields: ["Sets", "Reps", "Box Height (cm)"],
  },
  {
    name: "Hip Thrusts",
    id: "hip_thrusts",
    fields: ["Sets", "Weight (kg)", "Reps"],
  },
  {
    name: "Seated Calf Raises",
    id: "seated_calf_raises",
    fields: ["Sets", "Weight (kg)", "Reps"],
  },
  {
    name: "Standing Calf Raises",
    id: "standing_calf_raises",
    fields: ["Sets", "Reps"],
  },
  {
    name: "Chest Flys",
    id: "chest_flys",
    fields: ["Sets", "Weight (kg)", "Reps"],
  },
  {
    name: "Bent-Over Rows",
    id: "bent_over_rows",
    fields: ["Sets", "Weight (kg)", "Reps"],
  },
  {
    name: "Reverse Lunges",
    id: "reverse_lunges",
    fields: ["Sets", "Weight (kg)", "Reps"],
  },
  {
    name: "Face Pulls",
    id: "face_pulls",
    fields: ["Sets", "Weight (kg)", "Reps"],
  },
  {
    name: "Arnold Press",
    id: "arnold_press",
    fields: ["Sets", "Weight (kg)", "Reps"],
  },
  {
    name: "Sumo Deadlifts",
    id: "sumo_deadlifts",
    fields: ["Sets", "Weight (kg)", "Reps"],
  },
  {
    name: "Trap Bar Deadlifts",
    id: "trap_bar_deadlifts",
    fields: ["Sets", "Weight (kg)", "Reps"],
  },
  {
    name: "Landmine Press",
    id: "landmine_press",
    fields: ["Sets", "Weight (kg)", "Reps"],
  },
  {
    name: "Step-Ups",
    id: "step_ups",
    fields: ["Sets", "Weight (kg)", "Reps", "Step Height (cm)"],
  },
  {
    name: "Hanging Leg Raises",
    id: "hanging_leg_raises",
    fields: ["Sets", "Reps"],
  },
  {
    name: "Cable Lateral Raises",
    id: "cable_lateral_raises",
    fields: ["Sets", "Weight (kg)", "Reps"],
  },
];

// Function to upload exercises to Firestore
const uploadExercises = async () => {
  try {
    const exercisesCollection = collection(db, "exercises");

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
