import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getChangedSessions,
  getLastWorkoutOfPlan,
  getNewestSessionStamp,
  getOlderWorkoutsPage,
  getSessionsOfExercisePage,
  getWorkoutById,
  getWorkoutWindowFromServer,
} from "../services/db/workoutSessions";
import type { WorkoutSessionDoc } from "../types/workoutSession";
import { changeCheckAfter, fullReloadDue, type SyncStamp } from "../utils/syncCore";
import {
  addToWindow,
  compareSessions,
  lastSeenAfterCheck,
  lookUpPlanIds,
  plansToLookUp,
  readStoredWorkouts,
  removeFromWindow,
  serializeStoredWorkouts,
  shardKeysNamedBy,
  windowFromFirstLoad,
  withPlanLookups,
  type WorkoutWindow,
} from "../utils/workoutWindow";
import { createSyncRunner, type CheckRun as RunBase, type ReadoutEntry as SyncReadoutEntry, type SyncFields } from "./syncRunner";
import { usePlansStore } from "./usePlansStore";
import { WORKOUTS_CHECK_SKIP_MS, WORKOUTS_CHECK_WAIT_MS, WORKOUTS_OLDER_RETRY_GAP_MS, WORKOUTS_ON_PHONE_MIN } from "../config/sync";
import { EXERCISE_LOG_PAGE_SIZE, OLDER_WORKOUTS_PAGE_SIZE } from "../config/display";
import { WORKOUTS_STORAGE_KEY } from "../config/storageKeys";
import { createOnDemandReads, type OnDemandState } from "./onDemandReads";

/**
 * The signed-in user's workouts on the phone (TICKET-082, replacing TICKET-075's
 * newest 5 per plan): the window, the newest whole months of workouts until at
 * least `WORKOUTS_ON_PHONE_MIN`, and the floor, the newest workout of every plan
 * (rules and reasons: `utils/workoutWindow.ts`). One shared copy for the hub,
 * Start, Manage and the mid-workout picker, which read `useRecentWorkouts`, and
 * for the History screens, which will read the window. Saved to AsyncStorage, one
 * key per UTC start month and a head key, so the dates show at once and offline.
 *
 * A check is one of two kinds (the merge and `lastSeen` rules are pure functions
 * in `workoutWindow.ts`):
 * - full: a baseline read (the newest stamp, 1 read), then the window's two
 *   queries, then one limit-1 query for each plan that has no workout in the window
 *   (the floor). Replaces what is held, so a session deleted on the server goes. On
 *   the first load, when nothing saved reads back, and when asked for; never on a
 *   timer (`fullReloadDue`). All or nothing: one failed query fails the check.
 * - change: sessions with `updatedAt > lastSeen`, any plan (1 read when nothing
 *   changed), plus a limit-1 query for each plan not looked up yet.
 * Inside the check skip nothing is read, unless a plan is not looked up yet: that
 * is looked up at once, because until then it reads "last session unknown".
 * Every read is from the server (`serverOnly` in workoutSessions.ts).
 *
 * Plans arriving later (PR #52's case, still true): the plan ids come from the plans
 * store, and on a first launch it may hold nothing when the first check runs, so the
 * window loads and the floor waits. `lookUpPlansWhenTheyArrive` checks once when
 * plan ids appear that are not looked up. It replaces `followPlans`, which tracked a
 * `loaded` list the floor makes unnecessary: a plan's state is in the window itself.
 *
 * Own Finish, 0 reads: `applyFinished` puts the uploaded session in unstamped
 * (ordering is by `startedAt`, so it needs no stamp) and it becomes its plan's
 * floor entry. `lastSeen` does not move, so the next change check returns it once
 * and the stamped copy replaces it. Known gap, accepted: a Finish uploaded while a
 * full reload's queries have already run is missing from that answer, and the
 * replace drops it until the next check, which returns it (its stamp is past the
 * baseline). Only when a Finish lands inside a first load or an explicit reload;
 * it costs a date shown as older for a few minutes, never a lost workout.
 *
 * The saved copy is written whole on every change (head and every shard), as the
 * exercise summaries are. Rejected for now: writing only the shards that changed,
 * which needs a record of what is on disk to stay right; TICKET-082's proof says
 * whether the whole write is slow enough to matter.
 *
 * Workouts older than the window are fetched by page on tap (`loadOlder`) and kept in memory only.
 *
 * Sign-out clears it (`initAuth`), as the plans store.
 */

