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
  deleteField,
  doc,
  getDocFromServer,
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
  QueryConstraint,
  QueryDocumentSnapshot,
  QuerySnapshot,
} from "firebase/firestore";
import { tables } from "../../constants/tables";
import { db } from "../firebase/firebase";
import {
  ExerciseStatsDoc,
  ExerciseStatsMarker,
  isStatsMarker,
  LiftRecord,
  WorkoutSessionDoc,
} from "../../types/workoutSession";
import { ActiveWorkout } from "../../types/zustandWorkoutType";
import {
  applySessionToStats,
  buildExerciseSessionId,
  buildSessionDocs,
} from "../../utils/exerciseStats";
import { readLifts, summaryWithEdited, summaryWithout, withVerdicts } from "../../utils/liftRecord";
import { draftAffected, draftDiff } from "../../utils/editSession";
import { compareStamps, toStamp, type SyncStamp } from "../../utils/syncCore";
import { secondQueryStart } from "../../utils/workoutWindow";
import { localMonthRange } from "../../utils/monthWindow";

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
 *     TICKET-085c retires them. The session is written with
 *     merge, so a replayed upload keeps a `note` the user added since and
 *     writes none itself. Offline it waits in Firestore's memory cache and
 *     completes on reconnect. That cache dies with the app: the upload queue is
 *     what makes an offline Finish safe.
 *  2. A transaction that folds those sessions into the exercise_stats rollup
 *     and, from the rollups it reads (no extra read), puts each lift's verdict
 *     on the session's `lifts`: one more write, 18 per Finish of 8 lifts, and
 *     9 reads (a rollup per lift, and the workout's own doc: if it is a
 *     `deleted` marker the workout was deleted while the upload waited in a
 *     queue, TICKET-086, so phase 2 deletes the `exercise_sessions` docs phase 1
 *     just wrote, folds nothing and returns `{ deleted: true }`; the marker
 *     itself is merged into by phase 1, so its `lifts` and stamp move once more).
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
): Promise<
  | { sessionId: string; session: WorkoutSessionDoc; summaries: ExerciseStatsDoc[]; deleted?: false }
  /** The workout was deleted before this upload landed: nothing was folded, and the phone must not hold it. */
  | { sessionId: string; deleted: true }
> => {
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
    const [sessionSnapshot, ...snapshots] = await Promise.all([tx.get(sessionRef), ...refs.map((ref) => tx.get(ref))]);

    // The workout was deleted (TICKET-086) while this upload waited in a queue, on this phone or another: phase 1
    // has just written its `exercise_sessions` docs again and merged into the marker (which keeps `deleted`), so
    // take those docs back out and fold nothing. The marker stays; the stats were rebuilt without this workout.
    if (sessionSnapshot.exists() && sessionSnapshot.data().deleted === true) {
      exerciseSessions.forEach((e) =>
        tx.delete(doc(exerciseSessionsRef(userId), buildExerciseSessionId(e.sessionId, e.exerciseId)))
      );
      return { deleted: true as const };
    }

    // A `deleted` marker (TICKET-086) is no rollup: the lift starts again from nothing, so a deleted
    // lift's old bests cannot come back and `withVerdicts` says First time. The `set` below replaces
    // the marker whole, so the flag goes with it.
    const existing = snapshots.map((snapshot) => {
      if (!snapshot.exists()) return null;
      const data = snapshot.data() as ExerciseStatsDoc | ExerciseStatsMarker;
      return isStatsMarker(data) ? null : data;
    });
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
    return { deleted: false as const, lifts, summaries };
  });

  if (folded.deleted) return { sessionId: session.sessionId, deleted: true };
  return {
    sessionId: session.sessionId,
    session: { ...session, lifts: folded.lifts },
    summaries: folded.summaries,
    deleted: false,
  };
};

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

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
 * The workout window's first load (TICKET-082): two queries by `startedAt`.
 * The newest `min` workouts; then, when `min` came back, the rest of the oldest
 * of their local months, continuing after the first query's last doc, so the
 * month is complete and two workouts with the same `startedAt` at the edge are
 * neither lost nor read twice (`secondQueryStart`). `rest` is null when no
 * second query ran: fewer than `min` came back, so the whole history is in
 * `newest`. Both use the automatic single-field index on `startedAt` (a range
 * and an order on one field); `firestore.indexes.json` needs no entry for them
 * (checked read-only against a real account, TICKET-082).
 */
