// Workout plans only. Workout *history* moved to
// `src/services/db/workoutSessions.ts`, which stores it exercise-first; the old
// workout_logs tree could only answer "what did I do last time in THIS workout".
import { tables } from "../../constants/tables";
import { Exercise, WorkoutPlan, WorkoutPlanDB } from "../../types/workoutType";
import { normalizeExerciseFields } from "../../utils/exerciseFields";
import { db } from "../firebase/firebase";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const normalizePlan = (plan: WorkoutPlan): WorkoutPlan => ({
  ...plan,
  exercises: (plan.exercises ?? []).map(
    (exercise): Exercise => ({
      ...exercise,
      fields: normalizeExerciseFields(exercise.fields),
    })
  ),
});

export const getAllWorkoutPlans = async (
  userId: string
): Promise<WorkoutPlan[]> => {
  if (!userId) return [];

  try {
    const querySnapshot = await getDocs(
      collection(
        db,
        tables.users.collection,
        userId,
        tables.users.fields.workouts.collection
      )
    );
    const plans = (
      querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WorkoutPlan[]
    ).map(normalizePlan);

    console.log("✅ Exercises fetched successfully:", plans);
    return plans;
  } catch (error) {
    // Rethrown, not `[]` (TICKET-052 D5): an empty list reads as "no plans
    // yet", which would offer a first plan to someone who has plans but could
    // not load them. The one caller, useWorkoutPlans, flags the failure.
    console.error("❌ Error fetching exercises:", error);
    throw error;
  }
};

export const saveWorkoutDetails = async (
  userId: string,
  workout: WorkoutPlanDB
): Promise<void> => {
  if (!userId || !workout.id || !workout.exercise) {
    console.error("❌ Missing required parameters");
    return;
  }

  try {
    const workoutRef = doc(
      db,
      tables.users.collection,
      userId,
      tables.users.fields.workouts.collection,
      workout.id
    );
    const workoutSnap = await getDoc(workoutRef);

    if (!workoutSnap.exists()) {
      // Workout does not exist, create it with the new exercise
      await setDoc(workoutRef, {
        id: workout.id,
        name: workout.name, // Default name, can be updated later
        exercises: [workout.exercise],
      });
      console.log("✅ Workout and exercise created successfully");
      return;
    }

    const workoutData = workoutSnap.data() as WorkoutPlan;
    const existingExercise = workoutData.exercises.find(
      (ex) => ex.id === workout.exercise.id
    );

    if (existingExercise) {
      // If exercise exists, update it (remove old and add new)
      await updateDoc(workoutRef, {
        exercises: arrayRemove(existingExercise),
      });
      await updateDoc(workoutRef, {
        exercises: arrayUnion(workout.exercise),
      });
      console.log("✅ Exercise updated successfully");
    } else {
      // If exercise does not exist, add it
      await updateDoc(workoutRef, {
        exercises: arrayUnion(workout.exercise),
      });
      console.log("✅ Exercise added successfully");
    }
  } catch (error) {
    console.error("❌ Error saving workout details:", error);
  }
};

/**
 * A fresh plan id (TICKET-052 D1): Firestore's auto id, made on the device with
 * no read or write, so it works offline. Nothing is stored until Save changes.
 */
export const newPlanId = (userId: string): string =>
  doc(collection(db, tables.users.collection, userId, tables.users.fields.workouts.collection)).id;

export const overrideWorkoutDetails = async (
  userId: string,
  workout: WorkoutPlan
): Promise<void> => {
  // Throws rather than logging and returning (TICKET-051 D4): the caller shows
  // "saved" only when this resolves, so a skipped or failed write must reject.
  // Offline, `setDoc` neither resolves nor rejects (memory cache); the caller
  // bounds the wait.
  if (
    !userId ||
    !workout.id ||
    !workout.exercises ||
    workout.exercises.length === 0
  ) {
    throw new Error("Missing user, plan id or exercises");
  }

  const workoutRef = doc(
    db,
    tables.users.collection,
    userId,
    tables.users.fields.workouts.collection,
    workout.id
  );

  // Overwrite the workout completely
  await setDoc(
    workoutRef,
    {
      id: workout.id,
      name: workout.name,
      exercises: workout.exercises,
    },
    { merge: false }
  ); // `merge: false` ensures complete overwrite
};
