import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getChangedSessions, getNewestSessionStamp, getPlanSessionsFromServer } from "../services/db/workoutSessions";
import type { WorkoutSessionDoc } from "../types/workoutSession";
import { changeCheckAfter, fullReloadDue, type SyncStamp } from "../utils/syncCore";
import {
  fullReloadPlans,
  mergeIntoPlans,
  planIdsToHold,
  readStoredWorkouts,
  serializeStoredWorkouts,
  stillOwnFinished,
  workoutsLastSeenAfter,
  type HeldWorkouts,
  type WorkoutsByPlan,
} from "../utils/workoutsSync";
import { createSyncRunner, type CheckRun as RunBase, type ReadoutEntry as SyncReadoutEntry, type SyncFields } from "./syncRunner";
import { usePlansStore } from "./usePlansStore";
import {
  WORKOUTS_CHECK_SKIP_MS,
  WORKOUTS_CHECK_WAIT_MS,
  WORKOUTS_FULL_RELOAD_INTERVAL_MS,
  WORKOUTS_PER_PLAN,
} from "../config/sync";
import { WORKOUTS_STORAGE_KEY } from "../config/storageKeys";

/**
 * The signed-in user's recent workouts on the phone (TICKET-075): the newest
 * `WORKOUTS_PER_PLAN` sessions of each plan, Freestyle counted as a plan.
 * One shared copy for the hub, Start, Manage and the mid-workout picker,
 * where each screen used to read the newest 20 on every focus
 * (`useRecentSessions`, removed). Saved to AsyncStorage, so the dates show
 * at once and offline.
 *
 * A check is one of three kinds (the merge and `lastSeen` rules are pure
 * functions in `workoutsSync.ts`):
 * - full: a baseline read (the newest stamp, 1 read), then one query per
 *   plan, newest N by `startedAt`. Replaces what is held. On the first load,
 *   every `WORKOUTS_FULL_RELOAD_INTERVAL_MS`, and after a copy with another N
 *   was discarded. All or nothing: one failed query fails the check.
 * - change: sessions with `updatedAt > lastSeen`, any plan (1 read when
 *   nothing changed), plus a per-plan query for any plan not loaded yet.
 * - new plans: only the per-plan queries for plans not loaded yet, when a
 *   check ran less than 2 minutes ago (they are not skipped: a plan with no
 *   dates is the gap they fill).
 * Every read is from the server (`serverOnly` in workoutSessions.ts).
 *
 * Plans arriving later (PR #52 review): on a first launch the plans store may
 * hold nothing when a screen's check runs, so there is nothing to load. The
 * store follows the plans store's ids (`followPlans` below) and checks when
 * ids appear that are not loaded, with no focus needed.
 *
 * Own Finish, 0 reads: `applyFinished` puts the uploaded session in unstamped
 * (ordering is by `startedAt`, so it needs no stamp). `lastSeen` does not
 * move, so the next change check returns it once and the stamped copy
 * replaces it.
 *
 * Sign-out clears it (`initAuth`), as the plans store.
 */

export type WorkoutsCheckKind = "full" | "change" | "new plans";
export type WorkoutsReadoutEntry = SyncReadoutEntry<WorkoutsCheckKind>;

interface WorkoutsStore extends SyncFields<WorkoutsCheckKind> {
  /** Null: nothing stored for `uid` and no answer yet. Readers then say "last session unknown". */
  byPlan: WorkoutsByPlan | null;
  /** Plans whose own query answered: their list is their newest N. */
  loaded: string[];
  /** Own Finishes not yet seen stamped, kept through a full reload (`fullReloadPlans`). */
  ownFinished: string[];
  /** The newest `updatedAt` a change check or baseline returned (server clock); null: none yet. */
  lastSeen: SyncStamp | null;
  /** When the last full reload answered (phone clock). */
  lastFullAt: number | null;
  /** Debug readout: Firestore reads billed this app run (a query that returns nothing bills 1). */
  billedReads: number;

  /** A reader opened: load the stored copy for `uid`, then check. */
  open: (uid: string) => Promise<void>;
  /** Ask the server now unless skipped or one is running. `force`: past the skip. `full`: a full reload. */
  check: (options?: { force?: boolean; full?: boolean }) => Promise<void>;
  /** This phone's upload of `session` was confirmed by the server: hold it, 0 reads. */
  applyFinished: (uid: string, session: WorkoutSessionDoc) => void;
  /** Sign-out. */
  clear: () => void;
}

type State = Omit<WorkoutsStore, "open" | "check" | "applyFinished" | "clear">;

const initialState = {
  uid: null,
  byPlan: null,
  loaded: [],
  ownFinished: [],
  storedRead: false,
  checking: false,
  waitOver: false,
  lastResult: null,
  lastError: null,
  lastOkAt: null,
  lastSeen: null,
  lastFullAt: null,
  readout: { reads: 0, log: [] }, // debug readout (Plans Store page)
};