export const getWorkoutWindowFromServer = async (
  userId: string,
  min: number
): Promise<{ newest: WorkoutSessionDoc[]; rest: WorkoutSessionDoc[] | null }> => {
  if (!userId) throw new Error("Missing user");
  const first = serverOnly(
    await getDocsFromServer(query(sessionsRef(userId), orderBy("startedAt", "desc"), limitFn(min)))
  );
  const newest = first.docs.map(sessionFromDoc);
  const from = secondQueryStart(newest, min);
  if (from === null) return { newest, rest: null };
  const second = serverOnly(
    await getDocsFromServer(
      query(
        sessionsRef(userId),
        where("startedAt", ">=", from),
        orderBy("startedAt", "desc"),
        startAfter(first.docs[first.docs.length - 1])
      )
    )
  );
  return { newest, rest: second.docs.map(sessionFromDoc) };
};

/**
 * One page of the workouts older than the phone holds (TICKET-085a, decided in TICKET-088): `startedAt`
 * before `before`, newest first, `size` of them. `planId` narrows it to one plan (`workoutId ==` with the
 * existing `(workoutId, startedAt desc)` index); without it, the automatic single-field index on `startedAt`.
 * `deleted` markers are skipped and the next batch asked for, so a page is never short because of them
 * (`docsRead` counts them, and counts an empty answer as the 0 it is: the caller bills 1 for it).
 * `reachedStart`: an answer came back with fewer docs than asked, so nothing older exists. A page that
 * ends exactly on the first workout says false, and the next one, with no docs, says true.
 * Known gap: two workouts with the same `startedAt` to the millisecond across the `before` edge, the later
 * one is not returned (a `<` on the time, not a cursor on the doc). The window's first load has no such gap
 * (`secondQueryStart`); a second workout started in the same millisecond is not a case a person can make.
 * Rejects when offline (`serverOnly`, `getDocsFromServer`); the store turns that into a state.
 */
export const getOlderWorkoutsPage = async (
  userId: string,
  before: number,
  planId: string | null,
  size: number
): Promise<{ sessions: WorkoutSessionDoc[]; docsRead: number; reachedStart: boolean }> =>
  pageOfSessions(userId, planId === null ? null : where("workoutId", "==", planId), before, size);

/**
 * One page of the workouts that have `exerciseId` and are older than `before` (TICKET-084 stage 3): the Exercise screen's log
 * past the phone's window. `exerciseIds` is the list derived from `lifts` (`exerciseIds` array-contains), newest first, so a page
 * is `size` workouts of this lift and nothing else. Needs the composite index `(exerciseIds array-contains, startedAt desc)`
 * in `firestore.indexes.json`, which the user deploys: without it the read is refused (`failed-precondition`) and the screen
 * says it could not load. Everything else (markers skipped, the start, the known same-millisecond gap, offline rejecting)
 * is `getOlderWorkoutsPage`'s, as it is the same loop.
 * Each document carries every lift of its workout, so a page of 20 is about 64 KB (measured on fixtures in TICKET-087).
 */
export const getSessionsOfExercisePage = async (
  userId: string,
  exerciseId: string,
  before: number,
  size: number
): Promise<{ sessions: WorkoutSessionDoc[]; docsRead: number; reachedStart: boolean }> => {
  if (!exerciseId) throw new Error("Missing exercise");
  return pageOfSessions(userId, where("exerciseIds", "array-contains", exerciseId), before, size);
};