/**
 * Workouts older than the window, loaded by page (TICKET-085a, decided in TICKET-088). Memory only, never
 * saved: gone at the next app start and at sign-out. One list per plan filter (`olderKey`): "All" and each
 * plan page on their own, because a page filtered to Push leaves holes in All.
 * - `windowStart`: the window's start when these were loaded. A trim moves it, and a list loaded before it
 *   is stale (its months and the window's would no longer meet), so it is read as empty (`olderOf`).
 * - `sessions`: newest first, every page so far. The next page starts before the oldest of them, or at
 *   `windowStart` for the first.
 * - `reachedStart`: a page came back short, so nothing older exists.
 * - `read`: the last ask, as `onDemandReads.ts` states it. `loading` carries `waitOver` once the read has
 *   outlasted `WORKOUTS_CHECK_WAIT_MS`: offline, Firestore takes 10 to 30 s to refuse (TICKET-082), so a
 *   screen says "needs a connection, still trying" from then. `offline`: refused for want of a connection;
 *   nothing was guessed from the empty cache. `failed`: any other rejection. Both can be asked again.
 */
export type OlderPage = { status: "ready"; sessions: WorkoutSessionDoc[]; reachedStart: boolean };
export type OlderWorkouts = {
  windowStart: number;
  sessions: WorkoutSessionDoc[];
  reachedStart: boolean;
  read: OnDemandState<OlderPage> | null;
};

/**
 * A workout opened by id that the phone does not hold (TICKET-083): `session` is null when the server has
 * none by that id, or only a `deleted` marker. Memory only, one entry per id, as `olderWorkouts`.
 */
export type FetchedSession = { status: "ready"; session: WorkoutSessionDoc | null };

const ALL_PLANS_KEY = "*";
export const olderKey = (planId: string | null): string => planId ?? ALL_PLANS_KEY;

/** The older workouts for a filter, or null when none were loaded under the window as it stands now. */
export function olderOf(
  olderWorkouts: Readonly<Record<string, OlderWorkouts>>,
  workoutWindow: Pick<WorkoutWindow, "windowStart"> | null,
  planId: string | null
): OlderWorkouts | null {
  const held = olderWorkouts[olderKey(planId)];
  return workoutWindow !== null && held !== undefined && held.windowStart === workoutWindow.windowStart ? held : null;
}

/**
 * A lift's sessions older than the window, loaded by page for the Exercise screen's log (TICKET-084 stage 3). Memory only,
 * one list per exercise id, in the shape of `OlderWorkouts` and under the same rule: a list loaded before the window moved
 * is read as not loaded.
 */
export function exerciseOlderOf(
  exerciseOlder: Readonly<Record<string, OlderWorkouts>>,
  workoutWindow: Pick<WorkoutWindow, "windowStart"> | null,
  exerciseId: string
): OlderWorkouts | null {
  const held = exerciseOlder[exerciseId];
  return workoutWindow !== null && held !== undefined && held.windowStart === workoutWindow.windowStart ? held : null;
}

/**
 * Where a lift's log stands past the window: whether anything older may exist, and where the next page starts.
 *
 * The History home's All list (`olderOf(.., null)`) is every workout from the window's start down to its oldest, so
 * everything of this lift in that stretch is in the log already: the next page starts below the lower of that list's edge
 * and this lift's own pages' edge, and a read there would otherwise fetch documents the phone holds. When the All list has
 * reached the first workout, or this lift's pages have, nothing is older.
 * `windowStart` null: the window holds the whole history, so there is no "past the window" at all.
 */
export function exercisePaging(
  windowStart: number | null,
  allOlder: Pick<OlderWorkouts, "sessions" | "reachedStart"> | null,
  own: Pick<OlderWorkouts, "sessions" | "reachedStart"> | null
): { reachedStart: boolean; before: number | null } {
  if (windowStart === null || allOlder?.reachedStart || own?.reachedStart) return { reachedStart: true, before: null };
  const edges = [windowStart, ...[allOlder, own].flatMap((list) => (list && list.sessions.length > 0 ? [list.sessions[list.sessions.length - 1].startedAt] : []))];
  return { reachedStart: false, before: Math.min(...edges) };
}

