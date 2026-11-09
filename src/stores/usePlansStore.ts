import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAllWorkoutPlans, getChangedPlans, getPlanFromServer } from "../services/db/userDB";
import type { PlanStamp, PlanVersion, WorkoutPlan } from "../types/workoutType";
import {
  changeCheckAfter,
  compareStamps,
  isFullReloadDue,
  lastSeenAfter,
  lastSeenAfterFullReload,
  mergeChanges,
  plansFromFullReload,
  readStoredPlans,
  serializeStoredPlans,
  type HeldPlans,
  withSavedPlan,
  withServerPlan,
} from "../utils/planSync";
import { versionRev } from "../utils/planVersion";
import { createSyncRunner, type CheckRun as RunBase, type ReadoutEntry as SyncReadoutEntry, type SyncFields } from "./syncRunner";
import { PLANS_CHECK_SKIP_MS, PLANS_CHECK_WAIT_MS } from "../config/sync";
import { PLANS_STORAGE_KEY } from "../config/storageKeys";

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
 * - full (D5): every plan, replacing the stored copy. Only with nothing held
 *   or when asked for, never on a timer (`fullReloadDue`).
 * Both reject offline (D11). A change check's answer merges by D10, the
 * higher `rev` wins (TICKET-073); the rules are pure functions in `planSync.ts`.
 *
 * The stored copy changes only on what the server confirmed (D8): a check's
 * answer, a Save that resolved (`applySaved`), or the server's copy of a plan
 * whose Save it refused (`reloadRefused`). Sign-out clears it (D2).
 *
 * `epoch` counts clears. A check or a Save started under one epoch applies
 * only if it is still current when it lands, so a late answer for the user who
 * signed out cannot refill the store for the next one.
 *
 * The check machinery (stored load, join, wait, skip, `epoch`, the write
 * chain, the readout) is the shared sync runner, `syncRunner.ts`
 * (TICKET-075); this file keeps what is the plans' own.
 */

// PLANS_STORAGE_KEY: value and reason in src/config/storageKeys.ts.

export type PlansSource = "none" | "stored" | "server";

export type CheckKind = "full" | "change";

// Debug readout, for the Plans Store debug page (TICKET-070; kept, user 2026-11-06).
type ReadoutKind = CheckKind | "save read-back" | "refusal reload";
export type ReadoutEntry = SyncReadoutEntry<ReadoutKind>;

/**
 * What a refused save's reload found (TICKET-073 D7), kept apart (CLAUDE.md
 * 2.4): the plan as the server now has it; the plan gone from the server; or
 * no answer (offline, a failed read), where the caller keeps what it has.
 */
export type RefusalReload = { kind: "reloaded"; plan: WorkoutPlan } | { kind: "gone" } | { kind: "failed" };

interface PlansStore extends SyncFields<ReadoutKind> {
  /** Null: nothing stored for `uid` (D11). `[]`: stored, no plans. */
  plans: WorkoutPlan[] | null;
  source: PlansSource;
  /**
   * The newest `updatedAt` the server has returned (D3), the server's clock;
   * null: none yet (`changeCheckAfter`). Stored with the plans.
   */
  lastSeen: PlanStamp | null;
  /** When the last full reload answered, the phone's clock. Debug page only; stored with the plans. */
  lastFullAt: number | null;

