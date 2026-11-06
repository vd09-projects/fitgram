import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAllWorkoutPlans } from "../services/db/userDB";
import type { WorkoutPlan } from "../types/workoutType";
import {
  PLANS_CHECK_WAIT_MS,
  readStoredPlans,
  serializeStoredPlans,
  shouldSkipCheck,
  withSavedPlan,
} from "../utils/planSync";

/**
 * The signed-in user's plans on the phone (TICKET-070 stage 1).
 *
 * Every plans reader goes through `useWorkoutPlans`, which reads this store
 * instead of holding its own copy. The plans are saved to AsyncStorage, so a
 * screen shows them at once and offline, and a check runs behind it each time
 * a plans screen opens (D4), skipped if one succeeded less than 2 minutes ago.
 * In stage 1 a check is a full read with `getDocsFromServer`, which rejects
 * offline instead of answering from Firestore's memory cache (D11).
 *
 * The stored copy changes only on what the server confirmed (D8): a check's
 * answer, or a Save that resolved (`applySaved`). Sign-out clears it (D2).
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

// TEMPORARY (TICKET-070 debug page, CLAUDE.md 3.3). Remove with PlansStoreDebugScreen.
export type ReadoutEntry = { at: number; outcome: "read" | "skipped" | "joined" | "ok" | "failed"; detail?: string };

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
  epoch: number;
  // TEMPORARY (TICKET-070 debug page). Server reads issued this app run, and the last few checks.
  readout: { reads: number; log: ReadoutEntry[] };

  /** A plans screen opened: load the stored copy for `uid`, then check unless `check` is false. */
  open: (uid: string, options?: { check?: boolean }) => Promise<void>;
  /** Read the plans now unless skipped (D4) or one is running (D9). `force`: Try again, Reload. */
  check: (options?: { force?: boolean }) => Promise<void>;
  /** A Save of `plan`, started under `epoch`, was confirmed by the server (D8). */
  applySaved: (uid: string, epoch: number, plan: WorkoutPlan) => void;
  /** Sign-out (D2), or another user opened a plans screen. */
  clear: () => void;
}

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
 * Saves applied so far. A check whose read started before a Save landed may
 * hold the plan as it was before it: its answer is dropped and does not count
 * as a success, so the next screen checks again. Stage 1 only; stage 2's
 * newer-`updatedAt` merge (D10) replaces this.
 */
let savesApplied = 0;

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
  readout: { reads: 0, log: [] }, // TEMPORARY (TICKET-070 debug page)
};

export const usePlansStore = create<PlansStore>((set, get) => {
  // TEMPORARY (TICKET-070 debug page).
  const note = (outcome: ReadoutEntry["outcome"], detail?: string) =>
    set((s) => ({
      readout: {
        reads: s.readout.reads + (outcome === "read" ? 1 : 0),
        log: [{ at: Date.now(), outcome, detail }, ...s.readout.log].slice(0, 20),
      },
    }));

  const persist = () => {
    persistChain = persistChain
      .then(async () => {
        const { uid, plans } = get();
        if (uid === null) await AsyncStorage.removeItem(PLANS_STORAGE_KEY);
        else if (plans !== null) await AsyncStorage.setItem(PLANS_STORAGE_KEY, serializeStoredPlans(uid, plans));
      })
      .catch((error) => console.warn("Could not store plans:", error));
  };

  const loadStored = (uid: string, epoch: number) =>
    (async () => {
      let plans: WorkoutPlan[] | null = null;
      try {
        const read = readStoredPlans(await AsyncStorage.getItem(PLANS_STORAGE_KEY), uid);
        if (read.error) console.warn("Stored plans discarded; will fetch:", read.error);
        plans = read.plans;
      } catch (error) {
        console.warn("Stored plans unreadable; will fetch:", error);
      }
      if (get().epoch !== epoch) return;
      // A check that finished first (network beat the disk) wins.
      set((s) => (s.plans === null && plans !== null ? { plans, source: "stored", storedRead: true } : { storedRead: true }));
    })();

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

    check: ({ force = false } = {}) => {
      const { uid, epoch } = get();
      if (uid === null) return Promise.resolve();
      if (checkInFlight) {
        note("joined");
        return checkInFlight;
      }
      if (shouldSkipCheck(get().lastOkAt, Date.now(), force)) {
        note("skipped");
        return Promise.resolve();
      }

      note("read", force ? "forced" : undefined);
      set({ checking: true, waitOver: false });
      // D9: the wait is bounded for the screen, not for the read. Past it, a
      // screen with nothing stored shows "Couldn't load plans", and the answer
      // still applies when it arrives.
      const timer = setTimeout(() => {
        if (checkInFlight === running) set({ waitOver: true });
      }, PLANS_CHECK_WAIT_MS);

      const savesBefore = savesApplied;
      const running: Promise<void> = (async () => {
        try {
          const plans = await getAllWorkoutPlans(uid);
          if (get().epoch !== epoch) return;
          if (savesApplied !== savesBefore) {
            note("failed", "answer older than a Save; dropped");
            return;
          }
          set({ plans, source: "server", lastResult: "ok", lastError: null, lastOkAt: Date.now() });
          note("ok", `${plans.length} plans`);
          persist();
        } catch (error) {
          if (get().epoch !== epoch) return;
          // D11: a failure moves nothing but these two fields; the stored
          // copy and the 2-minute skip stay as they were.
          const message = error instanceof Error ? error.message : String(error);
          set({ lastResult: "failed", lastError: message });
          note("failed", message);
        } finally {
          clearTimeout(timer);
          if (checkInFlight === running) {
            checkInFlight = null;
            set({ checking: false, waitOver: false });
          }
        }
      })();
      checkInFlight = running;
      return running;
    },

    applySaved: (uid, epoch, plan) => {
      const state = get();
      if (state.epoch !== epoch || state.uid !== uid) return;
      savesApplied += 1;
      set({ plans: withSavedPlan(state.plans, plan) });
      persist();
    },

    clear: () => {
      checkInFlight = null;
      storedLoad = null;
      // TEMPORARY (TICKET-070 debug page): `readout` counts the whole app run,
      // so it survives a clear; back to `{ ...initialState, epoch }` on removal.
      set((s) => ({ ...initialState, epoch: s.epoch + 1, readout: s.readout }));
      persist();
    },
  };
});