/** The loop both pages share: `filter` (or none), `startedAt` before `before`, newest first, `deleted` markers skipped. */
async function pageOfSessions(
  userId: string,
  filter: QueryConstraint | null,
  before: number,
  size: number
): Promise<{ sessions: WorkoutSessionDoc[]; docsRead: number; reachedStart: boolean }> {
  if (!userId) throw new Error("Missing user");
  const sessions: WorkoutSessionDoc[] = [];
  let docsRead = 0;
  let after: QueryDocumentSnapshot<DocumentData> | null = null;
  for (;;) {
    const asked = size - sessions.length;
    const answer = serverOnly(
      await getDocsFromServer(
        query(
          sessionsRef(userId),
          ...(filter === null ? [] : [filter]),
          where("startedAt", "<", before),
          orderBy("startedAt", "desc"),
          ...(after ? [startAfter(after)] : []),
          limitFn(asked)
        )
      )
    );
    docsRead += answer.size;
    sessions.push(...answer.docs.map(sessionFromDoc).filter((session) => session.deleted !== true));
    if (answer.size < asked) return { sessions, docsRead, reachedStart: true };
    if (sessions.length >= size) return { sessions, docsRead, reachedStart: false };
    after = answer.docs[answer.docs.length - 1];
  }
}

/**
 * One workout by its id, or null when it does not exist or is a `deleted` marker (TICKET-083: a workout
 * opened that is not on the phone). 1 read. From the server, never the cache: offline this rejects, so
 * the screen says it needs a connection rather than "not found". A doc this phone has written and the
 * server has not confirmed is refused as the queries are (`serverOnly`): it is in the upload queue, which
 * the Session screen reads first.
 */
export const getWorkoutById = async (userId: string, sessionId: string): Promise<WorkoutSessionDoc | null> => {
  if (!userId || !sessionId) throw new Error("Missing user or session");
  const snapshot = await getDocFromServer(doc(sessionsRef(userId), sessionId));
  if (snapshot.metadata.hasPendingWrites) throw new Error("A workout upload is still queued on this phone");
  if (!snapshot.exists()) return null;
  const session = sessionFromDoc(snapshot as QueryDocumentSnapshot<DocumentData>);
  return session.deleted === true ? null : session;
};

/**
 * Set a workout's note, or remove it with `null` (TICKET-083). A transaction on purpose: it needs the server,
 * so offline it rejects, where a plain write would sit in Firestore's memory cache, report nothing and apply
 * later (the "refused offline" the Session screen promises). It also throws when the workout is not there,
 * rather than creating a doc holding only a note. `updatedAt` moves, so another phone's change check brings the
 * note. The note's length is the caller's rule (`normalizeNote`); the rules file has no field whitelist.
 */
export const setWorkoutNote = async (userId: string, sessionId: string, note: string | null): Promise<void> => {
  if (!userId || !sessionId) throw new Error("Missing user or session");
  const ref = doc(sessionsRef(userId), sessionId);
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref);
    // Coded, so the screen can say so instead of "try again": a retry cannot make a missing doc appear.
    if (!snapshot.exists()) throw Object.assign(new Error("This workout is not on the server"), { code: "not-found" });
    tx.update(ref, { note: note === null ? deleteField() : note, updatedAt: serverTimestamp() });
  });
};

/**
 * Every session of one lift, as they stand on the server (`deleted` markers included; the pure
 * `summaryWithout` skips them): `exerciseIds` array-contains, no limit, so 1 read per workout of the
 * lift, about 370 reads at 150 workouts of 8 lifts (TICKET-087's fixtures). Automatic index only.
 * Offline it rejects, as every server read here does.
 */
async function getAllSessionsOfExercise(userId: string, exerciseId: string): Promise<WorkoutSessionDoc[]> {
  const answer = serverOnly(await getDocsFromServer(query(sessionsRef(userId), where("exerciseIds", "array-contains", exerciseId))));
  return answer.docs.map(sessionFromDoc);
}

export type DeleteWorkoutResult = {
  /** What each of the workout's lifts' summary became: a rebuilt summary, or a marker when no session is left. Unstamped, as a Finish's. */
  summaries: (ExerciseStatsDoc | ExerciseStatsMarker)[];
  /** Workout docs read to rebuild, for the proof. */
  docsRead: number;
};

