import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAllWorkoutPlans, getChangedPlans, getPlanFromServer } from "../services/db/userDB";
import type { PlanStamp, WorkoutPlan } from "../types/workoutType";
import {
  PLANS_CHECK_WAIT_MS,
  changeCheckAfter,
  compareStamps,
  isFullReloadDue,
  lastSeenAfter,
  lastSeenAfterFullReload,
  mergeChanges,
  mergeFullReload,
  planRev,
  readStoredPlans,
  refusedPlanCameBack,
  serializeStoredPlans,
  type HeldPlans,
  shouldSkipCheck,
  withSavedPlan,
  withServerPlan,
} from "../utils/planSync";

/**
 * The signed-in user's plans on the phone (TICKET-070).
 *
 * Every plans reader goes through `useWorkoutPlans`, which reads this store.
 * The plans are saved to AsyncStorage, so a screen shows them at once and
 * offline, and a check runs behind it each time a plans screen opens (D4).
 *
 * A check is one server read, of one of two kinds:
 * - change (D3): only plans with `updatedAt` after `lastSeen`. Nothing
 *   changed costs 1 read, 0 docs.
 * - full (D5): every plan, replacing the stored copy.
 * Both reject offline (D11). Answers merge by D10, the higher `rev` wins
 * (TICKET-073); the merge rules are pure functions in `planSync.ts`.
 *
 * The stored copy changes only on what the server confirmed (D8): a check's
 * answer, a Save that resolved (`applySaved`), or the server's copy of a plan
 * whose Save it refused (`reloadRefused`). Sign-out clears it (D2).
 *
 * `epoch` counts clears. A check or a Save started under one epoch applies
 * only if it is still current when it lands, so a late answer for the user who
 * signed out cannot refill the store for the next one.
 */

/**
 * AsyncStorage key of the stored plans. ACCOUNT DATA: cleared on sign-out (D2).
 * One key, with the user id inside the value (`StoredPlans.uid`), not a key
 * per user: a missed clear would leave a per-user key on the phone for good;
 * here the next user's first check overwrites it, and it is never shown to
 * them meanwhile (`readStoredPlans`).
 */
export const PLANS_STORAGE_KEY = "workoutPlans";

export type PlansSource = "none" | "stored" | "server";

export type CheckKind = "full" | "change";

// Debug readout, for the Plans Store debug page (TICKET-070; kept, user 2026-11-06).
export type ReadoutEntry = {
  at: number;
  outcome: "read" | "skipped" | "joined" | "ok" | "failed" | "dropped" | "refused";
  kind?: CheckKind | "save read-back" | "refusal reload";
  detail?: string;
};

/**
 * What a refused save's reload found (TICKET-073 D7), kept apart (CLAUDE.md
 * 2.4): the plan as the server now has it; the plan gone from the server; or
 * no answer (offline, a failed read), where the caller keeps what it has.
 */
export type RefusalReload = { kind: "reloaded"; plan: WorkoutPlan } | { kind: "gone" } | { kind: "failed" };

interface PlansStore {
  uid: string | null;
  /** Null: nothing stored for `uid` (D11). `[]`: stored, no plans. */
  plans: WorkoutPlan[] | null;
  source: PlansSource;
  storedRead: boolean;
  checking: boolean;
  waitOver: boolean;
  lastResult: "ok" | "failed" | null;
  lastError: string | null;
  /** When a check last succeeded. Memory only (D4): every app start checks. */
  lastOkAt: number | null;
  /**
   * The newest `updatedAt` the server has returned (D3), the server's clock;
   * null: none yet (`changeCheckAfter`). Stored with the plans.
   */
  lastSeen: PlanStamp | null;
  /** When the last full reload answered, the phone's clock (D5). Stored with the plans. */
  lastFullAt: number | null;
  epoch: number;
  // Debug readout (Plans Store page). Server reads issued this app run, and the last few checks.
  readout: { reads: number; log: ReadoutEntry[] };

  /** A plans screen opened: load the stored copy for `uid`, then check unless `check` is false. */
  open: (uid: string, options?: { check?: boolean }) => Promise<void>;
  /**
   * Ask the server now unless skipped (D4) or one is running (D9). `force`:
   * past the 2-minute skip (Try again, Reload, opening a plan in Manage); it
   * also starts a fresh read when the running one is past its wait. `full`:
   * a full reload (Try again, Reload); otherwise D5 decides.
   */
  check: (options?: { force?: boolean; full?: boolean }) => Promise<void>;
  /**
   * A Save of `plan`, started under `epoch`, was confirmed by the server
   * (D8). Reads its stamp back before it goes into the store.
   */
  applySaved: (uid: string, epoch: number, plan: WorkoutPlan) => Promise<void>;
  /**
   * The server refused a Save of `planId` at `sentRev`, started under
   * `epoch`: another device saved it since (TICKET-073 D7). Reloads that
   * plan at once, so the phone does not keep an old `rev` that refuses every
   * later Save. `late`: the refusal landed from the offline queue (the
   * readout says so; the caller shows nothing).
   */
  reloadRefused: (uid: string, epoch: number, planId: string, sentRev: number, late: boolean) => Promise<RefusalReload>;
  /** Sign-out (D2), or another user opened a plans screen. */
  clear: () => void;
}

