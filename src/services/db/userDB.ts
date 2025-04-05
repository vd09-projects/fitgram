import { tables } from "../../constants/tables";
import { ExerciseLog, WorkoutLog } from "../../types/workoutLogs";
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
  orderBy,
  query,
  setDoc,
  updateDoc,
  limit as limitFn,
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


export const getLatestWorkoutLogExercises = async (
  userId: string,
  workoutId: string,
  n: number
): Promise<WorkoutLog[] | null> => {
  const logsPath = `users/${userId}/workout_logs/${workoutId}/logs`;
  const logsRef = collection(db, logsPath);
  const logsQuery = query(logsRef, orderBy("timestamp", "desc"), limitFn(n));

  try {
    const logSnapshots = await getDocs(logsQuery);
    const workoutLogs: WorkoutLog[] = [];

    for (const logDoc of logSnapshots.docs) {
      const logId = logDoc.id;
      const logData = logDoc.data();

      const exercisesRef = collection(db, `${logsPath}/${logId}/exercises`);
      const exercisesSnap = await getDocs(exercisesRef);

      const exercises: ExerciseLog[] = exercisesSnap.docs.map(doc => ({
        exerciseId: doc.id,
        exerciseName: doc.data().exerciseName,
        timestamp: doc.data().timestamp,
        sets: doc.data().sets,
      }));

      workoutLogs.push({
        id: logId,
        workoutId,
        userId,
        exercises,
      });
    }

    return workoutLogs;
  } catch (error) {
    console.error("❌ Error fetching latest workout log exercises:", error);
    return null;
  }
};

export const getWorkoutLogExercisesByLogId = async (
  userId: string,
  workoutId: string,
  logId: string
): Promise<ExerciseLog[] | null> => {
  const exercisesRef = collection(
    db,
    `users/${userId}/workout_logs/${workoutId}/logs/${logId}/exercises`
  );

  try {
    const exercisesSnap = await getDocs(exercisesRef);

    const exercises: ExerciseLog[] = exercisesSnap.docs.map(doc => {
      const data = doc.data();
      return {
        exerciseId: doc.id,
        exerciseName: data.exerciseName,
        timestamp: data.timestamp,
        sets: data.sets,
      };
    });

    return exercises;
  } catch (error) {
    console.error("❌ Error fetching workout log exercises by logId:", error);
    return null;
  }
};