/**
 * Delete a workout (TICKET-086). Never a hard delete: a change check cannot see one, so the `sessions` doc stays
 * with `deleted: true` and a server stamp, and another phone drops it at its next check (`addToWindow`). Its
 * `exercise_sessions` docs are deleted until TICKET-085c retires them (ids are derived, no read). Each of its
 * lifts' `exercise_stats` is replaced by a rebuild from the lift's other sessions, or becomes a marker when none
 * is left (`summaryWithout`), because `bestByReps` cannot be decremented (TICKET-032).
 *
 * Reads first (server only, so offline it rejects before anything is written), then one transaction for the writes:
 * a transaction, as `setWorkoutNote`, because a batch offline would wait in the cache and apply later, and "refused
 * offline" is the rule. Writes: 1 + 2 per lift. Not in scope, decided with the user (2026-11-21): the next session's
 * stored verdict is not rewritten (TICKET-095).
 *
 * A Finish landing between the reads and the commit (one phone is enough: the reads take seconds and a queued upload
 * can drain meanwhile) would be overwritten by the rebuild, which never saw it. So each summary's stamp is read first
 * and the transaction reads them again and refuses (`changed`) if one moved. Rejected: accepting the race and healing
 * with `rebuildExerciseStats.ts`, which nothing tells the user to run (PR #79 review, F2).
 *
 * Rejects with a `code`: `not-found` (not on the server, so there is nothing to delete), `unreadable-history`
 * (a lift has a session in the old shape, `summaryWithout`) and `changed` (above). Already deleted resolves with nothing written, so a
 * retry after a lost answer is safe; it returns no summaries, so the phone's held bests stay as they were until the next change check. `dryRun` does the reads and reports, writing nothing (3.3).
 */
export const deleteWorkout = async (
  userId: string,
  session: Pick<WorkoutSessionDoc, "sessionId" | "exerciseIds"> & { lifts?: readonly { id: string }[] },
  options: { dryRun?: boolean } = {}
): Promise<DeleteWorkoutResult> => {
  if (!userId || !session.sessionId) throw new Error("Missing user or session");
  const sessionRef = doc(sessionsRef(userId), session.sessionId);
  // `exerciseIds` is derived from `lifts` and the compare script checks they agree; a lift left out of it would keep
  // the deleted workout's best, so both are used. Once each: the writes below line up with this list.
  const exerciseIds = [...new Set([...session.exerciseIds, ...(session.lifts ?? []).map((lift) => lift.id)])];

  let docsRead = 0;
  const summaries: DeleteWorkoutResult["summaries"] = [];
  // Each summary's stamp as it stood before the sessions were read: the transaction refuses if one moved (a Finish's
  // fold landed in between), so a rebuild never overwrites a newer fold.
  const stampsBefore: (SyncStamp | undefined)[] = [];
  for (const exerciseId of exerciseIds) {
    const statsSnapshot = await getDocFromServer(doc(exerciseStatsRef(userId), exerciseId));
    stampsBefore.push(toStamp(statsSnapshot.data()?.updatedAt));
    const sessionsOfLift = await getAllSessionsOfExercise(userId, exerciseId);
    docsRead += sessionsOfLift.length;
    const rebuilt = summaryWithout(exerciseId, sessionsOfLift, session.sessionId);
    if (rebuilt.status === "unreadable") {
      throw Object.assign(new Error(`${exerciseId} has sessions in the old format: ${rebuilt.sessionIds.join(", ")}`), {
        code: "unreadable-history",
      });
    }
    summaries.push(rebuilt.stats ?? { exerciseId, deleted: true });
  }
  if (options.dryRun) return { summaries, docsRead };

  const alreadyDeleted = await runTransaction(db, async (tx) => {
    const [snapshot, ...statsSnapshots] = await Promise.all([
      tx.get(sessionRef),
      ...exerciseIds.map((exerciseId) => tx.get(doc(exerciseStatsRef(userId), exerciseId))),
    ]);
    // Coded, as `setWorkoutNote`: a retry cannot make a missing doc appear.
    if (!snapshot.exists()) throw Object.assign(new Error("This workout is not on the server"), { code: "not-found" });
    if (snapshot.data().deleted === true) return true;
    // Coded: a retry rebuilds from what the Finish wrote.
    if (statsSnapshots.some((stats, index) => compareStamps(toStamp(stats.data()?.updatedAt), stampsBefore[index]) !== 0)) {
      throw Object.assign(new Error("A summary changed while the workout was being deleted"), { code: "changed" });
    }
    tx.update(sessionRef, { deleted: true, updatedAt: serverTimestamp() });
    exerciseIds.forEach((exerciseId, index) => {
      tx.delete(doc(exerciseSessionsRef(userId), buildExerciseSessionId(session.sessionId, exerciseId)));
      // Replace, never merge: a merge would keep the old bests (TICKET-032).
      tx.set(doc(exerciseStatsRef(userId), exerciseId), { ...summaries[index], updatedAt: serverTimestamp() });
    });
    return false;
  });
  return alreadyDeleted ? { summaries: [], docsRead } : { summaries, docsRead };
};

