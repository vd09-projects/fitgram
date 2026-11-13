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
  getDocs,
  getDocsFromServer,
  limit as limitFn,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  Timestamp,
  where,
  writeBatch,
  DocumentData,
  QueryDocumentSnapshot,
  QuerySnapshot,
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
import { readLifts, withVerdicts } from "../../utils/liftRecord";
import { toStamp, type SyncStamp } from "../../utils/syncCore";

const USERS = tables.users.collection;
const SESSIONS = tables.users.fields.sessions.collection;
const EXERCISE_SESSIONS = tables.users.fields.exercise_sessions.collection;
const EXERCISE_STATS = tables.users.fields.exercise_stats.collection;

const sessionsRef = (userId: string) => collection(db, USERS, userId, SESSIONS);
const exerciseSessionsRef = (userId: string) =>
  collection(db, USERS, userId, EXERCISE_SESSIONS);
const exerciseStatsRef = (userId: string) =>
  collection(db, USERS, userId, EXERCISE_STATS);

/**
 * A `sessions` doc as the phone holds it (TICKET-075): `updatedAt` becomes
 * plain numbers (`toStamp`) or is left out, as plans do, so it survives the
 * stored copy's JSON at full precision. A session written before 075 has no
 * stamp; the workouts store's first load reads it by `startedAt` instead.
 */
const sessionFromDoc = (snapshot: QueryDocumentSnapshot<DocumentData>): WorkoutSessionDoc => {
  const { updatedAt, ...data } = snapshot.data();
  const stamp = toStamp(updatedAt);
  // `lifts` is read through `readLifts` here, the one boundary (firestore.rules has no field
  // whitelist). Missing or unreadable: `[]` and `liftsUnreadable`, so one such session (a
  // pre-081 doc) cannot make the held copy's validator refuse the whole copy on every launch.
  const lifts = readLifts(data.lifts);
  return {
    ...(data as WorkoutSessionDoc),
    lifts: lifts ?? [],
    ...(lifts ? {} : { liftsUnreadable: true as const }),
    ...(stamp ? { updatedAt: stamp } : {}),
  };
};

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Persist a finished workout.
 *
 * Two phases, on purpose:
 *
 *  1. A `writeBatch` for the session (its `lifts`, with their sets and
 *     `reason: "pending"`) and its exercise_sessions docs, which stay until
 *     TICKET-085 retires the old History page. The session is written with
 *     merge, so a replayed upload keeps a `note` the user added since and
 *     writes none itself. Offline it waits in Firestore's memory cache and
 *     completes on reconnect. That cache dies with the app: the upload queue is
 *     what makes an offline Finish safe.
 *  2. A transaction that folds those sessions into the exercise_stats rollup
 *     and, from the rollups it reads (no extra read), puts each lift's verdict
 *     on the session's `lifts`: one more write, 18 per Finish of 8 lifts.
 *     Transactions need a server round trip, so this can fail after phase 1
 *     landed. It then rejects, and the upload queue keeps the workout and runs
 *     both phases again at its next trigger (TICKET-077). Safe to repeat: same
 *     ids, and the fold replaces by `sessionId`. Logging data is never lost to a
 *     failed rollup.
 *
 * Rejected (TICKET-077): a repair that looks on the server for sessions with no
 * summary, which is a second path and 1 read per app run for a failure never
 * observed; a flag on the session doc marking one, which nothing read, as the
 * queue is what retries; and one atomic transaction for both phases, because
 * `batch.commit` waits offline and completes on reconnect, while a transaction
 * fails at once and no connectivity listener exists to retry it.
 *
 * The session doc carries `updatedAt: serverTimestamp()` (TICKET-075, TICKET-072
 * D8), so another phone's change check finds this workout whatever its
 * `startedAt`: an upload hours late from the offline queue has an old start time
 * but a new stamp. The other writer of `sessions` stamps too: importHistory.ts.
 * This function, importHistory.ts and rebuildExerciseStats.ts stamp every write
 * of `exercise_stats` (TICKET-076); a writer that does not is invisible to the
 * summaries' change check.
 */
