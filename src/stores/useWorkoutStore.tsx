// src/hooks/useWorkoutStore.tsx
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WorkoutPlan, Exercise } from "../types/workoutType";
import { ActiveWorkout, ExerciseSet, PendingUpload } from "../types/zustandWorkoutType";
import { saveWorkoutSession } from "../services/db/workoutSessions";
import show from "../utils/toastUtils";
import { normalizeExerciseFields } from "../utils/exerciseFields";
import { clampExerciseIndex } from "../utils/workoutProgress";
import { buildSessionDocs, buildSessionId } from "../utils/exerciseStats";
import { useAuthStore } from "./authStore";
import { useExerciseHistoryStore } from "./useExerciseHistoryStore";

/**
 * In-flight uploads per session (`buildSessionId`), outside the store for the
 * same reason as `useExerciseHistoryStore`'s `inFlight`: a zustand update is not
 * visible to a second caller in the same frame (TICKET-027). A Map lookup is
 * synchronous, so Finish, a queue drain, or any later caller joins the running
 * upload instead of starting one. Resolves true if the upload succeeded.
 *
 * Today a double upload is harmless — ids derive from the start time and the
 * rollup folds by replacement — but nothing enforces that. This guard keeps one
 * upload per session regardless of what the rollup does next.
 */
const savesInFlight = new Map<string, Promise<boolean>>();

/** AsyncStorage key of the upload queue, separate from `activeWorkout`. */
const PENDING_UPLOADS_KEY = "pendingUploads";

/**
 * How long Finish waits on the upload before telling the user it will upload
 * later. Only picks the message: the workout has already left the active slot.
 * Offline, `batch.commit()` does not reject — it stays pending until the
 * connection returns (TICKET-028 step 0) — so without a bound Finish would wait
 * as long as the user is offline.
 */
export const UPLOAD_GRACE_MS = 3000;

/**
 * What Finish did. Callers branch on this instead of watching `activeWorkout` go
 * null.
 * - `uploaded`: on the server.
 * - `queued`: saved on the phone and out of the active slot; the upload is still
 *   pending (offline) or was rejected, and will be retried.
 * - `refused`: nothing was saved and the workout is still active.
 */
export type EndWorkoutResult =
  | { status: "uploaded" }
  | { status: "queued" }
  | { status: "refused"; reason: string };

const refused = (reason: string): EndWorkoutResult => ({ status: "refused", reason });

/**
 * A set taken out by `removeSet`, with the exercise it came from and the 0-based
 * position it held. Undo puts it back by `index`, never by `set.id`: ids are
 * renumbered on removal, so the captured id may now belong to another set.
 *
 * `exerciseId` travels with it so `restoreSet` can refuse a mismatch. Without
 * it, an undo fired after the screen moved to another exercise would insert the
 * set into an exercise it was never done in, renumbered to fit, silently.
 */
export type RemovedSet = { exerciseId: string; set: ExerciseSet; index: number };

/**
 * Ids 1..n in array order. `ExerciseSet.id` is an ordinal — see its type — and
 * this is what keeps it one after a set is removed or restored.
 */
const renumberSets = (sets: ExerciseSet[]): ExerciseSet[] =>
  sets.map((set, index) => (set.id === index + 1 ? set : { ...set, id: index + 1 }));

// Zustand Store Type
interface WorkoutStoreState {
  activeWorkout: ActiveWorkout | null;
  /** Finished workouts waiting to upload, in finish order. Mirrors `PENDING_UPLOADS_KEY`. */
  pendingUploads: PendingUpload[];

  // Actions
  startWorkout: (workout: WorkoutPlan) => Promise<void>;
  addSetToExercise: (exerciseId: string, newSet: ExerciseSet) => Promise<void>;
  updateSet: (exerciseId: string, setId: number, updatedFields: Record<string, string | number>) => Promise<void>;
  removeSet: (exerciseId: string, setId: number) => Promise<RemovedSet | null>;
  restoreSet: (exerciseId: string, removed: RemovedSet) => Promise<void>;
  setCurrentExerciseIndex: (index: number) => Promise<void>;
  endWorkout: (userId : string | undefined) => Promise<EndWorkoutResult>;
  cancelWorkout: () => Promise<void>;
  loadWorkoutFromStorage: () => Promise<void>;
}