export type SaveEditedWorkoutResult = {
  /** The workout as the server now holds it (its stamp is not known here, as a Finish's): what the phone's copies take. */
  session: WorkoutSessionDoc;
  /** What each affected lift's summary became, unstamped: a rebuilt summary, or a marker for a lift no session has any more. */
  summaries: (ExerciseStatsDoc | ExerciseStatsMarker)[];
  /** Workout docs read to rebuild, for the proof. */
  docsRead: number;
};

/**
 * Save an edit draft of a past workout (TICKET-102 stage 2). The draft is built into docs as a Finish builds them
 * (`buildSessionDocs`, keeping the workout's own id, start and end), so the stored workout is replaced in place: its
 * `lifts`, `exerciseIds` and `volume`, and its `exercise_sessions` docs until TICKET-085c retires them. `note`,
 * `startedAt`, `endedAt` and the name are not written. Only touched lifts are rebuilt (`draftDiff`): each one's
 * `exercise_stats` is replaced by a rebuild from the lift's sessions with the edited one swapped in
 * (`summaryWithEdited`), because a best cannot be lowered by a fold. An untouched lift keeps its stored record and verdict.
 *
 * Same shape as `deleteWorkout`, for the same reasons: reads first (server only, so offline it rejects before any
 * write), then one transaction (never a batch, which waits offline and applies later). Reads per touched lift: its
 * summary's stamp, then every session of the lift; writes: 1 + 2 per touched lift. The transaction re-reads the
 * workout's doc and each summary and refuses (`changed`) if a stamp moved, so a Finish or an edit landing between the
 * reads and the commit is never overwritten by a rebuild that did not see it. The workout's own stamp moves with a
 * note too: that refuses harmlessly, and a second Save succeeds.
 *
 * Exercises added or removed (stage 3) are lifts too: an added lift's summary is rebuilt with this workout in it; a
 * removed one (or one whose every set was deleted) is rebuilt without it (`summaryWithout`), or becomes a marker when no
 * session of it is left, as a delete's, and its `exercise_sessions` doc is deleted. A workout with no lift left is refused
 * (`nothing-left`): that is a delete, which has its own path.
 *
 * Rejects with a `code`: `nothing-left`, `not-found`, `deleted`, `unreadable-history` (`summaryWithEdited`,
 * `summaryWithout`) and `changed`. Nothing differing resolves with nothing written. The next
 * workout's stored verdict is not rewritten (TICKET-095), as in `deleteWorkout`. `dryRun` reads and reports (3.3).
 */
