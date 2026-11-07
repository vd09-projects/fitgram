// Workout plans only. Workout *history* moved to
// `src/services/db/workoutSessions.ts`, which stores it exercise-first; the old
// workout_logs tree could only answer "what did I do last time in THIS workout".
import { tables } from "../../constants/tables";
import { Exercise, PlanStamp, WorkoutPlan, isArchived } from "../../types/workoutType";
import { normalizeExerciseFields } from "../../utils/exerciseFields";
import { toPlanStamp } from "../../utils/planSync";
import { toPlanVersion } from "../../utils/planVersion";
import { db } from "../firebase/firebase";
import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type SnapshotMetadata,
} from "firebase/firestore";

/**
 * A server read is the server's answer only if none of this phone's own
 * queued writes is laid over it. The SDK lays a write still queued on top of
 * what even `getDocFromServer` / `getDocsFromServer` return (latency
 * compensation), and only `hasPendingWrites` says so. Found on the device
 * (TICKET-073, 2026-11-07): two Saves queued offline; after the first was
 * refused, the reload read the second, unsent, as the server's copy, held it
 * and showed it. Reproduced in src/firestoreRules/firestoreRules.test.ts.
 *
 * Such a read is rejected, like an offline one (TICKET-070 D11): the caller
 * keeps what it has, and the queued write brings the plan itself when it
 * lands (`applySaved`) or is refused (`reloadRefused`). Rejected: waiting for
 * the queued writes to settle before reading, which adds a timed wait for the
 * same end state.
 */
function serverOnly<T extends { metadata: SnapshotMetadata }>(snapshot: T): T {
  if (snapshot.metadata.hasPendingWrites) throw new Error("A Save of this plan is still queued on this phone");
  return snapshot;
}

const plansCollection = (userId: string) =>
  collection(db, tables.users.collection, userId, tables.users.fields.workouts.collection);

/**
 * A plan doc as the phone holds it. `updatedAt` becomes plain numbers
 * (`toPlanStamp`) or is left out: the plans store keeps it in JSON, and a
 * Timestamp instance would not survive that at full precision. `version` is
 * kept only whole (`toPlanVersion`, TICKET-073); anything else is left out,
 * and the plan counts as having none.
 */
const planFromDoc = (snapshot: QueryDocumentSnapshot<DocumentData>): WorkoutPlan => {
  const { updatedAt, version: storedVersion, ...data } = snapshot.data();
  const stamp = toPlanStamp(updatedAt);
  const version = toPlanVersion(storedVersion);
  // Only a hand edit could write it; firestore.rules then refuses every save of this plan.
  if (storedVersion !== undefined && version === undefined)
    console.warn(`Plan ${snapshot.id} has an unusable version (${JSON.stringify(storedVersion)}); fix it in the console.`);
  const plan = {
    id: snapshot.id,
    ...data,
    ...(stamp ? { updatedAt: stamp } : {}),
    ...(version ? { version } : {}),
  } as WorkoutPlan;
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
    const querySnapshot = serverOnly(await getDocsFromServer(plansCollection(userId)));
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
  const snapshot = serverOnly(
    await getDocsFromServer(
      query(plansCollection(userId), where("updatedAt", ">", new Timestamp(after.seconds, after.nanoseconds)))
    )
  );
  return snapshot.docs.map(planFromDoc);
};

/**
 * One plan from the server, for a refused save's reload when the change
 * check did not bring it back (TICKET-073 D7). Null: no such doc. Rejects
 * offline, like the reads above.
 */
export const getPlanFromServer = async (userId: string, planId: string): Promise<WorkoutPlan | null> => {
  if (!userId) throw new Error("Missing user");
  const snapshot = serverOnly(
    await getDocFromServer(doc(db, tables.users.collection, userId, tables.users.fields.workouts.collection, planId))
  );
  return snapshot.exists() ? planFromDoc(snapshot) : null;
};

/**
 * A fresh plan id (TICKET-052 D1): Firestore's auto id, made on the device with
 * no read or write, so it works offline. Nothing is stored until Save changes.
 */
export const newPlanId = (userId: string): string =>
  doc(collection(db, tables.users.collection, userId, tables.users.fields.workouts.collection)).id;

/**
 * A fresh version id for one Save (TICKET-073, `planVersion.ts`): Firestore's
 * auto id, made on the device with no read or write, so it works offline,
 * like `newPlanId`. 20 random characters: two Saves never share one.
 */
export const newVersionId = (): string => doc(collection(db, "_")).id;

export const overrideWorkoutDetails = async (
  userId: string,
  workout: WorkoutPlan
): Promise<void> => {
  // Throws rather than logging and returning (TICKET-051 D4): the caller shows
  // "saved" only when this resolves, so a skipped or failed write must reject.
  // Offline, `setDoc` neither resolves nor rejects (memory cache); the caller
  // bounds the wait. A save the rules refuse (TICKET-073: another device saved
  // since) rejects with `permission-denied`, online or when it lands from the
  // queue (`isRefusedSave`).
  if (
    !userId ||
    !workout.id ||
    !workout.exercises ||
    workout.exercises.length === 0
  ) {
    throw new Error("Missing user, plan id or exercises");
  }
  // TICKET-073: the plan as it will be stored carries its new version
  // (`planFromDraft`). Checked here, not trusted: without it firestore.rules
  // refuses the write, and that refusal would read as "this plan changed on
  // another device".
  const version = toPlanVersion(workout.version);
  if (!version) throw new Error(`Plan ${workout.id} has no version to save (${JSON.stringify(workout.version)})`);

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
      // Rebuilt key by key, so nothing else rides along; firestore.rules
      // refuses it unless `version.base` is the stored version.
      version: { rev: version.rev, id: version.id, base: version.base },
      // TICKET-070 D3: the server's stamp, always. The fields above are picked
      // one by one, so an `updatedAt` the plan was read with (the plans store
      // holds one) can never be written back: it would hide this Save from
      // every other phone's change check.
      updatedAt: serverTimestamp(),
    },
    { merge: false }
  ); // `merge: false` ensures complete overwrite
};