type CheckRun = RunBase<WorkoutsCheckKind> & { planIds: string[]; seenAtStart: SyncStamp | null };

type Answer = {
  /** The full reload's baseline stamp; null for the other kinds, or when no session has a stamp. */
  baseline: SyncStamp | null;
  /** Each queried plan's newest N. */
  perPlan: WorkoutsByPlan;
  /** The change check's docs. */
  changed: WorkoutSessionDoc[];
  /** Debug readout: queries and docs, for the readout line. */
  queries: number;
  docs: number;
};

// ---------------------------------------------------------------------------
// Server and disk reads. No store access but the billed count.
// ---------------------------------------------------------------------------

/** Debug readout: a query bills its docs, and 1 when it returns none. */
const bill = (docs: number) =>
  useRecentWorkoutsStore.setState((s) => ({ billedReads: s.billedReads + Math.max(1, docs) }));

async function readPlans(uid: string, planIds: string[]): Promise<WorkoutsByPlan> {
  const answers = await Promise.all(
    planIds.map(async (planId) => {
      const sessions = await getPlanSessionsFromServer(uid, planId, WORKOUTS_PER_PLAN);
      bill(sessions.length);
      return [planId, sessions] as const;
    })
  );
  return Object.fromEntries(answers);
}

async function readFromServer(run: CheckRun): Promise<Answer> {
  let baseline: SyncStamp | null = null;
  let changed: WorkoutSessionDoc[] = [];
  let perPlan: WorkoutsByPlan;
  if (run.kind === "full") {
    // First, then the plans: see `workoutsLastSeenAfter`.
    baseline = await getNewestSessionStamp(run.uid);
    bill(baseline ? 1 : 0);
    perPlan = await readPlans(run.uid, run.planIds);
  } else if (run.kind === "change") {
    [changed, perPlan] = await Promise.all([
      getChangedSessions(run.uid, changeCheckAfter(run.seenAtStart)).then((docs) => {
        bill(docs.length);
        return docs;
      }),
      readPlans(run.uid, run.planIds),
    ]);
  } else {
    perPlan = await readPlans(run.uid, run.planIds);
  }
  const planDocs = Object.values(perPlan).reduce((sum, sessions) => sum + sessions.length, 0);
  const queries = run.planIds.length + (run.kind === "new plans" ? 0 : 1);
  return { baseline, perPlan, changed, queries, docs: planDocs + changed.length + (baseline ? 1 : 0) };
}