export const saveEditedWorkout = async (
  userId: string,
  workout: ActiveWorkout,
  options: { dryRun?: boolean } = {}
): Promise<SaveEditedWorkoutResult> => {
  const editOf = workout.editOf;
  if (!userId || !editOf) throw new Error("Missing user, or not an edit draft");
  const { session, exerciseSessions } = buildSessionDocs(workout, editOf.endedAt);
  if (session.sessionId !== editOf.sessionId) throw new Error("The draft does not name the workout it edits");
  const diff = draftDiff(workout);
  const affected = draftAffected(diff);
  if (affected.length === 0) return { session, summaries: [], docsRead: 0 };
  if (session.lifts.length === 0) throw Object.assign(new Error("Every exercise was removed"), { code: "nothing-left" });

  const sessionRef = doc(sessionsRef(userId), session.sessionId);
  const sessionBefore = await getDocFromServer(sessionRef);
  if (!sessionBefore.exists()) throw Object.assign(new Error("This workout is not on the server"), { code: "not-found" });
  if (sessionBefore.data().deleted === true) throw Object.assign(new Error("This workout was deleted"), { code: "deleted" });
  const sessionStampBefore = toStamp(sessionBefore.data().updatedAt);

  let docsRead = 0;
  const rebuilt = new Map<string, { stats: ExerciseStatsDoc; lift: LiftRecord }>();
  const summaries: SaveEditedWorkoutResult["summaries"] = [];
  const stampsBefore: (SyncStamp | undefined)[] = [];
  for (const exerciseId of affected) {
    const statsSnapshot = await getDocFromServer(doc(exerciseStatsRef(userId), exerciseId));
    stampsBefore.push(toStamp(statsSnapshot.data()?.updatedAt));
    const sessionsOfLift = await getAllSessionsOfExercise(userId, exerciseId);
    docsRead += sessionsOfLift.length;
    if (diff.removed.includes(exerciseId)) {
      const without = summaryWithout(exerciseId, sessionsOfLift, session.sessionId);
      if (without.status === "unreadable") {
        throw Object.assign(new Error(`${exerciseId} has sessions in the old format: ${without.sessionIds.join(", ")}`), { code: "unreadable-history" });
      }
      summaries.push(without.stats ?? { exerciseId, deleted: true });
      continue;
    }
    const answer = summaryWithEdited(exerciseId, sessionsOfLift, session);
    if (answer.status === "unreadable") {
      throw Object.assign(new Error(`${exerciseId} has sessions in the old format: ${answer.sessionIds.join(", ")}`), { code: "unreadable-history" });
    }
    // A touched or added lift is in the draft and has sets, so both exist; a missing one is a bug, not data to write.
    if (!answer.stats || !answer.lift) throw new Error(`Rebuild of ${exerciseId} found no session with it`);
    rebuilt.set(exerciseId, { stats: answer.stats, lift: answer.lift });
    summaries.push(answer.stats);
  }

  // The lifts as written: a touched lift with its recomputed verdict, an untouched one exactly as stored (the draft
  // holds its sets but not its verdict). Built inside the transaction from the doc it just read, for the verdicts.
  const withStoredVerdicts = (storedLifts: unknown): LiftRecord[] => {
    const stored = new Map((readLifts(storedLifts) ?? []).map((lift) => [lift.id, lift]));
    return session.lifts.map((lift) => rebuilt.get(lift.id)?.lift ?? stored.get(lift.id) ?? lift);
  };
  if (options.dryRun) return { session: { ...session, lifts: withStoredVerdicts(sessionBefore.data().lifts) }, summaries, docsRead };

  let lifts: LiftRecord[] = [];
  await runTransaction(db, async (tx) => {
    const [sessionSnapshot, ...statsSnapshots] = await Promise.all([
      tx.get(sessionRef),
      ...affected.map((exerciseId) => tx.get(doc(exerciseStatsRef(userId), exerciseId))),
    ]);
    if (!sessionSnapshot.exists()) throw Object.assign(new Error("This workout is not on the server"), { code: "not-found" });
    if (sessionSnapshot.data().deleted === true) throw Object.assign(new Error("This workout was deleted"), { code: "deleted" });
    const moved =
      compareStamps(toStamp(sessionSnapshot.data().updatedAt), sessionStampBefore) !== 0 ||
      statsSnapshots.some((stats, index) => compareStamps(toStamp(stats.data()?.updatedAt), stampsBefore[index]) !== 0);
    if (moved) throw Object.assign(new Error("The workout or a summary changed while the edit was saved"), { code: "changed" });

    lifts = withStoredVerdicts(sessionSnapshot.data().lifts);
    // Update, not set: `note`, `startedAt`, `endedAt` and the name stay as stored.
    tx.update(sessionRef, { lifts, exerciseIds: session.exerciseIds, volume: session.volume, updatedAt: serverTimestamp() });
    exerciseSessions
      .filter((exerciseSession) => rebuilt.has(exerciseSession.exerciseId))
      .forEach((exerciseSession) =>
        tx.set(doc(exerciseSessionsRef(userId), buildExerciseSessionId(exerciseSession.sessionId, exerciseSession.exerciseId)), exerciseSession)
      );
    // A removed lift's record of this workout goes (ids are derived, no read).
    diff.removed.forEach((exerciseId) => tx.delete(doc(exerciseSessionsRef(userId), buildExerciseSessionId(session.sessionId, exerciseId))));
    // Replace, never merge: a merge would keep the old bests (TICKET-032).
    affected.forEach((exerciseId, index) => tx.set(doc(exerciseStatsRef(userId), exerciseId), { ...summaries[index], updatedAt: serverTimestamp() }));
  });
  return { session: { ...session, lifts }, summaries, docsRead };
};

