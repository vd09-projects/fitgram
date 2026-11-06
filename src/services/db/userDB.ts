// Workout plans only. Workout *history* moved to
// `src/services/db/workoutSessions.ts`, which stores it exercise-first; the old
// workout_logs tree could only answer "what did I do last time in THIS workout".
import { tables } from "../../constants/tables";
import { Exercise, PlanStamp, WorkoutPlan, WorkoutPlanDB, isArchived } from "../../types/workoutType";
import { normalizeExerciseFields } from "../../utils/exerciseFields";
import { toPlanStamp } from "../../utils/planSync";
import { db } from "../firebase/firebase";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocsFromServer,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

const plansCollection = (userId: string) =>
  collection(db, tables.users.collection, userId, tables.users.fields.workouts.collection);

/**
 * A plan doc as the phone holds it. `updatedAt` becomes plain numbers
 * (`toPlanStamp`) or is left out: the plans store keeps it in JSON, and a
 * Timestamp instance would not survive that at full precision.
 */
const planFromDoc = (snapshot: QueryDocumentSnapshot<DocumentData>): WorkoutPlan => {
  const { updatedAt, ...data } = snapshot.data();
  const stamp = toPlanStamp(updatedAt);
  const plan = { id: snapshot.id, ...data, ...(stamp ? { updatedAt: stamp } : {}) } as WorkoutPlan;
  return {
    ...plan,
    exercises: (plan.exercises ?? []).map(
      (exercise): Exercise => ({
        ...exercise,
        fields: normalizeExerciseFields(exercise.fields),
      })
    ),
  };
};

/**
 * Every plan doc, `deleted` markers included: the plans store's merge drops
 * those (TICKET-070 D5) and still reads their stamps.
 */
export const getAllWorkoutPlans = async (
  userId: string
): Promise<WorkoutPlan[]> => {
  if (!userId) return [];

  try {
    // From the server, never Firestore's cache (TICKET-070 D11): offline this
    // rejects, so a failed check is never read as "nothing changed". `getDocs`
    // resolved offline with the memory cache, empty on a cold start, which
    // needed a guard to fail (TICKET-052 D5); the phone's copy of the plans is
    // the plans store now, not that cache.
    const querySnapshot = await getDocsFromServer(plansCollection(userId));
    const plans = querySnapshot.docs.map(planFromDoc);

    console.log("✅ Exercises fetched successfully:", plans);
    return plans;
  } catch (error) {
    // Rethrown, not `[]` (TICKET-052 D5): an empty list reads as "no plans
    // yet", which would offer a first plan to someone who has plans but could
    // not load them. The one caller, `usePlansStore`, keeps the stored copy.
    console.error("❌ Error fetching exercises:", error);
    throw error;
  }
};

/**
 * The plans written after `after` (TICKET-070 D3): `updatedAt > after`, from
 * the server. Nothing changed: no docs, billed 1 read. `>`, not `>=`, or the
 * newest plan would come back on every check. The Timestamp is rebuilt from
 * seconds and nanoseconds, never from milliseconds, for the same reason. A
 * range on one field needs no index of ours. Plans with no `updatedAt` never
 * match. Rejects offline or on any failure (D11), like `getAllWorkoutPlans`.
 */
export const getChangedPlans = async (userId: string, after: PlanStamp): Promise<WorkoutPlan[]> => {
  if (!userId) throw new Error("Missing user");
  const snapshot = await getDocsFromServer(
    query(plansCollection(userId), where("updatedAt", ">", new Timestamp(after.seconds, after.nanoseconds)))
  );
  return snapshot.docs.map(planFromDoc);
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
      // TICKET-061: a complete overwrite, so the archive state must be written
      // too or Save would unarchive the plan. `planFromDraft` carries it.
      ...(isArchived(workout) ? { archived: true } : {}),
      // TICKET-070 D3: the server's stamp, always. The fields above are picked
      // one by one, so an `updatedAt` the plan was read with (the plans store
      // holds one) can never be written back: it would hide this Save from
      // every other phone's change check.
      updatedAt: serverTimestamp(),
    },
    { merge: false }
  ); // `merge: false` ensures complete overwrite
};