export const useWorkoutStore = create<WorkoutStoreState>((set, get) => ({
  activeWorkout: null,
  pendingUploads: [],

  /** 🔹 Start a Workout */
  startWorkout: async (workout: WorkoutPlan) => {
    // Prefetch history for every exercise in the plan, first, so it overlaps the
    // local writes below and the first set is logged against a warm cache. One
    // batched query, one document per exercise. Deliberately not awaited and
    // never allowed to reject: history is an enhancement, so a slow or failed
    // fetch must not delay or block starting the workout.
    useExerciseHistoryStore
      .getState()
      .prefetchExerciseHistory(
        useAuthStore.getState().user?.uid,
        workout.exercises.map((exercise) => exercise.id)
      )
      .catch(() => {});

    const startTime = Date.now();
    const newWorkout: ActiveWorkout = {
      id: workout.id,
      name: workout.name,
      startTime,
      lastUpdated: startTime,
      exercises: workout.exercises.map((ex) => ({
        id: ex.id,
        name: ex.name,
        fields: ex.fields,
        sets: [], // Empty sets initially
      })),
      currentExerciseIndex: workout.exercises.length > 0 ? 0 : null,
    };

    await AsyncStorage.setItem("activeWorkout", JSON.stringify(newWorkout));
    set({ activeWorkout: newWorkout });
  },

  /** 🔹 Add a New Set to an Exercise */
  addSetToExercise: async (exerciseId, newSet) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    const updatedExercises = activeWorkout.exercises.map((exercise) => {
      if (exercise.id === exerciseId) {
        const newSetId = exercise.sets.length > 0 ? exercise.sets[exercise.sets.length - 1].id + 1 : 1;
        return {
          ...exercise,
          sets: [...exercise.sets, { ...newSet, id: newSetId }],
        };
      }
      return exercise;
    });

    const exerciseIndex = activeWorkout.exercises.findIndex((ex) => ex.id === exerciseId);

    const updatedWorkout: ActiveWorkout = {
      ...activeWorkout,
      exercises: updatedExercises,
      lastUpdated: Date.now(),
      currentExerciseIndex: exerciseIndex !== -1 ? exerciseIndex : null,
    };

    await AsyncStorage.setItem("activeWorkout", JSON.stringify(updatedWorkout));
    set({ activeWorkout: updatedWorkout });
  },

  /** 🔹 Update an Existing Set */
  updateSet: async (exerciseId, setId, updatedFields) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    const updatedExercises = activeWorkout.exercises.map((exercise) => {
      if (exercise.id === exerciseId) {
        return {
          ...exercise,
          sets: exercise.sets.map((set) =>
            set.id === setId ? { ...set, fields: { ...set.fields, ...updatedFields } } : set
          ),
        };
      }
      return exercise;
    });

    const exerciseIndex = activeWorkout.exercises.findIndex((ex) => ex.id === exerciseId);

    const updatedWorkout: ActiveWorkout = {
      ...activeWorkout,
      exercises: updatedExercises,
      lastUpdated: Date.now(),
      currentExerciseIndex: exerciseIndex !== -1 ? exerciseIndex : null,
    };

    await AsyncStorage.setItem("activeWorkout", JSON.stringify(updatedWorkout));
    set({ activeWorkout: updatedWorkout });
  },

  /**
   * 🔹 Remove a set from the active workout (TICKET-019).
   *
   * Active workout only, before Finish: a set that has uploaded is in the
   * rollup, and taking it out needs a rebuild — a different ticket.
   *
   * Committed at once, to memory and AsyncStorage. Undo is `restoreSet`, not a
   * pending delete: held pending, a Finish or a crash during the undo window
   * would save a set the user removed.
   *
   * The remaining sets are renumbered 1..n. Without that, removing set 2 of 4
   * leaves ids [1,3,4] at positions [1,2,3]; the next append gets 5, and every
   * comparison by set number (`setAt`, ghosts, deltas — all positional) lines
   * today's second set up against last time's third.
   *
   * `currentExerciseIndex` is left alone: removing is not logging, and the row
   * is only reachable on the exercise already on screen.
   *
   * Returns what was removed and where, or null when there was no such set.
   */
  removeSet: async (exerciseId, setId) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return null;

    let removed: RemovedSet | null = null;
    const updatedExercises = activeWorkout.exercises.map((exercise) => {
      if (exercise.id !== exerciseId) return exercise;
      const index = exercise.sets.findIndex((set) => set.id === setId);
      if (index === -1) return exercise;
      removed = { exerciseId, set: exercise.sets[index], index };
      return { ...exercise, sets: renumberSets(exercise.sets.filter((_, i) => i !== index)) };
    });
    if (!removed) return null;

    const updatedWorkout: ActiveWorkout = {
      ...activeWorkout,
      exercises: updatedExercises,
      lastUpdated: Date.now(),
    };

    await AsyncStorage.setItem("activeWorkout", JSON.stringify(updatedWorkout));
    set({ activeWorkout: updatedWorkout });
    return removed;
  },

  /**
   * 🔹 Undo a `removeSet`: put the set back at the position it held, then
   * renumber. Clamped to the end if the list has since shrunk. The UI allows
   * one pending undo and clears it when a set is logged, so in practice the
   * list is exactly as `removeSet` left it.
   *
   * No-op unless `exerciseId` is the exercise the set was removed from. The
   * logger is keyed by exercise, which clears a pending undo on navigation, but
   * that is a UI nicety; this check is what makes a wrong-exercise restore
   * impossible by any route.
   */
  restoreSet: async (exerciseId, removed) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;
    if (removed.exerciseId !== exerciseId) return;

    const updatedExercises = activeWorkout.exercises.map((exercise) => {
      if (exercise.id !== exerciseId) return exercise;
      const sets = [...exercise.sets];
      sets.splice(Math.min(removed.index, sets.length), 0, removed.set);
      return { ...exercise, sets: renumberSets(sets) };
    });

    const updatedWorkout: ActiveWorkout = {
      ...activeWorkout,
      exercises: updatedExercises,
      lastUpdated: Date.now(),
    };

    await AsyncStorage.setItem("activeWorkout", JSON.stringify(updatedWorkout));
    set({ activeWorkout: updatedWorkout });
  },

  /**
   * 🔹 Point the session at the exercise the user is looking at.
   *
   * This is the only write that means "viewing". `addSetToExercise` and
   * `updateSet` also write `currentExerciseIndex`, as "I just logged here"; in
   * the paged screen that is always the exercise on screen, so the two agree.
   *
   * Out-of-range input is clamped rather than rejected, so a stale index from a
   * double-tapped arrow lands on the last exercise instead of on nothing. An
   * empty workout keeps `null`. Persisted so a resumed session reopens on the
   * same exercise.
   */
  setCurrentExerciseIndex: async (index) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    const clamped = clampExerciseIndex(index, activeWorkout.exercises.length);
    if (clamped === activeWorkout.currentExerciseIndex) return;

    // `lastUpdated` is left alone: it tracks logged data, and paging is not data.
    const updatedWorkout: ActiveWorkout = { ...activeWorkout, currentExerciseIndex: clamped };

    // Update memory first so the screen moves on the tap, not after the disk write.
    set({ activeWorkout: updatedWorkout });
    await AsyncStorage.setItem("activeWorkout", JSON.stringify(updatedWorkout));
  },

  /**
   * 🔹 End Workout: save on the phone, then upload
   *
   * Finish completes on a local write, never on the server (TICKET-028).
   * Offline, `batch.commit()` stays pending until the connection returns, so
   * awaiting it left the user stuck on "Saving…" with the workout still active.
   *
   * The workout moves from the active slot to the upload queue synchronously,
   * before any await. A second Finish tap in the same frame therefore finds no
   * active workout and does nothing, and Discard has no in-flight save to race:
   * by the time anything else runs, the workout is no longer the active one.
   * If the queue cannot be written to disk, the move is undone and the workout
   * stays active.
   *
   * Validation happens here, before queueing: a workout with no sets would be
   * rejected by every upload and retried forever.
   */
  endWorkout: async (userId : string | undefined) => {
    if (!userId) {
      show.alert("User is not logined in.");
      return refused("Not signed in.");
    }

    const { activeWorkout } = get();
    if (!activeWorkout) return refused("No active workout.");

    const endedAt = Date.now();
    if (buildSessionDocs(activeWorkout, endedAt).exerciseSessions.length === 0) {
      const reason = "Nothing to save — no sets were logged.";
      show.alert("Could not save workout", reason);
      return refused(reason);
    }

    const entry: PendingUpload = {
      sessionId: buildSessionId(activeWorkout.id, activeWorkout.startTime),
      uid: userId,
      workout: activeWorkout,
      endedAt,
      failedAttempts: 0,
      lastError: null,
    };
    set((state) => ({
      activeWorkout: null,
      // Replace, not append, if this session is somehow queued already: one
      // entry per session.
      pendingUploads: [
        ...state.pendingUploads.filter((e) => e.sessionId !== entry.sessionId),
        entry,
      ],
    }));

    try {
      await writePendingUploads();
    } catch (error) {
      console.log("Failed to queue workout:", error);
      set((state) => ({
        activeWorkout,
        pendingUploads: state.pendingUploads.filter((e) => e.sessionId !== entry.sessionId),
      }));
      show.alert("Could not save workout", "It could not be stored on this phone. Please try again.");
      return refused("Could not write the upload queue.");
    }
    // Queue first, then clear the slot. A crash between the two leaves the
    // workout in both; `loadWorkoutFromStorage` drops the active copy.
    await AsyncStorage.removeItem("activeWorkout").catch((error) =>
      console.log("Failed to clear active workout:", error)
    );

    const upload = uploadPendingWorkout(entry);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const uploaded = await Promise.race([
      upload,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), UPLOAD_GRACE_MS);
      }),
    ]);
    clearTimeout(timer);

    if (uploaded) return { status: "uploaded" };
    if (uploaded === null) {
      // Still pending: offline, or a slow connection. The success toast follows
      // if it lands. The history caveat is the accepted TICKET-028 gap: "last
      // time" and ghost targets read the server rollup, which a queued workout
      // has not reached.
      show.info(
        "Saved on this phone",
        "It will upload when you're back online. Until then it won't show in your history."
      );
    } else {
      show.alert(
        "Saved on this phone, upload failed",
        `${get().pendingUploads.find((e) => e.sessionId === entry.sessionId)?.lastError ?? "Unknown error."} It will be retried.`
      );
    }
    return { status: "queued" };
  },

  /**
   * 🔹 Cancel Workout (Discard Without Saving)
   *
   * No longer refused during a save (TICKET-027's "Finish wins"): since
   * TICKET-028 a finished workout leaves the active slot before its upload
   * starts, so the active workout never has one in flight.
   */
  cancelWorkout: async () => {
    try {
      await AsyncStorage.removeItem("activeWorkout"); // Remove stored workout
      set({ activeWorkout: null });
      console.log("Workout cancelled successfully.");
    } catch (error) {
      console.error("Failed to cancel workout:", error);
    }
  },

  /**
   * 🔹 Restore the active workout and the upload queue at app start, then start
   * uploading the queue (it waits for each entry's user to be signed in).
   */
  loadWorkoutFromStorage: async () => {
    // A queue that cannot be read must not also cost the active workout.
    await loadPendingUploads().catch((error) => console.log("Failed to load upload queue:", error));
    watchSignInForUploads();
    drainPendingUploads();

    const storedWorkout = await AsyncStorage.getItem("activeWorkout");
    if (!storedWorkout) return;

    const parsed = JSON.parse(storedWorkout) as ActiveWorkout;
    const sessionId = buildSessionId(parsed.id, parsed.startTime);
    if (get().pendingUploads.some((e) => e.sessionId === sessionId)) {
      // Finished, and the app died before the slot was cleared. The queue has it.
      await AsyncStorage.removeItem("activeWorkout");
      return;
    }
    const exercises = (parsed.exercises ?? []).map((exercise) => ({
      ...exercise,
      // A workout started before field roles existed has `fields: string[]` in
      // storage. Normalising on the way in keeps a resumed session renderable
      // instead of showing inputs labelled `undefined`.
      fields: normalizeExerciseFields(exercise.fields),
    }));
    set({ activeWorkout: { ...parsed, exercises } });

    prefetchHistoryOnResume(exercises.map((exercise) => exercise.id));
  },
}));