/**
 * One plan's newest workout, or null when it has none: the floor's lookup, for a plan with no
 * workout in the window (TICKET-082). 1 read, billed 1 when the plan was never done. Uses the
 * index `sessions (workoutId, startedAt desc)`. A `deleted` marker is not a workout: it is
 * skipped (a marker keeps its `startedAt`, so as the answer it would leave the plan undated and
 * asked again on every check). One doc is read at a time, so the usual lookup costs 1 read; each
 * marker in a row costs one more, which the debug readout (1 per lookup) does not count.
 */
export const getLastWorkoutOfPlan = async (userId: string, planId: string): Promise<WorkoutSessionDoc | null> => {
  if (!userId) throw new Error("Missing user");
  let after: QueryDocumentSnapshot<DocumentData> | null = null;
  for (;;) {
    const ofPlan = [where("workoutId", "==", planId), orderBy("startedAt", "desc")];
    const page = serverOnly(
      await getDocsFromServer(query(sessionsRef(userId), ...ofPlan, ...(after ? [startAfter(after)] : []), limitFn(1)))
    );
    if (page.empty) return null;
    const session = sessionFromDoc(page.docs[0]);
    if (session.deleted !== true) return session;
    after = page.docs[0];
  }
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
// A lift's `deleted` marker comes back as it is (`ExerciseStatsMarker`): the store's merge drops it.
const summaryFromDoc = (snapshot: QueryDocumentSnapshot<DocumentData>): ExerciseStatsDoc | ExerciseStatsMarker => {
  const { updatedAt, ...data } = snapshot.data();
  const stamp = toStamp(updatedAt);
  return { ...(data as ExerciseStatsDoc | ExerciseStatsMarker), ...(stamp ? { updatedAt: stamp } : {}) };
};

/** Every summary the user has: one query, one read per doc (1 when there are none). */
export const getAllExerciseStats = async (userId: string): Promise<(ExerciseStatsDoc | ExerciseStatsMarker)[]> => {
  if (!userId) throw new Error("Missing user");
  return serverOnly(await getDocsFromServer(exerciseStatsRef(userId))).docs.map(summaryFromDoc);
};

/** Summaries written after `after`. Nothing changed: no docs, billed 1 read. */
export const getChangedExerciseStats = async (userId: string, after: SyncStamp): Promise<(ExerciseStatsDoc | ExerciseStatsMarker)[]> => {
  if (!userId) throw new Error("Missing user");
  const snapshot = serverOnly(
    await getDocsFromServer(
      query(exerciseStatsRef(userId), where("updatedAt", ">", new Timestamp(after.seconds, after.nanoseconds)))
    )
  );
  return snapshot.docs.map(summaryFromDoc);
};