async function readStoredCopy(uid: string): Promise<HeldWorkouts | null> {
  try {
    const read = readStoredWorkouts(await AsyncStorage.getItem(WORKOUTS_STORAGE_KEY), uid, WORKOUTS_PER_PLAN);
    if (read.error) console.warn("Stored workouts discarded; will fetch:", read.error);
    return read.held;
  } catch (error) {
    console.warn("Stored workouts unreadable; will fetch:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// What the store becomes. Pure: state in, changes out.
// ---------------------------------------------------------------------------

/**
 * The run a trigger starts, or null to skip. Nothing while the plans store
 * holds nothing (`planIdsToHold`). A full reload when due, except inside the
 * skip window with something held (the 7-day schedule can wait 2 minutes).
 * Plans not loaded yet are read even inside the skip window.
 */
export function workoutsRunFor(
  state: Pick<State, "byPlan" | "loaded" | "lastFullAt" | "lastSeen">,
  planIds: string[] | null,
  skipped: boolean,
  fullRequested: boolean,
  now: number
): Omit<CheckRun, "uid" | "epoch" | "seq"> | null {
  if (planIds === null) return null;
  const seenAtStart = state.lastSeen;
  const held = state.byPlan !== null;
  const due = fullReloadDue({
    requested: fullRequested,
    hasStored: held,
    lastFullAt: state.lastFullAt,
    now,
    intervalMs: WORKOUTS_FULL_RELOAD_INTERVAL_MS,
  });
  if (due && (!skipped || !held)) return { kind: "full", planIds, seenAtStart };
  const loaded = new Set(state.loaded);
  const missing = planIds.filter((id) => !loaded.has(id));
  if (skipped) return missing.length > 0 ? { kind: "new plans", planIds: missing, seenAtStart } : null;
  return { kind: "change", planIds: missing, seenAtStart };
}

/** After a check's answer. The runner adds what every success sets. */
function stateAfterAnswer(state: State, run: CheckRun, answer: Answer, now: number): Partial<State> {
  const returned = [...Object.values(answer.perPlan).flat(), ...answer.changed];
  const ownFinished = stillOwnFinished(state.ownFinished, returned);
  const lastSeen = workoutsLastSeenAfter(run.kind, state.lastSeen, answer);
  if (run.kind === "full") {
    return {
      byPlan: fullReloadPlans(answer.perPlan, state.byPlan, state.ownFinished, WORKOUTS_PER_PLAN),
      loaded: run.planIds,
      ownFinished,
      lastSeen,
      lastFullAt: now,
    };
  }
  const withPlans = mergeIntoPlans(state.byPlan ?? {}, Object.values(answer.perPlan).flat(), WORKOUTS_PER_PLAN);
  // A plan never done answers no docs: it is still loaded, with an empty list.
  for (const planId of run.planIds) withPlans[planId] ??= [];
  return {
    byPlan: mergeIntoPlans(withPlans, answer.changed, WORKOUTS_PER_PLAN),
    loaded: [...new Set([...state.loaded, ...run.planIds])],
    ownFinished,
    lastSeen,
  };
}

// ---------------------------------------------------------------------------
// The store.
// ---------------------------------------------------------------------------

export const useRecentWorkoutsStore = create<WorkoutsStore>((set, get) => {
  const runner = createSyncRunner<WorkoutsStore, WorkoutsCheckKind, CheckRun, Answer>({
    get,
    set,
    initialState,
    waitMs: WORKOUTS_CHECK_WAIT_MS,
    skipMs: WORKOUTS_CHECK_SKIP_MS,
    readStored: readStoredCopy,
    holdsData: (s) => s.byPlan !== null,
    writeStored: async ({ uid, byPlan, loaded, ownFinished, lastSeen, lastFullAt }) => {
      if (uid === null) {
        await AsyncStorage.removeItem(WORKOUTS_STORAGE_KEY);
      } else if (byPlan !== null) {
        await AsyncStorage.setItem(
          WORKOUTS_STORAGE_KEY,
          serializeStoredWorkouts(uid, WORKOUTS_PER_PLAN, { byPlan, loaded, ownFinished, lastSeen, lastFullAt })
        );
      }
    },
    read: readFromServer,
    apply: stateAfterAnswer,
    describe: (answer) => `${answer.queries} queries, ${answer.docs} docs`,
    label: "recent workouts",
  });

  return {
    ...initialState,
    epoch: 0,
    billedReads: 0, // debug readout

    open: async (uid) => {
      await runner.open(uid);
      await get().check();
    },

    check: ({ force = false, full = false } = {}) =>
      runner.check({ force }, (state, skipped) => {
        const plans = usePlansStore.getState();
        const planIds = plans.uid === state.uid ? planIdsToHold(plans.plans) : null;
        return workoutsRunFor(state, planIds, skipped, full, Date.now());
      }),

    applyFinished: (uid, session) => {
      const state = get();
      // Nothing held: one workout is not the user's history (CLAUDE.md 2.4);
      // the next check loads it all.
      if (state.uid !== uid || state.byPlan === null) return;
      set({
        byPlan: mergeIntoPlans(state.byPlan, [session], WORKOUTS_PER_PLAN),
        ownFinished: [...new Set([...state.ownFinished, session.sessionId])],
      });
      runner.persist();
    },

    clear: runner.clear,
  };
});

// ---------------------------------------------------------------------------
// Following the plans store (PR #52 review).
// ---------------------------------------------------------------------------

/** The plan ids last acted on, so a plans store change that adds no id costs nothing. */
let followedIds = "";
let following: Promise<void> | null = null;

/**
 * Ids appeared that are not loaded: check now. Twice at most: the first may
 * join a check that started before the ids arrived and so did not read them.
 * Not a loop: a check that fails leaves the next trigger to try again.
 */
function followPlans() {
  const plans = usePlansStore.getState();
  const workouts = useRecentWorkoutsStore.getState();
  if (workouts.uid === null || plans.uid !== workouts.uid || !workouts.storedRead) return;
  const ids = planIdsToHold(plans.plans);
  const key = ids === null ? "" : `${workouts.uid}:${workouts.epoch}:${ids.join(",")}`;
  if (ids === null || key === followedIds || following) return;
  followedIds = key;
  const missing = () => {
    const { byPlan, loaded } = useRecentWorkoutsStore.getState();
    return byPlan === null || ids.some((id) => !loaded.includes(id));
  };
  if (!missing()) return;
  following = (async () => {
    await useRecentWorkoutsStore.getState().check();
    if (missing()) await useRecentWorkoutsStore.getState().check();
  })().finally(() => {
    following = null;
  });
}

usePlansStore.subscribe(followPlans);
// The workouts' stored copy may be read after the plans arrived.
useRecentWorkoutsStore.subscribe((state, previous) => {
  if (state.storedRead && !previous.storedRead) followPlans();
});