// ---------------------------------------------------------------------------
// Upload queue (TICKET-028)
// ---------------------------------------------------------------------------

/** Serialises queue writes so the disk ends on the latest state, never an older one. */
let queueWrite: Promise<void> = Promise.resolve();

/**
 * Write the in-memory queue to disk. Each write snapshots the queue when it
 * runs, not when it was requested, so overlapping writes converge on the latest
 * state. Rejects if this write failed; later writes still run.
 *
 * The chain is deliberately redundant, and no test covers it: removing it
 * leaves every test green. Without it, each write snapshots at call time and
 * starts at once, so the disk is only current if AsyncStorage finishes writes in
 * the order they were issued. That is likely, but nothing here asserts it, and
 * the chain makes it unnecessary to rely on.
 */
function writePendingUploads(): Promise<void> {
  const write = queueWrite.then(() =>
    AsyncStorage.setItem(
      PENDING_UPLOADS_KEY,
      JSON.stringify(useWorkoutStore.getState().pendingUploads)
    )
  );
  queueWrite = write.catch(() => {});
  return write;
}

const writePendingUploadsOrLog = () =>
  writePendingUploads().catch((error) => console.log("Failed to write upload queue:", error));

const updateEntry = (sessionId: string, update: (e: PendingUpload) => PendingUpload | null) =>
  useWorkoutStore.setState((state) => ({
    pendingUploads: state.pendingUploads.flatMap((e) => {
      if (e.sessionId !== sessionId) return [e];
      const next = update(e);
      return next ? [next] : [];
    }),
  }));