  /** A plans screen opened: load the stored copy for `uid`, then check unless `check` is false. */
  open: (uid: string, options?: { check?: boolean }) => Promise<void>;
  /**
   * Ask the server now unless skipped (D4) or one is running (D9). `force`:
   * past the check skip (Try again, Reload, opening a plan in Manage); it
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
   * The server refused a Save of `planId` as version `sent`, started under
   * `epoch`: another device saved it since (TICKET-073 D7). Reloads that
   * plan at once, so the phone does not keep an old version that refuses
   * every later Save. `late`: the refusal landed from the offline queue (the
   * readout says so; the caller shows nothing).
   */
  reloadRefused: (uid: string, epoch: number, planId: string, sent: PlanVersion, late: boolean) => Promise<RefusalReload>;
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

/** One check, from start to answer. */
type CheckRun = RunBase<CheckKind> & { seenAtStart: PlanStamp | null };

// ---------------------------------------------------------------------------
// Server and disk reads. No store access.
// ---------------------------------------------------------------------------

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The server read for a check. */
function readFromServer(run: CheckRun): Promise<WorkoutPlan[]> {
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
  return isFullReloadDue({ requested: fullRequested, hasStored: state.plans !== null }) ? "full" : "change";
}

/**
 * After a check's answer (D3, D5). A change check merges by D10: a Save that
 * landed while the read was out is newer than anything the read returned, so
 * it stays, and `lastSeen` only moves forward. A full reload takes the
 * server's list (`plansFromFullReload`) and resets `lastSeen` from it
 * (`lastSeenAfterFullReload`). The runner adds what every success sets
 * (`lastResult`, `lastOkAt`).
 */
function stateAfterAnswer(state: State, run: CheckRun, docs: WorkoutPlan[], now: number): Partial<State> {
  if (run.kind === "full") {
    const plans = plansFromFullReload(docs);
    return { source: "server", plans, lastSeen: lastSeenAfterFullReload(plans), lastFullAt: now };
  }
  return { source: "server", plans: mergeChanges(state.plans ?? [], docs), lastSeen: lastSeenAfter(state.lastSeen, docs) };
}

/**
 * After a Save's read-back (`applySaved`). `docs` is what the read-back
 * returned, null if it failed; `after` is where it started.
 *
 * The saved plan is confirmed if the read-back returned it, or if a check
 * that answered meanwhile already holds it stamped after `after`. Otherwise
 * it goes in as saved, unstamped, and the check skip is lifted so the
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
  const runner = createSyncRunner<PlansStore, ReadoutKind, CheckRun, WorkoutPlan[]>({
    get,
    set,
    initialState,
    waitMs: PLANS_CHECK_WAIT_MS,
    skipMs: PLANS_CHECK_SKIP_MS,
    readStored: async (uid) => {
      const held = await readStoredCopy(uid);
      return held === null ? null : { ...held, source: "stored" };
    },
    holdsData: (s) => s.plans !== null,
    writeStored: async ({ uid, plans, lastSeen, lastFullAt }) => {
      if (uid === null) {
        await AsyncStorage.removeItem(PLANS_STORAGE_KEY);
      } else if (plans !== null) {
        await AsyncStorage.setItem(PLANS_STORAGE_KEY, serializeStoredPlans(uid, { plans, lastSeen, lastFullAt }));
      }
    },
    read: readFromServer,
    apply: stateAfterAnswer,
    describe: (docs) => `${docs.length} docs`,
    label: "plans",
  });
  const { note, isCurrent, persist } = runner;

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
      await runner.open(uid);
      if (check) await get().check();
    },

    check: ({ force = false, full = false } = {}) =>
      runner.check({ force }, (state, skipped) =>
        skipped ? null : { kind: checkKindNow(state, full), seenAtStart: state.lastSeen }
      ),

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
     * That one plan, read from the server (D7) and taken whatever D10 says
     * (`withServerPlan`): a direct read of one document is the only answer
     * that is certainly the server's current copy, whatever the stamps,
     * `lastSeen` or a check already running say. 1 read. `lastSeen` is not
     * moved: the read saw one plan, not every change before its stamp; the
     * next change check returns the plan once more.
     *
     * Deviation from D7 as written ("a forced change check, then this read if
     * the check did not bring the plan"), user 2026-11-07, after the device
     * run. A check usually brings the plan (every app Save moves `updatedAt`),
     * but misses it when it joins a check started before the other device's
     * Save (D9), when a Save of the plan is still queued here (the queued write
     * fails the stamp filter), or after edits outside the app; and the guess
     * "did it come back?" was wrong on the device for a Save chained on a
     * refused one. The read alone covers all of these, costs 1 read instead
     * of 2, and other plans are refreshed by the check every screen runs.
     * A read answered while another Save of the plan is still queued is
     * rejected (`serverOnly`, in userDB) and returns "failed"; that queued
     * Save's own refusal reloads.
     */
    reloadRefused: async (uid, epoch, planId, sent, late) => {
      if (!isCurrent(epoch) || get().uid !== uid) return { kind: "failed" };
      note("refused", undefined, `plan ${planId} at rev ${sent.rev}${late ? ", late from the queue" : ""}`);
      note("read", "refusal reload", "one plan");
      try {
        const plan = await getPlanFromServer(uid, planId);
        if (!isCurrent(epoch)) return { kind: "failed" };
        set((s) => ({ plans: withServerPlan(s.plans, planId, plan) }));
        persist();
        const gone = plan === null || plan.deleted === true;
        note("ok", "refusal reload", gone ? "plan gone from the server" : `by reading it, rev ${versionRev(plan)}`);
        return gone ? { kind: "gone" } : { kind: "reloaded", plan };
      } catch (error) {
        note("failed", "refusal reload", errorMessage(error));
        return { kind: "failed" };
      }
    },

    clear: runner.clear,
  };
});
