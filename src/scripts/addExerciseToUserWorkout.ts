import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const exercises = [
  { id: "Hip_Thrust_(Barbell)", name: "Hip Thrust (Barbell)", fields: ["SET", "KG", "REPS"] },
  { id: "Leg_Extension_(Machine)", name: "Leg Extension (Machine)", fields: ["SET", "KG", "REPS"] },
  { id: "Good_Morning_(Barbell)", name: "Good Morning (Barbell)", fields: ["SET", "KG", "REPS"] },
  { id: "Standing_Calf_Raise", name: "Standing Calf Raise", fields: ["SET", "KG", "REPS"] },
];

async function run() {
  const userId = "user_123"; // 🔁 Change this as needed
  const workoutRef = doc(db, "users", userId, "workouts", "wp_4");

  await setDoc(workoutRef, {
    id: "wp_4",
    name: "Workout Plan 4",
    exercises,
  });

  console.log("✅ Workout wp_4 added successfully");
}

run().catch(console.error);