export type WorkoutsCheckKind = "full" | "change";
export type WorkoutsReadoutEntry = SyncReadoutEntry<WorkoutsCheckKind>;

interface WorkoutsStore extends SyncFields<WorkoutsCheckKind> {
  /** Null: nothing saved for `uid` and no answer yet. Readers then say "last session unknown". */
  workoutWindow: WorkoutWindow | null;
  /** The newest `updatedAt` a change check or baseline returned (server clock); null: none yet. */
  lastSeen: SyncStamp | null;
  /** When the last full reload answered (phone clock). Debug page only; nothing is scheduled on it. */
  lastFullAt: number | null;
  /** Debug readout: Firestore reads billed this app run (a query that returns nothing bills 1). */
  billedReads: number;
  /** Debug readout: how long the last save of the whole copy took, ms on this phone; null: none yet. */
  lastSaveMs: number | null;
  /** Workouts older than the window, by plan filter (`olderKey`). Memory only. */
  olderWorkouts: Record<string, OlderWorkouts>;
  /** Workouts opened by id that the phone did not hold, by session id (`loadSession`). Memory only. */
  fetchedSessions: Record<string, OnDemandState<FetchedSession>>;
  /** A lift's sessions older than the window, by exercise id (`loadOlderOfExercise`). Memory only. */
  exerciseOlder: Record<string, OlderWorkouts>;

  /** A reader opened: load the saved copy for `uid`, then check. */
  open: (uid: string) => Promise<void>;
  /** Ask the server now unless skipped or one is running. `force`: past the skip. `full`: a full reload. */
  check: (options?: { force?: boolean; full?: boolean }) => Promise<void>;
  /**
   * Read the next page of workouts older than the window, for one plan filter (null: all), into
   * `olderWorkouts`: `OLDER_WORKOUTS_PAGE_SIZE` workouts, 1 read each (a `deleted` marker is read and
   * skipped). Nothing when the window holds the whole history, when the start was reached, or while a read
   * is inside its wait; a refused read is asked again, not within `WORKOUTS_OLDER_RETRY_GAP_MS`.
   */
  loadOlder: (planId: string | null) => Promise<void>;
  /**
   * Read the next page of one lift's sessions older than the window (`EXERCISE_LOG_PAGE_SIZE`, 1 read each; a `deleted`
   * marker is read and skipped), into `exerciseOlder`. Nothing when the window holds the whole history, when the start was
   * reached (by this lift's pages, or by the History home's All list, which then already holds them), or while a read is
   * inside its wait; a refused read is asked again, not within `WORKOUTS_OLDER_RETRY_GAP_MS`.
   */
  loadOlderOfExercise: (exerciseId: string) => Promise<void>;
  /**
   * Read one workout by id, for a Session opened that is neither held nor queued: 1 read, answer kept in
   * `fetchedSessions`. Nothing when it is already read or inside its wait; a refused read is asked again,
   * not within `WORKOUTS_OLDER_RETRY_GAP_MS`.
   */
  loadSession: (sessionId: string) => Promise<void>;
  /** A note was saved on the server for `sessionId` (null: removed): show it in every copy this phone holds, 0 reads. */
  applyNote: (uid: string, sessionId: string, note: string | null) => void;
  /** `sessionId` was deleted on the server by this phone: remove it from every copy this phone holds, 0 reads. */
  applyDeleted: (uid: string, sessionId: string) => void;
  /** This phone's save of an edit committed this workout (TICKET-102): replace it in every copy held, 0 reads. */
  applyEdited: (uid: string, session: WorkoutSessionDoc) => void;
  /** This phone's upload of `session` was confirmed by the server: hold it, 0 reads. */
  applyFinished: (uid: string, session: WorkoutSessionDoc) => void;
  /** Sign-out. */
  clear: () => void;
}

type State = Omit<WorkoutsStore, "open" | "check" | "loadOlder" | "loadOlderOfExercise" | "loadSession" | "applyNote" | "applyDeleted" | "applyEdited" | "applyFinished" | "clear">;