export const saveWorkoutSession = async (
  userId: string,
  workout: ActiveWorkout,
  /**
   * When the user tapped Finish. Passed in, not read from the clock here: an
   * upload can run hours after the workout ended (TICKET-028's queue), and the
   * session must record the end, not the upload.
   */
  endedAt: number
): Promise<{ sessionId: string; session: WorkoutSessionDoc; summaries: ExerciseStatsDoc[] }> => {
  if (!userId || !workout) throw new Error("Missing userId or workout.");

  const { session, exerciseSessions } = buildSessionDocs(workout, endedAt);

  if (exerciseSessions.length === 0) {
    throw new Error("Nothing to save — no sets were logged.");
  }

  // Phase 1 — canonical data. Offline-safe.
  const batch = writeBatch(db);
  const sessionRef = doc(sessionsRef(userId), session.sessionId);
  batch.set(sessionRef, { ...session, updatedAt: serverTimestamp() }, { merge: true });
  for (const exerciseSession of exerciseSessions) {
    const id = buildExerciseSessionId(
      exerciseSession.sessionId,
      exerciseSession.exerciseId
    );
    batch.set(doc(exerciseSessionsRef(userId), id), exerciseSession);
  }
  await batch.commit();

  // Phase 2 — derived rollup. `summaries` is what it committed, for the phone's
  // own copy (TICKET-076): what `runTransaction` resolves with is the attempt
  // that won, so a retry after a conflict returns its own fold, and an upload
  // retried from the queue returns the fold of the server's current docs. They
  // carry no `updatedAt`: the server's stamp is not known here.
  const folded = await runTransaction(db, async (tx) => {
    const refs = exerciseSessions.map((e) =>
      doc(exerciseStatsRef(userId), e.exerciseId)
    );
    // Firestore requires every read before any write.
    const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));

    const existing = snapshots.map((snapshot) =>
      snapshot.exists() ? (snapshot.data() as ExerciseStatsDoc) : null
    );
    // Verdicts from the rollups as they stand before this session is folded in.
    const statsById = new Map(exerciseSessions.map((e, index) => [e.exerciseId, existing[index]]));
    // A derived value must not block the rollup: if the verdicts cannot be computed the lifts
    // stay `pending` (the compare script finds them, the rebuild repairs them) and the fold goes
    // on. Logged, not `console.error`: in a dev build that opens LogBox over the "Saved" toast.
    let lifts = session.lifts;
    try {
      lifts = withVerdicts(session, (exerciseId) => statsById.get(exerciseId) ?? null);
    } catch (error) {
      console.log("Verdicts not computed, left pending:", error);
    }
    // Merge, as phase 1: a note added since stays. The stamp moves again, so a
    // phone that fetched the pending record fetches this one.
    tx.set(sessionRef, { lifts, updatedAt: serverTimestamp() }, { merge: true });

    const summaries = exerciseSessions.map((exerciseSession, index) => {
      const summary = applySessionToStats(existing[index], exerciseSession);
      tx.set(refs[index], { ...summary, updatedAt: serverTimestamp() });
      return summary;
    });
    return { lifts, summaries };
  });

  return {
    sessionId: session.sessionId,
    session: { ...session, lifts: folded.lifts },
    summaries: folded.summaries,
  };
};

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

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
    sessions: snapshot.docs.map(sessionFromDoc),
    lastDoc: snapshot.docs[snapshot.docs.length - 1] ?? null,
  };
};

// ---------------------------------------------------------------------------
// The recent workouts store's reads (TICKET-075 stage 2)
// ---------------------------------------------------------------------------
//
// From the server, never Firestore's cache, as the plans reads (TICKET-070
// D11): offline these reject, so a failed check is never read as "nothing
// changed" or "never done". `getDocs` here answered offline from the empty
// memory cache, and every plan showed "not in recent workouts" (TICKET-075,
// confirmed on the emulator 2026-11-08).

/**
 * Refuses an answer that includes this phone's own writes not yet confirmed
 * (`hasPendingWrites`), as the plans reads do (`serverOnly` in userDB): such a
 * doc's `updatedAt` reads null, so it would sit unstamped and could not move
 * `lastSeen`. The check fails and the next one asks again.
 */
