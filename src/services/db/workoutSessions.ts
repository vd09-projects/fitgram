// src/services/db/workoutSessions.ts
//
// Write and read path for exercise-first workout history.
//
//   users/{uid}/sessions/{sessionId}
//   users/{uid}/exercise_sessions/{sessionId}__{exerciseId}   <- canonical
//   users/{uid}/exercise_stats/{exerciseId}                   <- derived rollup
//
// Replaces `saveActiveWorkoutLog` and the workout_logs tree, which could only
// answer "what did I do last time in THIS workout" — the wrong question when the
// same exercise appears in several plans.

import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit as limitFn,
  orderBy,
  query,
  runTransaction,
  startAfter,
  where,
  writeBatch,
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { tables } from "../../constants/tables";
import { db } from "../firebase/firebase";
import {
  ExerciseSessionDoc,
  ExerciseStatsDoc,
  WorkoutSessionDoc,
} from "../../types/workoutSession";
import { ActiveWorkout } from "../../types/zustandWorkoutType";
import {
  applySessionToStats,
  buildExerciseSessionId,
  buildSessionDocs,
} from "../../utils/exerciseStats";

const USERS = tables.users.collection;
const SESSIONS = tables.users.fields.sessions.collection;
const EXERCISE_SESSIONS = tables.users.fields.exercise_sessions.collection;
const EXERCISE_STATS = tables.users.fields.exercise_stats.collection;

/** Firestore `in` accepts at most 30 values. */
const IN_QUERY_CHUNK = 30;

const sessionsRef = (userId: string) => collection(db, USERS, userId, SESSIONS);
const exerciseSessionsRef = (userId: string) =>
  collection(db, USERS, userId, EXERCISE_SESSIONS);
const exerciseStatsRef = (userId: string) =>
  collection(db, USERS, userId, EXERCISE_STATS);

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Persist a finished workout.
 *
 * Two phases, on purpose:
 *
 *  1. A `writeBatch` for the session and its exercise_sessions docs. Batched
 *     writes queue in Firestore's offline cache and sync later, so finishing a
 *     workout without a connection still saves.
 *  2. A transaction that folds those sessions into the exercise_stats rollup.
 *     Transactions need a server round trip, so this is the part that can fail
 *     offline — and it is allowed to. The rollup is derived; `rollupPending`
 *     stays true on the session doc and `rebuildExerciseStats` can repair it.
 *     Logging data is never lost to a failed rollup.
 */
export const saveWorkoutSession = async (
  userId: string,
  workout: ActiveWorkout
): Promise<{ sessionId: string; rollupApplied: boolean }> => {
  if (!userId || !workout) throw new Error("Missing userId or workout.");

  const endedAt = Date.now();
  const { session, exerciseSessions } = buildSessionDocs(workout, endedAt);

  if (exerciseSessions.length === 0) {
    throw new Error("Nothing to save — no sets were logged.");
  }

  // Phase 1 — canonical data. Offline-safe.
  const batch = writeBatch(db);
  batch.set(doc(sessionsRef(userId), session.sessionId), session);
  for (const exerciseSession of exerciseSessions) {
    const id = buildExerciseSessionId(
      exerciseSession.sessionId,
      exerciseSession.exerciseId
    );
    batch.set(doc(exerciseSessionsRef(userId), id), exerciseSession);
  }
  await batch.commit();

  // Phase 2 — derived rollup. Best effort.
  let rollupApplied = false;
  try {
    await runTransaction(db, async (tx) => {
      const refs = exerciseSessions.map((e) =>
        doc(exerciseStatsRef(userId), e.exerciseId)
      );
      // Firestore requires every read before any write.
      const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));

      exerciseSessions.forEach((exerciseSession, index) => {
        const existing = snapshots[index].exists()
          ? (snapshots[index].data() as ExerciseStatsDoc)
          : null;
        tx.set(refs[index], applySessionToStats(existing, exerciseSession));
      });

      tx.set(
        doc(sessionsRef(userId), session.sessionId),
        { ...session, rollupPending: false },
        { merge: true }
      );
    });
    rollupApplied = true;
  } catch (error) {
    console.warn(
      "⚠️ exercise_stats rollup deferred; session data is saved.",
      error
    );
  }

  return { sessionId: session.sessionId, rollupApplied };
};

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/**
 * The hot read path: every exercise's history for a whole plan.
 *
 * One query per 30 exercises, one document read per exercise. A plan of six
 * exercises costs six document reads in a single round trip, and each doc already
 * carries recent sessions, all-time bests and the volume trend — so nothing
 * downstream needs a second read.
 *
 * An exercise that has never been performed is returned as `null`, which is the
 * no-history path and not an error.
 */