const initialState = {
  uid: null,
  workoutWindow: null,
  storedRead: false,
  checking: false,
  waitOver: false,
  lastResult: null,
  lastError: null,
  lastOkAt: null,
  lastSeen: null,
  lastFullAt: null,
  olderWorkouts: {},
  exerciseOlder: {},
  fetchedSessions: {},
  lastSaveMs: null,
  readout: { reads: 0, log: [] }, // debug readout (Plans Store page)
};

type CheckRun = RunBase<WorkoutsCheckKind> & {
  /** The plans store's plan ids when the check started; null: it held none yet. */
  planIds: string[] | null;
  /** Plans to look up. Null for a full check: it knows only after the window's answer. */
  lookUp: string[] | null;
  seenAtStart: SyncStamp | null;
};

type Answer = {
  /** The full reload's baseline stamp; null for the other kind, or when no session has a stamp. */
  baseline: SyncStamp | null;
  /** A full reload's window; null for a change check. */
  firstLoad: WorkoutWindow | null;
  /** The change check's docs. */
  changed: WorkoutSessionDoc[];
  /** Each looked-up plan's newest workout, or null: never done. */
  lookups: Record<string, WorkoutSessionDoc | null>;
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

async function lookUpPlans(uid: string, planIds: readonly string[]): Promise<Record<string, WorkoutSessionDoc | null>> {
  const answers = await Promise.all(
    planIds.map(async (planId) => {
      const doc = await getLastWorkoutOfPlan(uid, planId);
      bill(doc ? 1 : 0);
      return [planId, doc] as const;
    })
  );
  return Object.fromEntries(answers);
}

async function readFromServer(run: CheckRun): Promise<Answer> {
  if (run.kind === "full") {
    // The baseline first, then the window: see `lastSeenAfterCheck`.
    const baseline = await getNewestSessionStamp(run.uid);
    bill(baseline ? 1 : 0);
    const { newest, rest } = await getWorkoutWindowFromServer(run.uid, WORKOUTS_ON_PHONE_MIN);
    bill(newest.length);
    if (rest !== null) bill(rest.length);
    const firstLoad = windowFromFirstLoad(newest, rest ?? [], WORKOUTS_ON_PHONE_MIN);
    const lookUp = run.planIds === null ? [] : plansToLookUp(firstLoad, run.planIds);
    const lookups = await lookUpPlans(run.uid, lookUp);
    return {
      baseline,
      firstLoad,
      changed: [],
      lookups,
      queries: 1 + (rest === null ? 1 : 2) + lookUp.length,
      docs: (baseline ? 1 : 0) + newest.length + (rest?.length ?? 0) + Object.values(lookups).filter(Boolean).length,
    };
  }
  const lookUp = run.lookUp ?? [];
  const [changed, lookups] = await Promise.all([
    getChangedSessions(run.uid, changeCheckAfter(run.seenAtStart)).then((docs) => {
      bill(docs.length);
      return docs;
    }),
    lookUpPlans(run.uid, lookUp),
  ]);
  return {
    baseline: null,
    firstLoad: null,
    changed,
    lookups,
    queries: 1 + lookUp.length,
    docs: changed.length + Object.values(lookups).filter(Boolean).length,
  };
}

/** The shard keys on disk as this run knows them, so a write removes exactly the ones it no longer needs. */
let keysOnDisk = new Set<string>();

async function readStoredCopy(uid: string) {
  try {
    const head = await AsyncStorage.getItem(WORKOUTS_STORAGE_KEY);
    const shardKeys = shardKeysNamedBy(head);
    const rows = shardKeys.length > 0 ? await AsyncStorage.multiGet(shardKeys) : [];
    const read = readStoredWorkouts([[WORKOUTS_STORAGE_KEY, head], ...rows], uid);
    if (read.error) console.warn("Stored workouts discarded; will fetch:", read.error);
    if (!read.saved) return null;
    keysOnDisk = new Set(shardKeys);
    const { lastSeen, lastFullAt, ...workoutWindow } = read.saved;
    return { workoutWindow, lastSeen, lastFullAt };
  } catch (error) {
    console.warn("Stored workouts unreadable; will fetch:", error);
    return null;
  }
}

/** Every key of the saved copy: the head and any key that starts with it and a dot (a shard). */
const isWorkoutsKey = (key: string) => key === WORKOUTS_STORAGE_KEY || key.startsWith(`${WORKOUTS_STORAGE_KEY}.`);

// ---------------------------------------------------------------------------
// What the store becomes. Pure: state in, changes out.
// ---------------------------------------------------------------------------

/**
 * The run a trigger starts, or null to skip. A full reload when due
 * (`fullReloadDue`): nothing held, or asked for, which always comes with
 * `force`, so no skip. It does not wait for the plans store: the window needs no
 * plan ids, and the floor looks up what the plans store names once it can.
 * Otherwise a change check, which also looks up the plans not looked up yet; one
 * of those is not skipped, as it reads "last session unknown" until looked up.
 */
export function workoutsRunFor(
  state: Pick<State, "workoutWindow" | "lastSeen">,
  planIds: string[] | null,
  skipped: boolean,
  fullRequested: boolean
): Omit<CheckRun, "uid" | "epoch" | "seq"> | null {
  const seenAtStart = state.lastSeen;
  if (fullReloadDue({ requested: fullRequested, hasStored: state.workoutWindow !== null }))
    return { kind: "full", planIds, lookUp: null, seenAtStart };
  const lookUp = planIds === null || state.workoutWindow === null ? [] : plansToLookUp(state.workoutWindow, planIds);
  if (skipped && lookUp.length === 0) return null;
  return { kind: "change", planIds, lookUp, seenAtStart };
}

/** After a check's answer. The runner adds what every success sets. */
function stateAfterAnswer(state: State, run: CheckRun, answer: Answer, now: number): Partial<State> {
  // A full reload starts from nothing, so a session deleted on the server goes.
  const base = answer.firstLoad ?? state.workoutWindow;
  if (base === null) return {};
  const merged = addToWindow(base, answer.changed, WORKOUTS_ON_PHONE_MIN);
  return {
    workoutWindow: withPlanLookups(merged, answer.lookups),
    lastSeen: lastSeenAfterCheck(run.kind, state.lastSeen, answer),
    ...(run.kind === "full" && { lastFullAt: now }),
  };
}

// ---------------------------------------------------------------------------
// The store.
// ---------------------------------------------------------------------------

/** The rules for a page asked for on tap: `onDemandReads.ts`. */
const askForOlder = createOnDemandReads<OlderPage>({
  waitMs: WORKOUTS_CHECK_WAIT_MS,
  retryGapMs: WORKOUTS_OLDER_RETRY_GAP_MS,
});

/** The same rules for a lift's pages (TICKET-084): a key per exercise, so two lifts paging at once do not join. */
const askForExerciseOlder = createOnDemandReads<OlderPage>({
  waitMs: WORKOUTS_CHECK_WAIT_MS,
  retryGapMs: WORKOUTS_OLDER_RETRY_GAP_MS,
});

/** `session` with its note set, or removed for null (the key is left out, never `undefined`: Firestore here rejects it). */
/**
 * `edited` in the place of the held copy of the same workout (TICKET-102). The held copy's `note` and stamp stay: the save
 * wrote neither the note nor a stamp the phone knows, so the same stamp replaces itself in the window (`addToWindow`) and
 * the next check brings the server's stamped copy back, one read.
 */
function withEdited(held: WorkoutSessionDoc, edited: WorkoutSessionDoc): WorkoutSessionDoc {
  const { note, updatedAt } = held;
  const { note: _dropped, updatedAt: _stamp, ...rest } = edited;
  return { ...rest, ...(note !== undefined ? { note } : {}), ...(updatedAt ? { updatedAt } : {}) };
}

function withNote(session: WorkoutSessionDoc, note: string | null): WorkoutSessionDoc {
  const { note: _old, ...rest } = session;
  return note === null ? rest : { ...rest, note };
}

/** The same rules for one workout by id (TICKET-083); a key per id, so two opened at once do not join. */
const askForSession = createOnDemandReads<FetchedSession>({
  waitMs: WORKOUTS_CHECK_WAIT_MS,
  retryGapMs: WORKOUTS_OLDER_RETRY_GAP_MS,
});

export const useRecentWorkoutsStore = create<WorkoutsStore>((set, get) => {
  const runner = createSyncRunner<WorkoutsStore, WorkoutsCheckKind, CheckRun, Answer>({
    get,
    set,
    initialState,
    waitMs: WORKOUTS_CHECK_WAIT_MS,
    skipMs: WORKOUTS_CHECK_SKIP_MS,
    readStored: readStoredCopy,
    writeStored: async ({ uid, workoutWindow, lastSeen, lastFullAt }) => {
      if (uid === null) {
        const keys = (await AsyncStorage.getAllKeys()).filter(isWorkoutsKey);
        keysOnDisk = new Set();
        if (keys.length > 0) await AsyncStorage.multiRemove(keys);
      } else if (workoutWindow !== null) {
        const entries = serializeStoredWorkouts(uid, { ...workoutWindow, lastSeen, lastFullAt });
        const shardKeys = new Set(entries.slice(1).map(([key]) => key));
        const stale = [...keysOnDisk].filter((key) => !shardKeys.has(key));
        keysOnDisk = shardKeys;
        // Both issued before anything is awaited, in this order: the new copy, then the shards it
        // no longer names. A kill between them leaves an orphan shard, which nothing reads and
        // the next sign-out removes.
        const startedAt = Date.now();
        const written = AsyncStorage.multiSet(entries);
        const removed = stale.length > 0 ? AsyncStorage.multiRemove(stale) : Promise.resolve();
        await Promise.all([written, removed]);
        useRecentWorkoutsStore.setState({ lastSaveMs: Date.now() - startedAt }); // debug readout
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
        const planIds = plans.uid === state.uid ? lookUpPlanIds(plans.plans) : null;
        const run = workoutsRunFor(state, planIds, skipped, full);
        if (run) idsOfLastCheck = idsKey(state.uid, state.epoch, planIds);
        return run;
      }),

    loadOlder: async (planId) => {
      const { uid, workoutWindow, olderWorkouts } = get();
      // Not knowing the window, nothing is known to be older than it; no start, the whole history is in it.
      if (uid === null || workoutWindow === null || workoutWindow.windowStart === null) return;
      const windowStart = workoutWindow.windowStart;
      const key = olderKey(planId);
      const held = olderOf(olderWorkouts, workoutWindow, planId);
      if (held?.reachedStart) return;
      const before = held && held.sessions.length > 0 ? held.sessions[held.sessions.length - 1].startedAt : windowStart;
      const epoch = get().epoch;
      return askForOlder(key, {
        current: held?.read ?? undefined,
        repeatable: true,
        setState: (read) =>
          set((s) => {
            // The window moved while the page was being read (a trim or a full reload): the page was asked from an edge that no
            // longer exists, and filing it under the old `windowStart` would only waste it. Dropped; the next tap reads from the new
            // edge (found in the review of PR #77, which fixed the same shape in `loadOlderOfExercise`).
            if (s.workoutWindow?.windowStart !== windowStart) return {};
            const base = olderOf(s.olderWorkouts, s.workoutWindow, planId) ?? { windowStart, sessions: [], reachedStart: false, read: null };
            const next: OlderWorkouts =
              read.status === "ready"
                ? {
                    ...base,
                    read,
                    reachedStart: read.reachedStart,
                    sessions: [...new Map([...base.sessions, ...read.sessions].map((session) => [session.sessionId, session])).values()].sort(compareSessions),
                  }
                : { ...base, read };
            return { olderWorkouts: { ...s.olderWorkouts, [key]: next } };
          }),
        isCurrent: () => runner.isCurrent(epoch),
        read: async () => {
          const { sessions, docsRead, reachedStart } = await getOlderWorkoutsPage(uid, before, planId, OLDER_WORKOUTS_PAGE_SIZE);
          bill(docsRead);
          return { status: "ready", sessions, reachedStart };
        },
      });
    },

    loadOlderOfExercise: async (exerciseId) => {
      const { uid, workoutWindow, olderWorkouts, exerciseOlder } = get();
      // Not knowing the window, nothing is known to be older than it.
      if (uid === null || workoutWindow === null) return;
      const held = exerciseOlderOf(exerciseOlder, workoutWindow, exerciseId);
      const { reachedStart, before } = exercisePaging(workoutWindow.windowStart, olderOf(olderWorkouts, workoutWindow, null), held);
      if (reachedStart || before === null) return;
      const windowStart = workoutWindow.windowStart as number;
      const epoch = get().epoch;
      return askForExerciseOlder(exerciseId, {
        current: held?.read ?? undefined,
        repeatable: true,
        setState: (read) =>
          set((s) => {
            // The window moved while the page was being read (a trim or a full reload): the page was asked from an edge that no
            // longer exists, and filing it under the old `windowStart` would only waste it. Dropped; the next tap reads from the new edge.
            if (s.workoutWindow?.windowStart !== windowStart) return {};
            const base = exerciseOlderOf(s.exerciseOlder, s.workoutWindow, exerciseId) ?? { windowStart, sessions: [], reachedStart: false, read: null };
            const next: OlderWorkouts =
              read.status === "ready"
                ? {
                    ...base,
                    read,
                    reachedStart: read.reachedStart,
                    sessions: [...new Map([...base.sessions, ...read.sessions].map((session) => [session.sessionId, session])).values()].sort(compareSessions),
                  }
                : { ...base, read };
            return { exerciseOlder: { ...s.exerciseOlder, [exerciseId]: next } };
          }),
        isCurrent: () => runner.isCurrent(epoch),
        read: async () => {
          const { sessions, docsRead, reachedStart: reached } = await getSessionsOfExercisePage(uid, exerciseId, before, EXERCISE_LOG_PAGE_SIZE);
          bill(docsRead);
          return { status: "ready", sessions, reachedStart: reached };
        },
      });
    },

    loadSession: async (sessionId) => {
      const { uid, fetchedSessions } = get();
      if (uid === null) return;
      const epoch = get().epoch;
      return askForSession(sessionId, {
        current: fetchedSessions[sessionId],
        setState: (read) => set((s) => ({ fetchedSessions: { ...s.fetchedSessions, [sessionId]: read } })),
        isCurrent: () => runner.isCurrent(epoch),
        read: async () => {
          const session = await getWorkoutById(uid, sessionId);
          bill(session ? 1 : 0);
          return { status: "ready", session };
        },
      });
    },

    applyNote: (uid, sessionId, note) => {
      const state = get();
      if (state.uid !== uid) return;
      const held = state.workoutWindow?.sessions.find((session) => session.sessionId === sessionId);
      set((s) => ({
        // The window by `addToWindow`: the same stamp replaces itself, and the plan's floor entry follows.
        workoutWindow: held && s.workoutWindow ? addToWindow(s.workoutWindow, [withNote(held, note)], WORKOUTS_ON_PHONE_MIN) : s.workoutWindow,
        olderWorkouts: Object.fromEntries(
          Object.entries(s.olderWorkouts).map(([key, older]) => [
            key,
            { ...older, sessions: older.sessions.map((session) => (session.sessionId === sessionId ? withNote(session, note) : session)) },
          ])
        ),
        exerciseOlder: Object.fromEntries(
          Object.entries(s.exerciseOlder).map(([key, older]) => [
            key,
            { ...older, sessions: older.sessions.map((session) => (session.sessionId === sessionId ? withNote(session, note) : session)) },
          ])
        ),
        fetchedSessions: Object.fromEntries(
          Object.entries(s.fetchedSessions).map(([key, read]) => [
            key,
            read.status === "ready" && read.session?.sessionId === sessionId ? { ...read, session: withNote(read.session, note) } : read,
          ])
        ),
      }));
      if (held) runner.persist();
    },

    applyEdited: (uid, edited) => {
      const state = get();
      if (state.uid !== uid) return;
      const held = state.workoutWindow?.sessions.find((session) => session.sessionId === edited.sessionId);
      const replaced = (list: OlderWorkouts): OlderWorkouts => ({
        ...list,
        sessions: list.sessions.map((session) => (session.sessionId === edited.sessionId ? withEdited(session, edited) : session)),
      });
      set((s) => ({
        workoutWindow: held && s.workoutWindow ? addToWindow(s.workoutWindow, [withEdited(held, edited)], WORKOUTS_ON_PHONE_MIN) : s.workoutWindow,
        olderWorkouts: Object.fromEntries(Object.entries(s.olderWorkouts).map(([key, older]) => [key, replaced(older)])),
        // Keyed by exercise: a lift the edit removed no longer has this workout among its sessions.
        exerciseOlder: Object.fromEntries(
          Object.entries(s.exerciseOlder).map(([key, older]) => [
            key,
            edited.exerciseIds.includes(key) ? replaced(older) : { ...older, sessions: older.sessions.filter((session) => session.sessionId !== edited.sessionId) },
          ])
        ),
        fetchedSessions: Object.fromEntries(
          Object.entries(s.fetchedSessions).map(([key, read]) => [
            key,
            read.status === "ready" && read.session?.sessionId === edited.sessionId ? { ...read, session: withEdited(read.session, edited) } : read,
          ])
        ),
      }));
      if (held) runner.persist();
    },

    applyDeleted: (uid, sessionId) => {
      const state = get();
      if (state.uid !== uid) return;
      const without = (list: OlderWorkouts): OlderWorkouts => ({ ...list, sessions: list.sessions.filter((session) => session.sessionId !== sessionId) });
      set((s) => ({
        workoutWindow: s.workoutWindow ? removeFromWindow(s.workoutWindow, sessionId, WORKOUTS_ON_PHONE_MIN) : s.workoutWindow,
        // The lists the user loaded past the window, and a lift's log: the same workout may be in several.
        olderWorkouts: Object.fromEntries(Object.entries(s.olderWorkouts).map(([key, older]) => [key, without(older)])),
        exerciseOlder: Object.fromEntries(Object.entries(s.exerciseOlder).map(([key, older]) => [key, without(older)])),
        // Read by id and found: now "no longer there", as a workout deleted on another phone reads.
        fetchedSessions: Object.fromEntries(
          Object.entries(s.fetchedSessions).map(([key, read]) => [key, read.status === "ready" && read.session?.sessionId === sessionId ? { ...read, session: null } : read])
        ),
      }));
      // The floor can change without the workout being held, so save whenever there is a window.
      if (state.workoutWindow) runner.persist();
    },

    applyFinished: (uid, session) => {
      const state = get();
      // Nothing held: one workout is not the user's history (CLAUDE.md 2.4);
      // the next check loads it all.
      if (state.uid !== uid || state.workoutWindow === null) return;
      set({ workoutWindow: addToWindow(state.workoutWindow, [session], WORKOUTS_ON_PHONE_MIN) });
      runner.persist();
    },

    clear: runner.clear,
  };
});

// ---------------------------------------------------------------------------
// Looking up plans when they arrive (PR #52's case).
// ---------------------------------------------------------------------------

/** The plan ids the last check that started was given, so only a change of ids triggers another. */
let idsOfLastCheck = "";

const idsKey = (uid: string | null, epoch: number, ids: string[] | null) => `${uid}:${epoch}:${ids === null ? "" : ids.join(",")}`;

/**
 * Plan ids appeared that the last check did not have, and some are not looked up: check now.
 * Once per set of ids, so a check that fails, or a lookup that cannot answer (a `deleted` marker
 * as a plan's newest), does not loop: the next trigger is a screen's focus. What it is for is the
 * check that ran before the plans arrived (first launch, sign-in). If a check is running, the
 * trigger joins it (`runner.check`), which did not have the new ids, so it runs again when that
 * check ends (the subscription below).
 */
function lookUpPlansWhenTheyArrive() {
  const plans = usePlansStore.getState();
  const workouts = useRecentWorkoutsStore.getState();
  if (workouts.uid === null || plans.uid !== workouts.uid || !workouts.storedRead) return;
  const ids = lookUpPlanIds(plans.plans);
  if (ids === null || idsKey(workouts.uid, workouts.epoch, ids) === idsOfLastCheck) return;
  if (workouts.workoutWindow === null || plansToLookUp(workouts.workoutWindow, ids).length > 0) void workouts.check();
}

usePlansStore.subscribe(lookUpPlansWhenTheyArrive);
// The saved copy may be read after the plans arrived, and a check that ended may have started without them.
useRecentWorkoutsStore.subscribe((state, previous) => {
  if ((state.storedRead && !previous.storedRead) || (previous.checking && !state.checking)) lookUpPlansWhenTheyArrive();
});