function serverOnly(snapshot: QuerySnapshot<DocumentData>): QuerySnapshot<DocumentData> {
  if (snapshot.metadata.hasPendingWrites) throw new Error("A workout upload is still queued on this phone");
  return snapshot;
}

/**
 * The newest `updatedAt` among all sessions, or null when none has one: the
 * full reload's baseline (`workoutsLastSeenAfter`). 1 read. Sessions with no
 * `updatedAt` are not in an `orderBy` on it, so a user with only pre-075
 * sessions gets null, and the next change check starts at the epoch.
 */
export const getNewestSessionStamp = async (userId: string): Promise<SyncStamp | null> => {
  if (!userId) throw new Error("Missing user");
  const snapshot = serverOnly(
    await getDocsFromServer(query(sessionsRef(userId), orderBy("updatedAt", "desc"), limitFn(1)))
  );
  return snapshot.empty ? null : (toStamp(snapshot.docs[0].data().updatedAt) ?? null);
};

/**
 * One plan's newest `count` sessions by `startedAt`, the first load's read
 * per plan. Uses the index `sessions (workoutId, startedAt desc)`. A plan never
 * done: no docs, billed 1 read.
 */
export const getPlanSessionsFromServer = async (
  userId: string,
  planId: string,
  count: number
): Promise<WorkoutSessionDoc[]> => {
  if (!userId) throw new Error("Missing user");
  const snapshot = serverOnly(
    await getDocsFromServer(
      query(sessionsRef(userId), where("workoutId", "==", planId), orderBy("startedAt", "desc"), limitFn(count))
    )
  );
  return snapshot.docs.map(sessionFromDoc);
};

/**
 * Sessions written after `after`: `updatedAt > after`, every plan. Nothing
 * changed: no docs, billed 1 read. `>` and a Timestamp rebuilt from seconds
 * and nanoseconds, as `getChangedPlans`. A range on one field needs no index
 * of ours.
 */
export const getChangedSessions = async (userId: string, after: SyncStamp): Promise<WorkoutSessionDoc[]> => {
  if (!userId) throw new Error("Missing user");
  const snapshot = serverOnly(
    await getDocsFromServer(
      query(sessionsRef(userId), where("updatedAt", ">", new Timestamp(after.seconds, after.nanoseconds)))
    )
  );
  return snapshot.docs.map(sessionFromDoc);
};

// ---------------------------------------------------------------------------
// The exercise summaries store's reads (TICKET-076)
// ---------------------------------------------------------------------------
//
// From the server, as above: offline these reject, so a failed check is never
// read as "never done" (TICKET-047: "First time" in airplane mode, from the
// empty memory cache).

/**
 * A summary as the phone holds it. `updatedAt` becomes plain numbers, or is
 * left out for a doc written before 076, whose value is a phone-clock number
 * (`toStamp` refuses it). A `>` on a Timestamp never returns those docs
 * (Firestore compares within one type), so only a full read sees them.
 */
const summaryFromDoc = (snapshot: QueryDocumentSnapshot<DocumentData>): ExerciseStatsDoc => {
  const { updatedAt, ...data } = snapshot.data();
  const stamp = toStamp(updatedAt);
  return { ...(data as ExerciseStatsDoc), ...(stamp ? { updatedAt: stamp } : {}) };
};

/** Every summary the user has: one query, one read per doc (1 when there are none). */
export const getAllExerciseStats = async (userId: string): Promise<ExerciseStatsDoc[]> => {
  if (!userId) throw new Error("Missing user");
  return serverOnly(await getDocsFromServer(exerciseStatsRef(userId))).docs.map(summaryFromDoc);
};

/** Summaries written after `after`. Nothing changed: no docs, billed 1 read. */
export const getChangedExerciseStats = async (userId: string, after: SyncStamp): Promise<ExerciseStatsDoc[]> => {
  if (!userId) throw new Error("Missing user");
  const snapshot = serverOnly(
    await getDocsFromServer(
      query(exerciseStatsRef(userId), where("updatedAt", ">", new Timestamp(after.seconds, after.nanoseconds)))
    )
  );
  return snapshot.docs.map(summaryFromDoc);
};