export const getExerciseStats = async (
  userId: string,
  exerciseIds: string[]
): Promise<Record<string, ExerciseStatsDoc | null>> => {
  const result: Record<string, ExerciseStatsDoc | null> = {};
  const unique = [...new Set(exerciseIds.filter(Boolean))];
  if (!userId || unique.length === 0) return result;

  for (const id of unique) result[id] = null;

  const snapshots = await Promise.all(
    chunk(unique, IN_QUERY_CHUNK).map((ids) =>
      getDocs(query(exerciseStatsRef(userId), where(documentId(), "in", ids)))
    )
  );

  for (const snapshot of snapshots) {
    for (const docSnap of snapshot.docs) {
      result[docSnap.id] = docSnap.data() as ExerciseStatsDoc;
    }
  }

  return result;
};

/**
 * History deeper than the rollup keeps — the exercise history sheet. Cross
 * workout by construction: every session of this exercise, whichever plan it was
 * done in, newest first.
 *
 * Index required: `exercise_sessions` on (exerciseId ASC, performedAt DESC).
 */
export const getExerciseSessions = async (
  userId: string,
  exerciseId: string,
  pageSize = 20,
  startAfterDoc?: QueryDocumentSnapshot<DocumentData>
): Promise<{
  sessions: ExerciseSessionDoc[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
}> => {
  if (!userId || !exerciseId) return { sessions: [], lastDoc: null };

  let q = query(
    exerciseSessionsRef(userId),
    where("exerciseId", "==", exerciseId),
    orderBy("performedAt", "desc"),
    limitFn(pageSize)
  );
  if (startAfterDoc) q = query(q, startAfter(startAfterDoc));

  const snapshot = await getDocs(q);
  return {
    sessions: snapshot.docs.map((d) => d.data() as ExerciseSessionDoc),
    lastDoc: snapshot.docs[snapshot.docs.length - 1] ?? null,
  };
};

/**
 * Workout sessions, newest first. Without `workoutId` this is the session
 * browse; with one it answers "when was this plan last done".
 *
 * Index required when filtered: `sessions` on (workoutId ASC, startedAt DESC).
 */
export const getWorkoutSessions = async (
  userId: string,
  options: {
    workoutId?: string;
    pageSize?: number;
    startAfterDoc?: QueryDocumentSnapshot<DocumentData>;
  } = {}
): Promise<{
  sessions: WorkoutSessionDoc[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
}> => {
  const { workoutId, pageSize = 10, startAfterDoc } = options;
  if (!userId) return { sessions: [], lastDoc: null };

  let q = workoutId
    ? query(
        sessionsRef(userId),
        where("workoutId", "==", workoutId),
        orderBy("startedAt", "desc"),
        limitFn(pageSize)
      )
    : query(sessionsRef(userId), orderBy("startedAt", "desc"), limitFn(pageSize));
  if (startAfterDoc) q = query(q, startAfter(startAfterDoc));

  const snapshot = await getDocs(q);
  return {
    sessions: snapshot.docs.map((d) => d.data() as WorkoutSessionDoc),
    lastDoc: snapshot.docs[snapshot.docs.length - 1] ?? null,
  };
};

/** Every exercise performed in one session. */
export const getSessionExercises = async (
  userId: string,
  sessionId: string
): Promise<ExerciseSessionDoc[]> => {
  if (!userId || !sessionId) return [];
  const snapshot = await getDocs(
    query(exerciseSessionsRef(userId), where("sessionId", "==", sessionId))
  );
  return snapshot.docs.map((d) => d.data() as ExerciseSessionDoc);
};

/** One exercise's record within one session. */
export const getExerciseSession = async (
  userId: string,
  sessionId: string,
  exerciseId: string
): Promise<ExerciseSessionDoc | null> => {
  if (!userId || !sessionId || !exerciseId) return null;
  const snapshot = await getDoc(
    doc(exerciseSessionsRef(userId), buildExerciseSessionId(sessionId, exerciseId))
  );
  return snapshot.exists() ? (snapshot.data() as ExerciseSessionDoc) : null;
};
