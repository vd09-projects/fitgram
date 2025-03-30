import { tables } from "../../constants/tables";
import { WorkoutPlan, WorkoutPlanDB } from "../../types/workoutType";
import { ActiveWorkout } from "../../types/zustandWorkoutType";
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
    const plans = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as WorkoutPlan[];

    console.log("✅ Exercises fetched successfully:", plans);
    return plans;
  } catch (error) {
    console.error("❌ Error fetching exercises:", error);
    return [];
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

export const overrideWorkoutDetails = async (
  userId: string,
  workout: WorkoutPlan
): Promise<void> => {
  if (
    !userId ||
    !workout.id ||
    !workout.exercises ||
    workout.exercises.length === 0
  ) {
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

    console.log("✅ Workout overwritten successfully");
  } catch (error) {
    console.error("❌ Error saving workout details:", error);
  }
};

export const saveActiveWorkoutLog = async (userId: string, workout: ActiveWorkout) => {
  if (!userId || !workout || !workout.exercises.length) {
    console.error("❌ Missing required parameters.");
    return;
  }

  try {
    const logId = `log_${workout.id}_${Date.now()}`.replace(/\s+/g, "_"); // Replace spaces with underscores
    const workoutRef = `users/${userId}/workout_logs/${workout.id}/logs/${logId}/exercises`;

    // Store each exercise as a separate document
    for (const exercise of workout.exercises) {
      const exerciseRef = doc(db, workoutRef, exercise.id); // Use exercise name as the document ID

      const exerciseData = {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        timestamp: Date.now(),
        sets: exercise.sets,
      };

      await setDoc(exerciseRef, exerciseData);
    }

    console.log(`✅ Workout log ${logId} saved successfully.`);
  } catch (error) {
    console.error("❌ Error saving workout log:", error);
  }
};

export const getWorkoutLogExercises = async (userId: string, workoutId: string, logId: string) => {
  if (!userId || !workoutId || !logId) return [];

  try {
    const querySnapshot = await getDocs(
      collection(db, "users", userId, "workout_logs", workoutId, "logs", logId, "exercises")
    );

    return querySnapshot.docs.map((doc) => doc.data());
  } catch (error) {
    console.error("❌ Error fetching workout exercises:", error);
    return [];
  }
};