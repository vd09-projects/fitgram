// src/stores/syncRunner.ts
//
// The shared sync core's I/O half (TICKET-075, TICKET-072 D9): the machinery
// a zustand store needs to hold server data on the phone and check it,
// moved here from `usePlansStore` (TICKET-070) unchanged in behaviour. The
// pure rules are `utils/syncCore.ts`.
//
// What it runs, the same for every store:
// - the stored copy, read once per user (`open`), and written in a chain so an
//   older write cannot land last (`persist`);
// - one check at a time: a trigger while one runs joins it (070 D9), except a
//   forced one past its wait, which starts afresh; the wait is bounded for the
//   screen, not for the read (`waitOver`);
// - the skip window (070 D4) and a failure that moves nothing (D11);
// - an answer older than a newer check's is dropped (`seq`);
// - `epoch`, counted by `clear` (sign-out, D2): work started under one epoch
//   applies only while it is current, so a late answer for the user who
//   signed out cannot refill the store for the next one;
// - the debug readout: server reads this run and the last checks.
//
// What each store brings (`SyncConfig`): how to read and write its stored
// copy, which read a check runs, and how an answer merges. Writes outside a
// check (a Save, a Finish) stay in the store, on `isCurrent`, `persist` and
// `note`.
//
// Exercise summaries (TICKET-076) run on it too: a full read of one collection,
// a change check on a stamp, a stored copy in several AsyncStorage entries
// (`readStored` and `writeStored` own the key layout), cleared on sign-out.

import { withinSkipWindow } from "../utils/syncCore";

export type SyncResult = "ok" | "failed" | null;

// Debug readout, for the Plans Store debug page (TICKET-070; kept, user 2026-11-06).
export type ReadoutEntry<Kind extends string = string> = {
  at: number;
  outcome: "read" | "skipped" | "joined" | "ok" | "failed" | "dropped" | "refused";
  kind?: Kind;
  detail?: string;
};

/** The fields the runner owns in a store's state. */
export type SyncFields<Kind extends string = string> = {
  uid: string | null;
  /** The stored copy has been read (or found absent) for this user. */
  storedRead: boolean;
  checking: boolean;
  /** The running check has outlasted the store's wait. */
  waitOver: boolean;
  lastResult: SyncResult;
  lastError: string | null;
  /** When a check last succeeded. Memory only (070 D4): every app start checks. */
  lastOkAt: number | null;
  epoch: number;
  // Debug readout. Server reads issued this app run, and the last few checks.
  readout: { reads: number; log: ReadoutEntry<Kind>[] };
};

/** One check, from start to answer. A store adds what its read needs. */
export type CheckRun<Kind extends string = string> = { uid: string; epoch: number; seq: number; kind: Kind };

type Update<S> = Partial<S> | ((state: S) => Partial<S>);