type State = Omit<PlansStore, "open" | "check" | "applySaved" | "reloadRefused" | "clear">;

const initialState = {
  uid: null,
  plans: null,
  source: "none" as PlansSource,
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

// ---------------------------------------------------------------------------
// Module state. Not in the store: nothing renders from it.
// ---------------------------------------------------------------------------

/** The running check, joined by any trigger while it runs (D9). */
let checkInFlight: Promise<void> | null = null;

/** The stored copy being read for the current user. */
let storedLoad: Promise<void> | null = null;

/**
 * AsyncStorage writes run one after another, each writing the state as it is
 * when its turn comes. So an older write cannot land last: the last write in
 * the chain always holds the latest state.
 */
let persistChain: Promise<void> = Promise.resolve();

/**
 * Checks started, and the newest one whose answer was applied. A forced check
 * can start while a stalled one still runs (`check`); if the stalled one
 * answers last, its plans are older and are dropped. Kept beside D10's merge
 * because it also covers plans with no stamp, which D10 cannot order.
 * (Stage 1's `savesApplied`, which dropped any answer older than a Save, went:
 * D10 covers that case, `usePlansStore.test.ts`.)
 */
let checksStarted = 0;
let newestApplied = 0;

/** One check, from start to answer. */
type CheckRun = { uid: string; epoch: number; seq: number; kind: CheckKind; seenAtStart: PlanStamp | null };

// ---------------------------------------------------------------------------
// Server and disk reads. No store access.
// ---------------------------------------------------------------------------

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * The server read for a check. `async` so that even a call that throws at
 * once becomes a rejection, and the check reports it as failed.
 */
async function readFromServer(run: CheckRun): Promise<WorkoutPlan[]> {
  if (run.kind === "full") return getAllWorkoutPlans(run.uid);
  return getChangedPlans(run.uid, changeCheckAfter(run.seenAtStart));
}

/** The stored copy for `uid`, or null for "nothing stored" (D11): absent, unreadable or not this user's. */
async function readStoredCopy(uid: string): Promise<HeldPlans | null> {
  try {
    const read = readStoredPlans(await AsyncStorage.getItem(PLANS_STORAGE_KEY), uid);
    if (read.error) console.warn("Stored plans discarded; will fetch:", read.error);
    return read.held;
  } catch (error) {
    console.warn("Stored plans unreadable; will fetch:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// What the store becomes after each event. Pure: state in, changes out.
// ---------------------------------------------------------------------------

/** Which kind of check runs now (D5). */
function checkKindNow(state: State, fullRequested: boolean): CheckKind {
  const due = isFullReloadDue({
    requested: fullRequested,
    hasStored: state.plans !== null,
    lastFullAt: state.lastFullAt,
    now: Date.now(),
  });
  return due ? "full" : "change";
}

/**
 * After a check's answer (D3, D5). D10 is in both merges: a Save that landed
 * while the read was out is newer than anything the read returned, so it
 * stays. A full reload resets `lastSeen` from what it now holds
 * (`lastSeenAfterFullReload`); a change check only moves it forward.
 */
function stateAfterAnswer(state: State, run: CheckRun, docs: WorkoutPlan[]): Partial<State> {
  const now = Date.now();
  if (run.kind === "full") {
    const plans = mergeFullReload(state.plans, docs, run.seenAtStart);
    return { ...answered(now), plans, lastSeen: lastSeenAfterFullReload(plans), lastFullAt: now };
  }
  return { ...answered(now), plans: mergeChanges(state.plans ?? [], docs), lastSeen: lastSeenAfter(state.lastSeen, docs) };
}

/** What every successful check sets, whatever its kind. */
function answered(now: number): Partial<State> {
  return {
    source: "server",
    lastResult: "ok",
    lastError: null,
    lastOkAt: now,
  };
}

/**
 * After a Save's read-back (`applySaved`). `docs` is what the read-back
 * returned, null if it failed; `after` is where it started.
 *
 * The saved plan is confirmed if the read-back returned it, or if a check
 * that answered meanwhile already holds it stamped after `after`. Otherwise
 * it goes in as saved, unstamped, and the 2-minute skip is lifted so the
 * next screen checks and stamps it.
 */
function stateAfterSave(state: State, plan: WorkoutPlan, docs: WorkoutPlan[] | null, after: PlanStamp): Partial<State> {
  const plans = docs ? mergeChanges(state.plans ?? [], docs) : state.plans;
  const lastSeen = docs ? lastSeenAfter(state.lastSeen, docs) : state.lastSeen;

  const returned = docs?.some((p) => p.id === plan.id) ?? false;
  const held = plans?.find((p) => p.id === plan.id);
  const heldStamped = held !== undefined && compareStamps(held.updatedAt, after) > 0;

  if (returned || heldStamped) return { plans, lastSeen };
  return { plans: withSavedPlan(plans, plan), lastSeen, lastOkAt: null };
}

// ---------------------------------------------------------------------------
// The store.
// ---------------------------------------------------------------------------

export const usePlansStore = create<PlansStore>((set, get) => {
  // Debug readout (Plans Store page): logs each check and counts server reads.
  const note = (outcome: ReadoutEntry["outcome"], kind?: ReadoutEntry["kind"], detail?: string) =>
    set((s) => ({
      readout: {
        reads: s.readout.reads + (outcome === "read" ? 1 : 0),
        log: [{ at: Date.now(), outcome, kind, detail }, ...s.readout.log].slice(0, 20),
      },
    }));

  /** Is work started under `epoch` still for the signed-in user (D2)? */
  const isCurrent = (epoch: number) => get().epoch === epoch;

  /** Queue a write of the state as it is when the write's turn comes. */
  const persist = () => {
    persistChain = persistChain
      .then(async () => {
        const { uid, plans, lastSeen, lastFullAt } = get();
        if (uid === null) {
          await AsyncStorage.removeItem(PLANS_STORAGE_KEY);
        } else if (plans !== null) {
          await AsyncStorage.setItem(PLANS_STORAGE_KEY, serializeStoredPlans(uid, { plans, lastSeen, lastFullAt }));
        }
      })
      .catch((error) => console.warn("Could not store plans:", error));
  };

  const loadStored = async (uid: string, epoch: number) => {
    const held = await readStoredCopy(uid);
    if (!isCurrent(epoch)) return;
    // A check that answered first (network beat the disk) wins. `open` waits
    // for this before it checks, so that is only a Try again tapped first,
    // and Try again shows only after this has run.
    set((s) => (s.plans === null && held !== null ? { ...held, source: "stored", storedRead: true } : { storedRead: true }));
  };

  // --- One check: start, answer, failure --------------------------------

  const onAnswer = (run: CheckRun, docs: WorkoutPlan[]) => {
    if (!isCurrent(run.epoch)) return;
    if (run.seq < newestApplied) {
      note("dropped", run.kind, "answer older than a newer check's");
      return;
    }
    newestApplied = run.seq;
    set((s) => stateAfterAnswer(s, run, docs));
    note("ok", run.kind, `${docs.length} docs`);
    persist();
  };

  const onFailure = (run: CheckRun, error: unknown) => {
    if (!isCurrent(run.epoch)) return;
    // A read superseded by a forced one: its failure says nothing about the
    // read now running, which owns the result.
    if (run.seq < checksStarted) {
      note("dropped", run.kind, "failed after a newer check started");
      return;
    }
    // D11: a failure moves nothing but these two fields; the stored copy,
    // `lastSeen`, the 2-minute skip and the full-reload time stay as they were.
    const message = errorMessage(error);
    set({ lastResult: "failed", lastError: message });
    note("failed", run.kind, message);
  };

  const startCheck = (run: CheckRun): Promise<void> => {
    set({ checking: true, waitOver: false });

    const running: Promise<void> = readFromServer(run)
      .then((docs) => onAnswer(run, docs))
      .catch((error) => onFailure(run, error))
      .finally(() => {
        clearTimeout(waitTimer);
        if (checkInFlight === running) {
          checkInFlight = null;
          set({ checking: false, waitOver: false });
        }
      });

    // D9: the wait is bounded for the screen, not for the read. Past it, a
    // screen with nothing stored shows "Couldn't load plans", and the answer
    // still applies when it arrives.
    const waitTimer = setTimeout(() => {
      if (checkInFlight === running) set({ waitOver: true });
    }, PLANS_CHECK_WAIT_MS);

    checkInFlight = running;
    return running;
  };

  // --- A Save's read-back ----------------------------------------------

  /**
   * `setDoc` does not return the `serverTimestamp()` it wrote, and D10 needs
   * it: without it a check that started before this Save could put the old
   * version back. So the stamp is read back with a change query from
   * `lastSeen`, the same 1 read a check costs, which also brings any other
   * plan changed since and moves `lastSeen` past this Save: the next check
   * returns 0 docs, not this plan again. Rejected: leaving the plan unstamped
   * until the next check (no extra read, but nothing would order it against
   * a slow check's answer); a read of the one doc (the same 1 read, and
   * `lastSeen` could not move, so the next check would return it). Not joined
   * with a running check (D9): that read may predate the Save.
   *
   * Null if it fails: the plan then goes in unstamped (`stateAfterSave`).
   * Until the next check a slow check could put the old version back:
   * accepted, it needs a failure straight after a successful write.
   */
  const readBackSave = async (uid: string, after: PlanStamp): Promise<WorkoutPlan[] | null> => {
    note("read", "save read-back");
    try {
      const docs = await getChangedPlans(uid, after);
      note("ok", "save read-back", `${docs.length} docs`);
      return docs;
    } catch (error) {
      note("failed", "save read-back", errorMessage(error));
      return null;
    }
  };

  return {
    ...initialState,
    epoch: 0,

    open: async (uid, { check = true } = {}) => {
      if (get().uid !== uid) {
        if (get().uid !== null) get().clear();
        set({ uid });
        storedLoad = loadStored(uid, get().epoch);
      }
      await storedLoad;
      if (check) await get().check();
    },

    check: ({ force = false, full = false } = {}) => {
      const state = get();
      if (state.uid === null) return Promise.resolve();

      // D9: a trigger joins the running check. Except Try again on a check
      // past its wait: the screen already says "Couldn't load plans", and
      // joining a stalled read would make the tap do nothing (PR #48 review).
      // The stalled read is left to land; `newestApplied` drops it if late.
      const restartStalled = force && state.waitOver;
      if (checkInFlight && !restartStalled) {
        note("joined");
        return checkInFlight;
      }

      if (shouldSkipCheck(state.lastOkAt, Date.now(), force)) {
        note("skipped");
        return Promise.resolve();
      }

      const run: CheckRun = {
        uid: state.uid,
        epoch: state.epoch,
        seq: ++checksStarted,
        kind: checkKindNow(state, full),
        seenAtStart: state.lastSeen,
      };
      note("read", run.kind, force ? "forced" : undefined);
      return startCheck(run);
    },

    applySaved: async (uid, epoch, plan) => {
      const state = get();
      if (!isCurrent(epoch) || state.uid !== uid) return;
      // Nothing stored: one plan is not the user's plans (`withSavedPlan`).
      if (state.plans === null) return;

      const after = changeCheckAfter(state.lastSeen);
      const docs = await readBackSave(uid, after);
      if (!isCurrent(epoch)) return;

      set((s) => stateAfterSave(s, plan, docs, after));
      persist();
    },

    /**
     * A forced change check first (D7, recommended in TICKET-073): 1 read,
     * nothing downloaded beyond what changed, it moves `lastSeen`, and Manage
     * already runs one on opening a plan. Forced, so the 2-minute skip cannot
     * swallow it; a check already running is joined (D9), and if it started
     * too early to see the other device's Save, the read below catches it.
     * The plan did not come back at a newer `rev` (`refusedPlanCameBack`):
     * read that one plan and take the server's copy whatever D10 says
     * (`withServerPlan`). `lastSeen` is not moved by that read: it saw one
     * plan, not every change before its stamp; the next change check returns
     * the plan once more.
     */
    reloadRefused: async (uid, epoch, planId, sentRev, late) => {
      if (!isCurrent(epoch) || get().uid !== uid) return { kind: "failed" };
      note("refused", undefined, `plan ${planId} at rev ${sentRev}${late ? ", late from the queue" : ""}`);

      await get().check({ force: true });
      if (!isCurrent(epoch)) return { kind: "failed" };
      const held = get().plans?.find((p) => p.id === planId);
      if (held && refusedPlanCameBack(held, sentRev)) {
        note("ok", "refusal reload", `by the check, rev ${planRev(held)}`);
        return { kind: "reloaded", plan: held };
      }

      note("read", "refusal reload", "one plan");
      try {
        const plan = await getPlanFromServer(uid, planId);
        if (!isCurrent(epoch)) return { kind: "failed" };
        set((s) => ({ plans: withServerPlan(s.plans, planId, plan) }));
        persist();
        const gone = plan === null || plan.deleted === true;
        note("ok", "refusal reload", gone ? "plan gone from the server" : `by reading it, rev ${planRev(plan)}`);
        return gone ? { kind: "gone" } : { kind: "reloaded", plan };
      } catch (error) {
        note("failed", "refusal reload", errorMessage(error));
        return { kind: "failed" };
      }
    },

    clear: () => {
      checkInFlight = null;
      storedLoad = null;
      // Debug readout: `readout` counts the whole app run, so it survives a clear.
      set((s) => ({ ...initialState, epoch: s.epoch + 1, readout: s.readout }));
      persist();
    },
  };
});