/**
 * Read the queue from disk. Entries already in memory (a Finish that beat the
 * load) are kept after the stored ones.
 *
 * An unreadable queue is copied aside, not overwritten: the next write would
 * otherwise replace finished workouts with an empty list.
 */
async function loadPendingUploads(): Promise<void> {
  const raw = await AsyncStorage.getItem(PENDING_UPLOADS_KEY);
  if (!raw) return;
  let stored: PendingUpload[];
  try {
    stored = JSON.parse(raw);
    if (!Array.isArray(stored)) throw new Error("not an array");
  } catch (error) {
    console.log("Upload queue unreadable, kept as pendingUploads.corrupt:", error);
    await AsyncStorage.setItem(`${PENDING_UPLOADS_KEY}.corrupt.${Date.now()}`, raw);
    return;
  }
  useWorkoutStore.setState((state) => ({
    pendingUploads: [
      ...stored,
      ...state.pendingUploads.filter((e) => !stored.some((s) => s.sessionId === e.sessionId)),
    ],
  }));
}

/**
 * Upload one queued workout. Resolves true on success, false on rejection, and
 * stays pending while offline. Never rejects.
 *
 * Joins an upload already running for the same session (`savesInFlight`). The
 * entry is removed only after the upload succeeds; a rejection keeps it, counts
 * the failure and records the message.
 */