export type SyncConfig<S extends SyncFields<Kind>, Kind extends string, Run extends CheckRun<Kind>, Answer> = {
  get: () => S;
  set: (update: Update<S>) => void;
  /** Everything `clear` resets to, but `epoch` and `readout`. */
  initialState: Partial<S>;
  /** How long a screen with nothing stored waits on a check before it says so (070 D9). */
  waitMs: number;
  /** A check that succeeded this recently makes the next trigger skip (070 D4). */
  skipMs: number;
  /** The stored copy for `uid` as state, or null for "nothing stored". Never rejects. */
  readStored: (uid: string) => Promise<Partial<S> | null>;
  /** Write the state as it is, or remove it when `uid` is null. May reject: logged. */
  writeStored: (state: S) => Promise<void>;
  /** The server read for a check. Rejects offline (D11). */
  read: (run: Run) => Promise<Answer>;
  /** A check's answer merged into the state. The runner adds the success fields. */
  apply: (state: S, run: Run, answer: Answer, now: number) => Partial<S>;
  /** The readout's line for an answer ("3 docs"). */
  describe: (answer: Answer) => string;
  /** Names the store in warnings. */
  label: string;
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function createSyncRunner<S extends SyncFields<Kind>, Kind extends string, Run extends CheckRun<Kind>, Answer>(
  config: SyncConfig<S, Kind, Run, Answer>
) {
  const { get, set } = config;

  // Module state, one set per store. Not in the store: nothing renders from it.

  /** The running check, joined by any trigger while it runs (D9). */
  let checkInFlight: Promise<void> | null = null;
  /** The stored copy being read for the current user. */
  let storedLoad: Promise<void> | null = null;
  /**
   * AsyncStorage writes run one after another, each writing the state as it
   * is when its turn comes. So an older write cannot land last: the last
   * write in the chain always holds the latest state.
   */
  let persistChain: Promise<void> = Promise.resolve();
  /**
   * Checks started, and the newest one whose answer was applied. A forced
   * check can start while a stalled one still runs (`check`); if the stalled
   * one answers last, its data is older and is dropped. Kept beside each
   * store's own merge rule because it also covers unstamped data, which a
   * stamp comparison cannot order.
   */
  let checksStarted = 0;
  let newestApplied = 0;

  // Debug readout: logs each check and counts server reads.
  const note = (outcome: ReadoutEntry["outcome"], kind?: Kind, detail?: string) =>
    set((s) => ({
      readout: {
        reads: s.readout.reads + (outcome === "read" ? 1 : 0),
        log: [{ at: Date.now(), outcome, kind, detail }, ...s.readout.log].slice(0, 20),
      },
    }) as Partial<S>);

  /** Is work started under `epoch` still for the signed-in user (D2)? */
  const isCurrent = (epoch: number) => get().epoch === epoch;

  /** Queue a write of the state as it is when the write's turn comes. */
  const persist = () => {
    persistChain = persistChain
      .then(() => config.writeStored(get()))
      .catch((error) => console.warn(`Could not store ${config.label}:`, error));
  };

  const loadStored = async (uid: string, epoch: number) => {
    const held = await config.readStored(uid);
    if (!isCurrent(epoch)) return;
    // Nothing is held yet (TICKET-078): `open` waits for this before it checks,
    // Try again shows only after it, and a Save or Finish is ignored while
    // nothing is held. Rejected: letting an earlier answer win, which only a
    // debug button tapped during this disk read could reach.
    set({ ...held, storedRead: true } as Partial<S>);
  };

  const onAnswer = (run: Run, answer: Answer) => {
    if (!isCurrent(run.epoch)) return;
    if (run.seq < newestApplied) {
      note("dropped", run.kind, "answer older than a newer check's");
      return;
    }
    newestApplied = run.seq;
    const now = Date.now();
    set((s) => ({ ...config.apply(s, run, answer, now), lastResult: "ok", lastError: null, lastOkAt: now }) as Partial<S>);
    note("ok", run.kind, config.describe(answer));
    persist();
  };

  const onFailure = (run: Run, error: unknown) => {
    if (!isCurrent(run.epoch)) return;
    // A read superseded by a forced one: its failure says nothing about the
    // read now running, which owns the result.
    if (run.seq < checksStarted) {
      note("dropped", run.kind, "failed after a newer check started");
      return;
    }
    // D11: a failure moves nothing but these two fields; the stored copy,
    // `lastSeen`, the skip and the full-reload time stay as they were.
    const message = errorMessage(error);
    set({ lastResult: "failed", lastError: message } as Partial<S>);
    note("failed", run.kind, message);
  };

  const startCheck = (run: Run): Promise<void> => {
    set({ checking: true, waitOver: false } as Partial<S>);

    // `async` wrapper: even a read that throws at once becomes a rejection,
    // and the check reports it as failed.
    const running: Promise<void> = (async () => config.read(run))()
      .then((answer) => onAnswer(run, answer))
      .catch((error) => onFailure(run, error))
      .finally(() => {
        clearTimeout(waitTimer);
        if (checkInFlight === running) {
          checkInFlight = null;
          set({ checking: false, waitOver: false } as Partial<S>);
        }
      });

    // D9: the wait is bounded for the screen, not for the read. Past it, a
    // screen with nothing stored says so, and the answer still applies when
    // it arrives.
    const waitTimer = setTimeout(() => {
      if (checkInFlight === running) set({ waitOver: true } as Partial<S>);
    }, config.waitMs);

    checkInFlight = running;
    return running;
  };

  return {
    note,
    isCurrent,
    persist,

    /** Load the stored copy for `uid` once, clearing another user's first. */
    open: async (uid: string) => {
      if (get().uid !== uid) {
        if (get().uid !== null) clear();
        set({ uid } as Partial<S>);
        storedLoad = loadStored(uid, get().epoch);
      }
      await storedLoad;
    },

    /**
     * Ask the server now, unless one is running (join, D9) or `plan` says
     * there is nothing to do. `plan` gets the state and whether the skip
     * window covers this trigger (D4), and returns the run's own fields, or
     * null to skip. `force` passes the skip window; it also starts a fresh
     * read when the running one is past its wait.
     */
    check: (
      { force = false }: { force?: boolean },
      plan: (state: S, skipped: boolean) => Omit<Run, "uid" | "epoch" | "seq"> | null
    ): Promise<void> => {
      const state = get();
      if (state.uid === null) return Promise.resolve();

      // D9: a trigger joins the running check. Except Try again on a check
      // past its wait: the screen already says it failed, and joining a
      // stalled read would make the tap do nothing (PR #48 review). The
      // stalled read is left to land; `newestApplied` drops it if late.
      const restartStalled = force && state.waitOver;
      if (checkInFlight && !restartStalled) {
        note("joined");
        return checkInFlight;
      }

      const skipped = withinSkipWindow(state.lastOkAt, Date.now(), config.skipMs, force);
      const own = plan(state, skipped);
      if (own === null) {
        note("skipped");
        return Promise.resolve();
      }

      const run = { ...own, uid: state.uid, epoch: state.epoch, seq: ++checksStarted } as Run;
      note("read", run.kind, force ? "forced" : undefined);
      return startCheck(run);
    },

    clear,
  };

  function clear() {
    checkInFlight = null;
    storedLoad = null;
    // Debug readout: `readout` counts the whole app run, so it survives a clear.
    set((s) => ({ ...config.initialState, epoch: s.epoch + 1, readout: s.readout }) as Partial<S>);
    persist();
  }
}
