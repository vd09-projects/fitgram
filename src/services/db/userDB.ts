import { getAuth } from "firebase/auth";
import { tables } from "../../constants/tables";
import { ExerciseLog, SetLog, WorkoutLog } from "../../types/workoutLogs";
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
  QueryDocumentSnapshot,
  DocumentData,
  startAfter,
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

export const saveActiveWorkoutLog = async (
  userId: string,
  workout: ActiveWorkout
) => {
  if (!userId || !workout || !workout.exercises.length) {
    console.error("❌ Missing required parameters.");
    return;
  }

  try {
    const dateStartTime = workout.startTime;
    const dateNow = Date.now();
    const logId = `log_${workout.id}_${dateStartTime}`.replace(/\s+/g, "_");

    // Paths
    const workoutRefPath = `users/${userId}/workout_logs/${workout.id}`;
    const logRefPath = `${workoutRefPath}/logs/${logId}`;
    const exercisesRefPath = `${logRefPath}/exercises`;

    // 1️⃣ Save the workout document (if not exists)
    const workoutRef = doc(db, workoutRefPath);
    await setDoc(
      workoutRef,
      {
        workoutId: workout.id,
        createdAt: dateStartTime,
        updatedAt: dateNow,
      },
      { merge: true }
    ); // merge avoids overwriting existing data

    // 2️⃣ Save the log document
    const logRef = doc(db, logRefPath);
    await setDoc(logRef, {
      logId,
      timestamp: dateStartTime,
    });

    // 3️⃣ Save each exercise document
    for (const exercise of workout.exercises) {
      const exerciseRef = doc(db, exercisesRefPath, exercise.id);

      const exerciseData = {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        timestamp: dateStartTime,
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

      const exercises: ExerciseLog[] = exercisesSnap.docs.map((doc) => ({
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

    const exercises: ExerciseLog[] = exercisesSnap.docs.map((doc) => {
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

type GetWorkoutLogsOptions = {
  page?: number;
  limit?: number;
  exerciseId?: string;
  setId?: number;
};

export async function getWorkoutLogs(
  userId: string,
  workoutId: string,
  options: GetWorkoutLogsOptions = {}
): Promise<WorkoutLog[]> {
  const { page = 1, limit = 5, exerciseId, setId } = options;

  const logsPath = `users/${userId}/workout_logs/${workoutId}/logs`;
  const logsRef = collection(db, logsPath);

  const logsQuery = query(
    logsRef,
    orderBy("timestamp", "desc"),
    limitFn(page * limit)
  );

  try {
    const logSnapshots = await getDocs(logsQuery);
    const logDocs = logSnapshots.docs;

    const logPromises = logDocs.map((logDoc) =>
      fetchExerciseLogs(
        logDoc.id,
        logsPath,
        userId,
        workoutId,
        exerciseId,
        setId
      )
    );

    const logs = await Promise.all(logPromises);
    return logs.filter(Boolean) as WorkoutLog[];
  } catch (error) {
    console.error("❌ Error fetching workout logs:", error);
    return [];
  }
}

export async function getWorkoutLogsPaginated(
  userId: string,
  workoutId: string,
  options: GetWorkoutLogsOptions = {},
  lastVisibleDoc?: QueryDocumentSnapshot<DocumentData>
): Promise<{ logs: WorkoutLog[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
  const { limit = 10, exerciseId, setId } = options;

  const logsPath = `users/${userId}/workout_logs/${workoutId}/logs`;
  const logsRef = collection(db, logsPath);

  let logsQuery = query(logsRef, orderBy("timestamp", "desc"), limitFn(limit));

  if (lastVisibleDoc) {
    logsQuery = query(logsQuery, startAfter(lastVisibleDoc));
  }

  try {
    const logSnapshots = await getDocs(logsQuery);
    const logDocs = logSnapshots.docs;

    const logPromises = logDocs.map((logDoc) =>
      fetchExerciseLogs(logDoc.id, logsPath, userId, workoutId, exerciseId, setId)
    );

    const logs = await Promise.all(logPromises);
    return {
      logs: logs.filter(Boolean) as WorkoutLog[],
      lastDoc: logDocs[logDocs.length - 1] || null,
    };
  } catch (error) {
    console.error("❌ Error fetching workout logs:", error);
    return { logs: [], lastDoc: null };
  }
}

// 🔄 Helper: Fetch logs for a single logId
async function fetchExerciseLogs(
  logId: string,
  logsPath: string,
  userId: string,
  workoutId: string,
  exerciseId?: string,
  setId?: number
): Promise<WorkoutLog | null> {
  if (exerciseId) {
    const exerciseRef = doc(db, `${logsPath}/${logId}/exercises/${exerciseId}`);
    const exerciseSnap = await getDoc(exerciseRef);

    if (!exerciseSnap.exists()) return null;

    const data = exerciseSnap.data();
    const sets = filterSets(data.sets, setId);

    return {
      id: logId,
      workoutId,
      userId,
      exercises: [
        {
          exerciseId: data.exerciseId,
          exerciseName: data.exerciseName,
          timestamp: data.timestamp,
          sets,
        },
      ],
    };
  } else {
    const exercisesRef = collection(db, `${logsPath}/${logId}/exercises`);
    const exercisesSnap = await getDocs(exercisesRef);

    if (exercisesSnap.empty) return null;

    const exercises: ExerciseLog[] = exercisesSnap.docs.map((doc) => {
      const data = doc.data();
      const sets = filterSets(data.sets, setId);

      return {
        exerciseId: data.exerciseId,
        exerciseName: data.exerciseName,
        timestamp: data.timestamp,
        sets,
      };
    });

    return {
      id: logId,
      workoutId,
      userId,
      exercises,
    };
  }
}

// 🎯 Helper: Filter sets by setId if provided
function filterSets(sets: SetLog[] = [], setId?: number): SetLog[] {
  if (typeof setId === "number") {
    return sets.filter((set) => set.id === setId);
  }
  return sets;
}

export async function getWorkoutLogs1(
  userId: string,
  workoutId: string,
  options: GetWorkoutLogsOptions = {}
): Promise<WorkoutLog[]> {
  const { page = 1, limit = 5, exerciseId, setId } = options;

  const logsPath = `users/${userId}/workout_logs/${workoutId}/logs`;
  const logsRef = collection(db, logsPath);
  const logsQuery = query(
    logsRef,
    orderBy("timestamp", "desc"),
    // startAt(((page - 1) * limit)),
    limitFn(page * limit)
  );

  console.log("Fetching logs from path:");

  try {
    const logSnapshots = await getDocs(logsQuery);
    const allLogs = logSnapshots.docs;

    const result: WorkoutLog[] = [];

    for (const logDoc of allLogs) {
      const logId = logDoc.id;
      const exercisesRef = collection(db, `${logsPath}/${logId}/exercises`);
      const exercisesSnap = await getDocs(exercisesRef);

      const filteredExercises: ExerciseLog[] = [];

      for (const exerciseDoc of exercisesSnap.docs) {
        const data = exerciseDoc.data();

        // ✅ Filter by exercise if requested
        if (exerciseId && data.exerciseId !== exerciseId) continue;

        let sets: SetLog[] = data.sets || [];

        // ✅ Filter specific set if provided
        if (typeof setId === "number") {
          sets = sets.filter((s: SetLog) => s.id === setId);
        }

        filteredExercises.push({
          exerciseId: data.exerciseId,
          exerciseName: data.exerciseName,
          timestamp: data.timestamp,
          sets,
        });
      }

      result.push({
        id: logId,
        workoutId,
        userId,
        exercises: filteredExercises,
      });
    }

    return result;
  } catch (error) {
    console.error("❌ Error fetching paginated logs:", error);
    return [];
  }
}