function uploadPendingWorkout(entry: PendingUpload): Promise<boolean> {
  const pending = savesInFlight.get(entry.sessionId);
  if (pending) return pending;

  const run = attemptUpload(entry).finally(() => {
    // Identity check: only remove our own entry, never a later upload's.
    // Unreachable today, since the join above allows one upload per session, so
    // no test covers it. Kept deliberately: it is what stays correct if a
    // `force` path that bypasses the join is ever added, as the history
    // store's prefetch has.
    if (savesInFlight.get(entry.sessionId) === run) savesInFlight.delete(entry.sessionId);
  });
  savesInFlight.set(entry.sessionId, run);
  return run;
}

async function attemptUpload(entry: PendingUpload): Promise<boolean> {
  try {
    console.log("Uploading workout to database:", entry.sessionId);
    const { rollupApplied } = await saveWorkoutSession(entry.uid, entry.workout, entry.endedAt);
    // Cached history predates the session just saved. Drop it so the next
    // read refetches.
    useExerciseHistoryStore
      .getState()
      .invalidateExercises(entry.workout.exercises.map((e) => e.id));
    if (!rollupApplied) {
      // Session data is safe; only the derived exercise_stats rollup is
      // behind. src/scripts/rebuildExerciseStats.ts repairs it.
      console.warn("Workout saved, history rollup pending.");
    }
    updateEntry(entry.sessionId, () => null);
    // If this write fails the entry comes back on restart and uploads again,
    // which is safe: same ids, and the rollup folds by replacement.
    await writePendingUploadsOrLog();
    show.success("Workout saved successfully!");
    // A successful upload is the best evidence the connection is back.
    drainPendingUploads();
    return true;
  } catch (error) {
    // Logged, not `console.error`: in a dev build that opens LogBox's red
    // banner on top of the toast the caller shows.
    console.log("Failed to upload workout:", error);
    const message = error instanceof Error ? error.message : String(error);
    updateEntry(entry.sessionId, (e) => ({
      ...e,
      failedAttempts: e.failedAttempts + 1,
      lastError: message,
    }));
    await writePendingUploadsOrLog();
    return false;
  }
}

