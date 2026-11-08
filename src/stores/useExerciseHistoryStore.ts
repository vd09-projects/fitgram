// src/stores/useExerciseHistoryStore.ts
//
// The signed-in user's exercise summaries on the phone (TICKET-076): one
// `exercise_stats` doc for every exercise done, saved to AsyncStorage, so "last
// time", ghosts, the PR banner and the history sheet work offline after a
// restart. Keyed by exercise, not workout: the last bench press is the last
// bench press in any plan.
//
// On the sync core (`syncRunner.ts`, `syncCore.ts`). A check is one of two kinds
// (rules in `exerciseSummariesSync.ts`):
// - full: the whole collection in one query, when nothing is held;
// - change: summaries with `updatedAt > lastSeen` (1 read when nothing changed).
// Every read is from the server (`serverOnly` in workoutSessions.ts).
//
// Triggers: a plan card opening, a workout starting or resuming, an exercise
// added or swapped, the sheet's Reload. Readers (`useExerciseHistory`) only
// select state, so no number of them costs a read.
//
// Own Finish (`applyFinished`): the summaries the upload's transaction computed
// go in unstamped, with no read; the next check brings the stamped copies back
// (`withFinishedSummaries`).
//
// A failed Finish summary (`rollupPending` stays true, TICKET-077) writes no
// doc and returns none, so the store keeps what it held: "last time", ghosts
// and the PR banner show the previous session, with its own date, and an
// exercise with no summary at all stays "First time" with no target and no
// banner. An older true fact or an absence, never a wrong number (TICKET-076).
//
// Sign-out clears it (`initAuth`), as the plans and the recent workouts.

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAllExerciseStats, getChangedExerciseStats } from "../services/db/workoutSessions";
import type { ExerciseStatsDoc } from "../types/workoutSession";
import { changeCheckAfter, type SyncStamp } from "../utils/syncCore";
import {
  mergeSummaries,
  withFinishedSummaries,
  readStoredSummaries,
  serializeStoredSummaries,
  storedSummariesKeys,
  summariesLastSeenAfter,
  summariesRunFor,
  type HeldSummaries,
  type SummariesById,
  type SummariesCheckKind,
} from "../utils/exerciseSummariesSync";
import { createSyncRunner, type CheckRun as RunBase, type SyncFields } from "./syncRunner";
import { EXERCISE_SUMMARIES_CHECK_SKIP_MS, EXERCISE_SUMMARIES_CHECK_WAIT_MS, EXERCISE_SUMMARIES_SHARDS } from "../config/sync";

type CheckOptions = {
  /** Past the skip window. */
  force?: boolean;
  /** A full load, for the debug page. */
  full?: boolean;
};

interface ExerciseHistoryStoreState extends SyncFields<SummariesCheckKind> {
  /** Null: nothing stored for `uid` and no answer yet. */
  byId: SummariesById | null;
  /** The newest `updatedAt` an answer returned (server clock); null: none yet. */
  lastSeen: SyncStamp | null;
  /** When the last full load answered (phone clock). Debug only: nothing is scheduled on it. */
  lastFullAt: number | null;
  /** Debug readout: Firestore reads billed by checks this app run (a query that returns nothing bills 1). */
  billedReads: number;

  /** A trigger: load the stored copy for `uid`, then check. Never rejects. */
  open: (uid: string | undefined, options?: CheckOptions) => Promise<void>;
  check: (options?: CheckOptions) => Promise<void>;
  /** This phone's upload committed these summaries: hold them, 0 reads. */
  applyFinished: (uid: string, summaries: ExerciseStatsDoc[]) => void;
  /** Sign-out. */
  clear: () => void;
}

const initialState = {
  uid: null,
  byId: null,
  storedRead: false,
  checking: false,
  waitOver: false,
  lastResult: null,
  lastError: null,
  lastOkAt: null,
  lastSeen: null,
  lastFullAt: null,
  readout: { reads: 0, log: [] }, // debug readout
};

type CheckRun = RunBase<SummariesCheckKind> & { seenAtStart: SyncStamp | null };

/** Debug readout: a query bills its docs, and 1 when it returns none. */
const billed = (docs: ExerciseStatsDoc[]) => {
  useExerciseHistoryStore.setState((s) => ({ billedReads: s.billedReads + Math.max(1, docs.length) }));
  return docs;
};

async function readStoredCopy(uid: string): Promise<HeldSummaries | null> {
  try {
    const rows = await AsyncStorage.multiGet(storedSummariesKeys(EXERCISE_SUMMARIES_SHARDS));
    const read = readStoredSummaries(rows, uid, EXERCISE_SUMMARIES_SHARDS);
    if (read.error) console.warn("Stored exercise summaries discarded; will fetch:", read.error);
    return read.held;
  } catch (error) {
    console.warn("Stored exercise summaries unreadable; will fetch:", error);
    return null;
  }
}

export const useExerciseHistoryStore = create<ExerciseHistoryStoreState>((set, get) => {
  const runner = createSyncRunner<ExerciseHistoryStoreState, SummariesCheckKind, CheckRun, ExerciseStatsDoc[]>({
    get,
    set,
    initialState,
    waitMs: EXERCISE_SUMMARIES_CHECK_WAIT_MS,
    skipMs: EXERCISE_SUMMARIES_CHECK_SKIP_MS,
    readStored: readStoredCopy,
    holdsData: (s) => s.byId !== null,
    writeStored: async ({ uid, byId, lastSeen, lastFullAt }) => {
      if (uid === null) {
        await AsyncStorage.multiRemove(storedSummariesKeys(EXERCISE_SUMMARIES_SHARDS));
      } else if (byId !== null) {
        await AsyncStorage.multiSet(serializeStoredSummaries(uid, EXERCISE_SUMMARIES_SHARDS, { byId, lastSeen, lastFullAt }));
      }
    },
    read: (run) =>
      (run.kind === "full"
        ? getAllExerciseStats(run.uid)
        : getChangedExerciseStats(run.uid, changeCheckAfter(run.seenAtStart))
      ).then(billed),
    apply: (state, run, docs, now) => ({
      // A full load starts from nothing, so a summary deleted on the server goes.
      byId: mergeSummaries(run.kind === "full" ? {} : (state.byId ?? {}), docs),
      lastSeen: summariesLastSeenAfter(run.kind, state.lastSeen, docs),
      ...(run.kind === "full" && { lastFullAt: now }),
    }),
    describe: (docs) => `${docs.length} docs`,
    label: "exercise summaries",
  });

  return {
    ...initialState,
    epoch: 0,
    billedReads: 0, // debug readout

    open: async (uid, options) => {
      if (!uid) return;
      await runner.open(uid);
      await get().check(options);
    },

    check: ({ force = false, full = false } = {}) =>
      runner.check({ force }, (state, skipped) => summariesRunFor(state, skipped, full)),

    applyFinished: (uid, summaries) => {
      const state = get();
      // Nothing held: a few summaries are not the user's history (CLAUDE.md
      // 2.4), and every other exercise would read "First time". The next check
      // is a first load, which has them.
      if (state.uid !== uid || state.byId === null) return;
      set({ byId: withFinishedSummaries(state.byId, summaries) });
      runner.persist();
      runner.note("ok", undefined, `own Finish: ${summaries.length} summaries, 0 reads now (${summaries.length} tx.get in the transaction)`);
    },

    clear: runner.clear,
  };
});