let draining: Promise<void> | null = null;

/**
 * Upload every queued workout of the signed-in user, one at a time, in finish
 * order. Called at app start, on sign-in, on return to the foreground, and after
 * each successful upload. No connectivity check: none is installed, and an
 * attempt costs nothing offline — it stays pending until the connection
 * returns, then completes. Repeat calls join the running drain.
 *
 * A rejected entry does not block the ones after it: they are independent
 * sessions, and one bad entry would otherwise hold the whole queue hostage.
 * Each entry is tried once per drain, so a failing entry is retried on the next
 * trigger, not in a loop. Rejections are reported once per drain, with the
 * count still waiting.
 *
 * Entries of other users are skipped, not attempted: the rules would reject
 * them. They upload when their user signs in again. What sign-out should do to
 * them is TICKET-026's question.
 */
export function drainPendingUploads(): Promise<void> {
  // Deliberately redundant behind `savesInFlight`, and no test covers it:
  // without it two drains run side by side, but both pick the same entry and
  // the upload join collapses them into one save. What it saves is a second
  // loop and a duplicate "Upload failed" toast, not a double upload.
  if (draining) return draining;
  draining = (async () => {
    const tried = new Set<string>();
    let failed = 0;
    let lastError = "Unknown error.";
    for (;;) {
      const uid = useAuthStore.getState().user?.uid;
      if (!uid) break;
      const next = useWorkoutStore
        .getState()
        .pendingUploads.find((e) => e.uid === uid && !tried.has(e.sessionId));
      if (!next) break;
      tried.add(next.sessionId);
      if (await uploadPendingWorkout(next)) continue;
      failed++;
      lastError =
        useWorkoutStore.getState().pendingUploads.find((e) => e.sessionId === next.sessionId)
          ?.lastError ?? lastError;
    }
    if (failed > 0) {
      const uid = useAuthStore.getState().user?.uid;
      const waiting = useWorkoutStore.getState().pendingUploads.filter((e) => e.uid === uid).length;
      show.alert(
        "Upload failed",
        `${waiting} workout${waiting === 1 ? "" : "s"} waiting to upload. ${lastError} Will retry.`
      );
    }
  })().finally(() => {
    draining = null;
  });
  return draining;
}

let stopSignInWatch: (() => void) | null = null;

/** Drain whenever the signed-in user changes to someone. Installed once. */
function watchSignInForUploads() {
  if (stopSignInWatch) return;
  stopSignInWatch = useAuthStore.subscribe((state, previous) => {
    const uid = state.user?.uid;
    if (uid && uid !== previous.user?.uid) drainPendingUploads();
  });
}

/** Cancels a resume prefetch still waiting for sign-in, if any. */
let stopResumePrefetchWatch: (() => void) | null = null;

/**
 * Warm the history cache for a resumed session, as `startWorkout` does for a
 * new one. History is only ever fetched at session moments, never by a screen.
 *
 * Restore runs once at app start, before auth has settled: `initAuth` sets the
 * user only after a session check and a server write. Prefetching there would
 * see no uid and silently return. So fetch now if the user is known, otherwise
 * on the first user to appear. Repeat calls are free — the history store skips
 * ready entries and joins in-flight requests — and a failure is swallowed,
 * leaving the progress bar on its default target, as on start.
 */
function prefetchHistoryOnResume(exerciseIds: string[]) {
  stopResumePrefetchWatch?.();
  stopResumePrefetchWatch = null;
  if (exerciseIds.length === 0) return;

  const prefetch = (uid: string) =>
    useExerciseHistoryStore
      .getState()
      .prefetchExerciseHistory(uid, exerciseIds)
      .catch(() => {});

  const uid = useAuthStore.getState().user?.uid;
  if (uid) {
    prefetch(uid);
    return;
  }

  const stop = useAuthStore.subscribe((state) => {
    const signedIn = state.user?.uid;
    if (!signedIn) return;
    stop();
    stopResumePrefetchWatch = null;
    prefetch(signedIn);
  });
  stopResumePrefetchWatch = stop;
}

