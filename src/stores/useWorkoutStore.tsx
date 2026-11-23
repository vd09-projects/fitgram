// src/hooks/useWorkoutStore.tsx
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WorkoutPlan, Exercise } from "../types/workoutType";
import { Effort } from "../types/workoutSession";
import { ActiveWorkout, ExerciseSet, LoggedExercise, PendingUpload } from "../types/zustandWorkoutType";
import { saveWorkoutSession } from "../services/db/workoutSessions";
import show from "../utils/toastUtils";
import { savedSummary } from "../utils/sessionDuration";
import { clampExerciseIndex, indexAfterRemoval, resolveCurrentIndex } from "../utils/workoutProgress";
import { extendRest, RestTimer } from "../utils/restTimer";
import { buildSessionDocs, buildSessionId } from "../utils/exerciseStats";
import { toEditableWorkout } from "../utils/editSession";
import { slotTakenReason } from "../utils/workoutSlot";
import type { WorkoutSessionDoc } from "../types/workoutSession";
import { useAuthStore } from "./authStore";
import { useExerciseHistoryStore } from "./useExerciseHistoryStore";
import { useRecentWorkoutsStore } from "./useRecentWorkoutsStore";
import { useCatalogStore } from "./useCatalogStore";
import { exerciseDisplayName, type CatalogIndex } from "../utils/catalog";
import { unitsForRole, type FieldUnit } from "../constants/units";
import { carryLastUnits } from "../utils/unitChange";
import { UPLOAD_GRACE_MS } from "../config/workout";
import { ACTIVE_WORKOUT_KEY, LOCAL_DATA_VERSION, LOCAL_DATA_VERSION_KEY, PENDING_UPLOADS_KEY } from "../config/storageKeys";

/**
 * In-flight uploads per session (`buildSessionId`), outside the store because
 * a zustand update is not visible to a second caller in the same frame
 * (TICKET-027). A Map lookup is
 * synchronous, so Finish, a queue drain, or any later caller joins the running
 * upload instead of starting one. Resolves true if the upload succeeded.
 *
 * Today a double upload is harmless — ids derive from the start time and the
 * rollup folds by replacement — but nothing enforces that. This guard keeps one
 * upload per session regardless of what the rollup does next.
 */
const savesInFlight = new Map<string, Promise<boolean>>();

/** Sessions whose Finish is still waiting for its upload; their landing screen says "saved" itself (`endWorkout`). */
const landingOn = new Set<string>();

// ACTIVE_WORKOUT_KEY, PENDING_UPLOADS_KEY, LOCAL_DATA_VERSION and its key: value and reason in src/config/storageKeys.ts.

/** Remove `activeWorkout` and the upload queue if they predate LOCAL_DATA_VERSION. */
async function clearLocalDataFromOlderBuilds(): Promise<void> {
  if ((await AsyncStorage.getItem(LOCAL_DATA_VERSION_KEY)) === LOCAL_DATA_VERSION) return;
  await AsyncStorage.multiRemove([ACTIVE_WORKOUT_KEY, PENDING_UPLOADS_KEY]);
  await AsyncStorage.setItem(LOCAL_DATA_VERSION_KEY, LOCAL_DATA_VERSION);
  console.log(`Local workout data from an older build cleared (data version ${LOCAL_DATA_VERSION}).`);
}

// UPLOAD_GRACE_MS: value and reason in src/config/workout.ts.

/**
 * What Finish did. Callers branch on this instead of watching `activeWorkout` go
 * null.
 * - `uploaded`: on the server.
 * - `queued`: saved on the phone and out of the active slot; the upload is still
 *   pending (offline) or was rejected, and will be retried.
 * - `refused`: nothing was saved and the workout is still active.
 * `sessionId` is the saved workout's id, the one the Session screen opens by (TICKET-083). It is
 * `buildSessionId(workout.id, workout.startTime)`, so a caller can also know it before Finish.
 */
export type EndWorkoutResult =
  | { status: "uploaded"; sessionId: string }
  | { status: "queued"; sessionId: string }
  | { status: "refused"; reason: string };

const refused = (reason: string): EndWorkoutResult => ({ status: "refused", reason });

export type StartWorkoutResult = { status: "started" } | { status: "refused"; reason: string };

/** Swap's reason in an edit draft (TICKET-102): a swap there would rewrite which exercise was done. */
export const EDIT_SWAP_REASON = "Not while editing a past workout.";

export type SwapExerciseResult = { status: "swapped" } | { status: "refused"; reason: string };
export type AddExerciseResult = { status: "added" } | { status: "refused"; reason: string };
export type SetExerciseUnitsResult = { status: "changed" } | { status: "refused"; reason: string };

/** The menu item's reason too (board SwapLocked), so the two say the same thing. */
export const SWAP_LOCKED_REASON = "Only before set 1. Delete the logged sets to swap.";

/** As `SWAP_LOCKED_REASON`, for Remove from today (TICKET-069, board RemoveLocked). */
export const REMOVE_LOCKED_REASON = "Only before set 1. Delete the logged sets to remove.";

/**
 * A slot taken out by `removeExercise` (TICKET-069), whole, with the 0-based
 * position it held. Whole so Undo brings back `planned` and `added` with it;
 * by position, like `RemovedSet`, since the list has moved up around it.
 */
export type RemovedExercise = { slot: LoggedExercise; index: number };

export type RemoveExerciseResult =
  | { status: "removed"; removed: RemovedExercise }
  | { status: "refused"; reason: string };
export type RestoreExerciseResult = { status: "restored" } | { status: "refused"; reason: string };

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

/**
 * A slot with no sets for one exercise: its own id, name and fields. Every slot
 * is built here, at start, swap and add, so they agree on the name snapshot:
 * refreshed from the catalog as it reads now, so the session doc keeps the name
 * as it read when logged (its `exerciseName`).
 */
const freshSlot = (exercise: Exercise, catalogIndex: CatalogIndex | null): LoggedExercise => ({
  id: exercise.id,
  name: exercise.name,
  ...(exercise.nameSnapshot ? { nameSnapshot: exerciseDisplayName(exercise, catalogIndex).title } : {}),
  fields: exercise.fields,
  sets: [],
});

/**
 * `exercise` with the units it was last logged in (TICKET-101), for swap and add
 * only: the plan's own exercises at start keep the plan's units. Reads the held
 * summary, never fetches: nothing held yet (a cold start) leaves the version's
 * own units, and `prefetchHistory` runs after. `planned` is built from the slot
 * before this, so the plan card still lists the plan's own units.
 *
 * Swapping back to the plan's exercise skips this (`swapExercise`): chosen, the
 * plan's own units, as at Start, so one exercise opens the same way however it
 * was reached. Rejected: carrying there too, which gave an exercise in kg at
 * Start and lb after swapping away and back (PR #85 review).
 */
const withLastUnits = (exercise: Exercise): Exercise => {
  const last = useExerciseHistoryStore.getState().byId?.[exercise.id]?.fields;
  const fields = carryLastUnits(exercise.fields, last);
  return fields === exercise.fields ? exercise : { ...exercise, fields };
};

const catalogIndexNow = () => useCatalogStore.getState().catalog?.index ?? null;

/**
 * Refused by swap and add alike: an `exercise_sessions` doc id is
 * `{sessionId}__{exerciseId}`, so the same id twice in a session would
 * overwrite one at upload, silently.
 */
const ALREADY_IN_WORKOUT_REASON = "That exercise is already in today's workout.";

/**
 * Check the saved summaries as exercises enter the workout (start, swap, add).
 * Not awaited and never rejects: history is an enhancement, so a slow or failed
 * check must not delay or block the action that triggered it.
 */
const prefetchHistory = () => {
  void useExerciseHistoryStore.getState().open(useAuthStore.getState().user?.uid);
};

/**
 * Save the active workout (TICKET-064): phone first, then memory. If the write
 * fails the promise rejects and the screen never shows a change an app kill
 * would lose. `extra` is state that changes in the same step: swap ends a rest
 * on its slot.
 *
 * Every action that changes the workout ends here, except paging
 * (`setCurrentExerciseIndex`), which writes memory first and keeps its own two
 * lines rather than an order flag only it would pass. `currentExerciseIndex`
 * stays with each action, which decides it on purpose.
 * Removals use the key alone: their error handling and memory steps differ.
 *
 * Rejected: zustand `persist` (writes memory first without waiting, and one key
 * for the whole store, while the upload queue has its own key and writer and
 * load must clear older builds and drop a queued workout before reading);
 * a pure "next workout" function per action (the actions already compute then
 * commit; this is the commit); the key constant alone (leaves eight copies of
 * the order, with its reason written at one).
 */
async function saveActiveWorkout(workout: ActiveWorkout, extra?: Partial<Pick<WorkoutStoreState, "rest">>) {
  await AsyncStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(workout));
  useWorkoutStore.setState({ activeWorkout: workout, ...extra });
}

// Zustand Store Type
interface WorkoutStoreState {
  activeWorkout: ActiveWorkout | null;
  /** Finished workouts waiting to upload, in finish order. Mirrors `PENDING_UPLOADS_KEY`. */
  pendingUploads: PendingUpload[];
  /**
   * The session id of the last Finish whose queue write succeeded, or null (TICKET-083). In memory only. The active
   * slot is empty from the moment Finish starts, but the workout is safe only once it is on disk: a screen that
   * acts on "the workout ended" (the landing on the Session) waits for this, because a failed write puts the
   * workout back, and a screen that left on the empty slot would be left on a Session with no workout behind it.
   */
  queuedSessionId: string | null;
  /**
   * The session id of the last upload that showed the "Saved" toast, or null (TICKET-083). In memory only. The toast is
   * suppressed for an upload that lands inside Finish's wait (`landingOn`), where the Session says "Workout saved"
   * itself; the Session reads this to say it only when the toast did not. Set before the workout reaches the window,
   * so a screen that sees the workout uploaded already sees this.
   */
  toastedSessionId: string | null;
  /**
   * The rest running since the last logged set, or null (TICKET-021).
   *
   * Memory only, not written to AsyncStorage: it survives navigating away and
   * backgrounding, which keep the JS process, but not the OS killing the app.
   * After a kill the workout resumes on the card, which loses nothing logged.
   * Cleared by Finish and Discard, the only ways the active slot empties — and
   * `startWorkout` refuses unless it is empty — so a stale rest cannot reappear
   * on the same exercise in the next session.
   */
  rest: RestTimer | null;

  // Actions
  startWorkout: (workout: WorkoutPlan) => Promise<StartWorkoutResult>;
  /** Open a past workout as an edit draft in the slot (TICKET-102). Refused while the slot is taken. */
  startEdit: (session: WorkoutSessionDoc) => Promise<StartWorkoutResult>;
  addSetToExercise: (exerciseId: string, newSet: ExerciseSet) => Promise<void>;
  /** Replace a logged set's segments; id, mark and rest untouched (TICKET-040, TICKET-055). */
  updateSet: (exerciseId: string, setId: number, segments: Record<string, string | number>[]) => Promise<void>;
  removeSet: (exerciseId: string, setId: number) => Promise<RemovedSet | null>;
  restoreSet: (exerciseId: string, removed: RemovedSet) => Promise<void>;
  /** Mark how a set felt, or clear the mark with null (TICKET-034). */
  setSetEffort: (exerciseId: string, setId: number, effort: Effort | null) => Promise<void>;
  setCurrentExerciseIndex: (index: number) => Promise<void>;
  /** Replace an unlogged exercise in its slot, for this workout only (TICKET-047). */
  swapExercise: (exerciseId: string, exercise: Exercise) => Promise<SwapExerciseResult>;
  /**
   * Set the units of one exercise's fields, for this workout only (TICKET-091).
   * `units` maps a field name to its new unit; fields left out keep theirs.
   */
  setExerciseUnits: (exerciseId: string, units: Record<string, FieldUnit>) => Promise<SetExerciseUnitsResult>;
  /** Append an exercise and show it, for this workout only (TICKET-056). */
  addExercise: (exercise: Exercise) => Promise<AddExerciseResult>;
  /** Take an unlogged exercise out of today's list, for this workout only (TICKET-069). */
  removeExercise: (exerciseId: string) => Promise<RemoveExerciseResult>;
  /** Undo a `removeExercise`: the slot back where it was, and in view. */
  restoreExercise: (removed: RemovedExercise) => Promise<RestoreExerciseResult>;
  endWorkout: (userId : string | undefined) => Promise<EndWorkoutResult>;
  cancelWorkout: () => Promise<void>;
  /**
   * An edit's Save is running (TICKET-102). In the store, not in the screen: the screen can be left (hardware Back)
   * and opened again mid-Save, and a new instance must still see it (MPR of PR #86). Never persisted.
   */
  editSaving: boolean;
  setEditSaving: (saving: boolean) => void;
  /**
   * Empty the slot once an edit is saved. Unlike `cancelWorkout`, the draft leaves memory even when storage keeps
   * failing (the save is done, so the draft must not stay on screen); the removal is tried twice. If both fail, the
   * stale draft reloads on the next launch and its Save says "Changed elsewhere"; Cancel edit still clears it.
   */
  closeSavedEdit: () => Promise<void>;
  loadWorkoutFromStorage: () => Promise<void>;
  /** Start a rest of `durationMs` from now, replacing any rest already running. */
  startRest: (exerciseId: string, durationMs: number, setNumber: number) => void;
  /** Add-time. See `extendRest` for a rest that has already ended. */
  addRestTime: () => void;
  /** Skip, or leave a finished rest. Immediate; nothing to confirm. */
  endRest: () => void;
}

export const useWorkoutStore = create<WorkoutStoreState>((set, get) => ({
  activeWorkout: null,
  editSaving: false,
  setEditSaving: (saving) => set({ editSaving: saving }),
  closeSavedEdit: async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await AsyncStorage.removeItem(ACTIVE_WORKOUT_KEY);
        break;
      } catch (error) {
        console.error("Failed to clear the saved edit's draft:", error);
      }
    }
    set({ activeWorkout: null, rest: null });
  },
  pendingUploads: [],
  queuedSessionId: null,
  toastedSessionId: null,
  rest: null,

  /**
   * 🔹 Start a Workout
   *
   * Refused while any workout is in progress, the same plan included: starting
   * replaces `activeWorkout` with empty sets, so it would delete every set
   * logged so far, from the store and from storage, with no undo. The refusal
   * lives here rather than only on the Start screen's disabled button because
   * this is what destroys the data, and every entry point (TICKET-011's
   * cross-screen indicator, say) gets it without re-implementing the check.
   * The screen still disables the button; that is what explains why.
   */
  startWorkout: async (workout: WorkoutPlan) => {
    const current = get().activeWorkout;
    if (current) {
      return {
        status: "refused",
        reason: current.editOf
          ? slotTakenReason(current)
          : `${current.name} is still in progress. Resume or discard it first.`,
      };
    }

    // Check the saved summaries first, so it overlaps the local writes below.
    // Not for an empty Freestyle: its first added exercise checks.
    if (workout.exercises.length > 0) prefetchHistory();

    const startTime = Date.now();
    const catalogIndex = catalogIndexNow();
    const newWorkout: ActiveWorkout = {
      id: workout.id,
      name: workout.name,
      startTime,
      exercises: workout.exercises.map((ex) => freshSlot(ex, catalogIndex)),
      currentExerciseIndex: workout.exercises.length > 0 ? 0 : null,
    };

    await saveActiveWorkout(newWorkout);
    return { status: "started" };
  },

  /**
   * 🔹 Edit a past workout (TICKET-102)
   *
   * The stored workout becomes a draft in the active slot (`toEditableWorkout`), so the logger edits it with its own
   * controls and an app kill keeps it. Refused while the slot holds a workout or another draft: one slot, and
   * replacing it would lose what is there. Nothing is written to the server here; Save is its own action.
   * The summaries are checked as at Start, so "last time" (the session before this one) is there to compare with.
   */
  startEdit: async (session) => {
    const current = get().activeWorkout;
    if (current) return { status: "refused", reason: slotTakenReason(current) };
    const draft = toEditableWorkout(session);
    if (draft.status === "refused") return draft;
    prefetchHistory();
    await saveActiveWorkout(draft.workout);
    return { status: "started" };
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
      currentExerciseIndex: exerciseIndex !== -1 ? exerciseIndex : null,
    };

    await saveActiveWorkout(updatedWorkout);
  },

  /**
   * 🔹 Edit a logged set in the active workout (TICKET-040).
   *
   * REPLACES the set's segments with `segments`, every one, it does not merge.
   * The card's form holds every field, so its output (`buildSetFields`) is the
   * whole segment, and a merge would keep the old value of an optional field
   * the user cleared. Rejected: merge, which was this action's behaviour
   * before 040 (it had no caller). A caller that edits only the first segment
   * passes the others back as they were (TICKET-055); 033-3 passes the edited
   * list. An empty list is ignored: a set has at least one segment.
   *
   * Only `segments` changes. The set keeps its id — its position, which every
   * comparison reads — and its effort mark. No rest is started or touched, and
   * a pending undo (held by the caller) is unaffected.
   *
   * `currentExerciseIndex` stays, as for `removeSet`: editing is not logging,
   * and the row is only reachable on the exercise already on screen.
   *
   * `setId` is an ordinal: read it fresh from the store. The caller keeps the
   * Today list read-only while an edit is open, so no remove or undo can
   * renumber under it. No-op when there is no such set.
   */
  updateSet: async (exerciseId, setId, segments) => {
    const { activeWorkout } = get();
    if (!activeWorkout || segments.length === 0) return;

    let changed = false;
    const updatedExercises = activeWorkout.exercises.map((exercise) => {
      if (exercise.id !== exerciseId) return exercise;
      return {
        ...exercise,
        sets: exercise.sets.map((set) => {
          if (set.id !== setId) return set;
          changed = true;
          return { ...set, segments };
        }),
      };
    });
    if (!changed) return;

    const updatedWorkout: ActiveWorkout = {
      ...activeWorkout,
      exercises: updatedExercises,
    };

    await saveActiveWorkout(updatedWorkout);
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
    };

    await saveActiveWorkout(updatedWorkout);
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
    };

    await saveActiveWorkout(updatedWorkout);
  },

  /**
   * 🔹 Mark a set easy or hard, or clear its mark (TICKET-034).
   *
   * Written to storage at once, like every set change, so a mark survives an
   * app kill and travels with the workout into the upload queue.
   *
   * The mark lives on the set object, so a later `removeSet` / `restoreSet`
   * moves it with its set. `setId` is read fresh from the store by the caller,
   * as for `updateSet`: it is an ordinal.
   *
   * `currentExerciseIndex` stays: a mark is set from the rest panel or the
   * Today list of the exercise already on screen.
   */
  setSetEffort: async (exerciseId, setId, effort) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    let changed = false;
    const updatedExercises = activeWorkout.exercises.map((exercise) => {
      if (exercise.id !== exerciseId) return exercise;
      return {
        ...exercise,
        sets: exercise.sets.map((set) => {
          if (set.id !== setId || (set.effort ?? null) === effort) return set;
          changed = true;
          return { ...set, effort };
        }),
      };
    });
    if (!changed) return;

    // Storage first, as for every set change: if the write fails, the screen
    // must not show a mark an app kill would lose.
    const updatedWorkout: ActiveWorkout = { ...activeWorkout, exercises: updatedExercises };
    await saveActiveWorkout(updatedWorkout);
  },

  /**
   * 🔹 Point the session at the exercise the user is looking at.
   *
   * This is the only write that means "viewing". `addSetToExercise` also writes
   * `currentExerciseIndex`, as "I just logged here"; in the paged screen that is
   * always the exercise on screen, so the two agree.
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

    const updatedWorkout: ActiveWorkout = { ...activeWorkout, currentExerciseIndex: clamped };

    // Memory first so the screen moves on the tap, not after the disk write: the
    // one action that does not use `saveActiveWorkout`. Losing a page change to
    // an app kill costs nothing logged.
    set({ activeWorkout: updatedWorkout });
    await AsyncStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(updatedWorkout));
  },

  /**
   * 🔹 Swap an exercise for another, for this workout only (TICKET-047).
   *
   * Replaces the slot holding `exerciseId` in place: same position, so
   * "Exercise N of M" keeps its M, and the index in view is unchanged. The new
   * exercise brings its own id, name and fields (a catalog version's, from the
   * picker); nothing carries over, since a plan holds no targets. The plan is
   * never written.
   *
   * Refused, here and not only in the UI, when:
   * - the slot has sets. The rule reads the live count, so deleting every set
   *   makes swap available again. Swap after sets is out of scope;
   * - `exercise.id` is already in today's workout (`ALREADY_IN_WORKOUT_REASON`).
   *
   * The plan's exercise is kept in `planned` (set on the first swap, kept on a
   * second). Swapping to the planned id is swapping back: the slot is the plan's
   * exercise again and `planned` goes, whether the pick came from "Back to plan"
   * or from search.
   *
   * A rest running on the swapped slot ends: the slot can be at 0 sets with a
   * rest still counting (log set 1, then delete it), and a rest keyed to the old
   * id would hide behind the new exercise and come back on a swap back.
   *
   * History for the new id is checked here, a session moment like start and
   * resume, never by a screen (`prefetchHistory`).
   */
  swapExercise: async (exerciseId, exercise) => {
    const { activeWorkout, rest } = get();
    if (!activeWorkout) return { status: "refused", reason: "No active workout." };
    if (activeWorkout.editOf) return { status: "refused", reason: EDIT_SWAP_REASON };

    const index = activeWorkout.exercises.findIndex((ex) => ex.id === exerciseId);
    if (index === -1) return { status: "refused", reason: "That exercise is not in this workout." };
    const slot = activeWorkout.exercises[index];
    if (slot.sets.length > 0) return { status: "refused", reason: SWAP_LOCKED_REASON };
    if (exercise.id === slot.id) return { status: "refused", reason: "That is the exercise already here." };
    if (activeWorkout.exercises.some((ex) => ex.id === exercise.id)) {
      return { status: "refused", reason: ALREADY_IN_WORKOUT_REASON };
    }

    // An added slot (TICKET-056) has no plan's exercise: it stays added and
    // gets no `planned`, so the picker offers no Back to plan.
    const planned: Exercise | null = slot.added
      ? null
      : slot.planned ?? {
          id: slot.id,
          name: slot.name,
          ...(slot.nameSnapshot ? { nameSnapshot: slot.nameSnapshot } : {}),
          fields: slot.fields,
        };
    const swapped: LoggedExercise = {
      ...freshSlot(exercise.id === planned?.id ? exercise : withLastUnits(exercise), catalogIndexNow()),
      ...(planned && exercise.id !== planned.id ? { planned } : {}),
      ...(slot.added ? { added: true as const } : {}),
    };

    const updatedWorkout: ActiveWorkout = {
      ...activeWorkout,
      exercises: activeWorkout.exercises.map((ex, i) => (i === index ? swapped : ex)),
    };

    await saveActiveWorkout(updatedWorkout, rest?.exerciseId === exerciseId ? { rest: null } : {});

    prefetchHistory();
    return { status: "swapped" };
  },

  /**
   * 🔹 Change the units of an exercise's fields, for this workout only (TICKET-091).
   *
   * One edit to the slot's `fields`: a set's values are keyed by field name and
   * carry no unit (`ExerciseSet.segments`), so at any set count the logged sets
   * are relabelled, never rewritten. 8 plates × 15 reads 8 kg × 15 afterwards:
   * nothing is converted, which is the app's rule for units. Rejected: locking
   * after set 1 as Swap does; delete and re-log gives the same result with more
   * taps.
   *
   * Never written to the plan: `planned` is left as it was, so a swapped slot
   * still offers the plan's own exercise and units. Nothing here touches the
   * server; the unit reaches it with the rest of the workout at Finish.
   *
   * Refused, all or none, when the workout or exercise is missing, a name is not
   * one of the exercise's fields, the field has no unit to change (reps, a
   * unitless `other`), or the unit is not offered for the field's role (a time
   * in kg). Asking for the units a slot already has is "changed" and writes
   * nothing.
   */
  setExerciseUnits: async (exerciseId, units) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return { status: "refused", reason: "No active workout." };

    const index = activeWorkout.exercises.findIndex((ex) => ex.id === exerciseId);
    if (index === -1) return { status: "refused", reason: "That exercise is not in this workout." };
    const slot = activeWorkout.exercises[index];

    for (const [name, unit] of Object.entries(units)) {
      const field = slot.fields.find((f) => f.name === name);
      if (!field) return { status: "refused", reason: `${name} is not a field of this exercise.` };
      if (!field.unit) return { status: "refused", reason: `${name} has no unit to change.` };
      if (!unitsForRole(field.role).includes(unit)) {
        return { status: "refused", reason: `${unit} is not a unit for ${name}.` };
      }
    }

    const fields = slot.fields.map((field) =>
      Object.prototype.hasOwnProperty.call(units, field.name) ? { ...field, unit: units[field.name] } : field
    );
    if (fields.every((field, i) => field.unit === slot.fields[i].unit)) return { status: "changed" };

    const updatedWorkout: ActiveWorkout = {
      ...activeWorkout,
      exercises: activeWorkout.exercises.map((ex, i) => (i === index ? { ...ex, fields } : ex)),
    };
    await saveActiveWorkout(updatedWorkout);
    return { status: "changed" };
  },

  /**
   * 🔹 Add an exercise at the end, for this workout only (TICKET-056).
   *
   * Appended, never inserted: "Exercise N of M" grows its M and no slot before
   * it moves. The index moves to the new slot, from wherever the user was: they
   * add an exercise to do it now (a finisher, or the one a training partner
   * calls). A rest running elsewhere is left alone; it stays on its exercise,
   * as when paging. The plan is never written.
   *
   * Marked `added` in live state only (see `LoggedExercise.added`). Refused,
   * here and not only in the picker, for an id already in today's workout
   * (`ALREADY_IN_WORKOUT_REASON`).
   *
   * A wrong pick is taken out with `removeExercise` (TICKET-069), which
   * reversed 056's "no remove": Swap cannot make an exercise go away.
   *
   * History for the new id is checked here, as for a swap.
   */
  addExercise: async (exercise) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return { status: "refused", reason: "No active workout." };
    if (activeWorkout.exercises.some((ex) => ex.id === exercise.id)) {
      return { status: "refused", reason: ALREADY_IN_WORKOUT_REASON };
    }

    const exercises = [...activeWorkout.exercises, { ...freshSlot(withLastUnits(exercise), catalogIndexNow()), added: true as const }];
    const updatedWorkout: ActiveWorkout = {
      ...activeWorkout,
      exercises,
      currentExerciseIndex: exercises.length - 1,
    };

    await saveActiveWorkout(updatedWorkout);

    prefetchHistory();
    return { status: "added" };
  },

  /**
   * 🔹 Take an exercise out of today's list, for this workout only (TICKET-069).
   *
   * Only at 0 sets, refused here and not only in the menu: sets logged are work
   * done and belong in today's volume and history (user, 2026-11-05). The rule
   * reads the live count, as Swap's does, so deleting every set makes it
   * available. Rejected: removing a logged exercise after a confirm.
   *
   * Values typed but not logged go with it, with no confirm (user,
   * 2026-11-05), and Undo does not bring them back: they live in the logger,
   * which is keyed by id and remounts empty.
   *
   * Nothing stored changes: `buildSessionDocs` already drops 0-set exercises,
   * so Finish saves the same docs with or without the slot. What changes is
   * today's list: "N of M", the swipe, the progress bar. The plan is never
   * written.
   *
   * The index follows `indexAfterRemoval`: the next exercise takes the
   * removed one's place. A rest on the slot ends, as for Swap: one keyed to a
   * gone id would hide, and come back on Undo with the time gone.
   */
  removeExercise: async (exerciseId) => {
    const { activeWorkout, rest } = get();
    if (!activeWorkout) return { status: "refused", reason: "No active workout." };

    const index = activeWorkout.exercises.findIndex((ex) => ex.id === exerciseId);
    if (index === -1) return { status: "refused", reason: "That exercise is not in this workout." };
    const slot = activeWorkout.exercises[index];
    // In an edit draft a logged exercise can go, with its sets (TICKET-102): a past workout's mistake is often a whole
    // lift. Undo brings the whole slot back, sets included. Save drops the lift from the stored workout.
    if (slot.sets.length > 0 && !activeWorkout.editOf) return { status: "refused", reason: REMOVE_LOCKED_REASON };

    const exercises = activeWorkout.exercises.filter((_, i) => i !== index);
    const current = resolveCurrentIndex(activeWorkout.currentExerciseIndex, activeWorkout.exercises.length);
    const updatedWorkout: ActiveWorkout = {
      ...activeWorkout,
      exercises,
      currentExerciseIndex: indexAfterRemoval(current, index, exercises.length),
    };

    await saveActiveWorkout(updatedWorkout, rest?.exerciseId === exerciseId ? { rest: null } : {});
    return { status: "removed", removed: { slot, index } };
  },

  /**
   * 🔹 Undo a `removeExercise`: the slot goes back at its position, clamped to
   * the end, and is shown. Undo means "as it was", which includes the screen.
   * Rejected: staying on the exercise that took its place, which leaves the
   * restored one off screen.
   *
   * Refused when the id is in today's list again (removed, then added back):
   * one id per session (`ALREADY_IN_WORKOUT_REASON`). The screen offers Undo
   * only until the workout next changes, so in practice the list is as the
   * removal left it.
   */
  restoreExercise: async (removed) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return { status: "refused", reason: "No active workout." };
    if (activeWorkout.exercises.some((ex) => ex.id === removed.slot.id)) {
      return { status: "refused", reason: ALREADY_IN_WORKOUT_REASON };
    }

    const exercises = [...activeWorkout.exercises];
    const index = Math.min(removed.index, exercises.length);
    exercises.splice(index, 0, removed.slot);
    const updatedWorkout: ActiveWorkout = {
      ...activeWorkout,
      exercises,
      currentExerciseIndex: index,
    };

    await saveActiveWorkout(updatedWorkout);
    return { status: "restored" };
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
    // A draft is saved by its own action, never queued as a new workout: Finish would fold it into the summaries
    // again (bests can only rise there) and stamp it with a new end (TICKET-102).
    if (activeWorkout.editOf) return refused("This is an edit of a past workout. Use Save changes.");

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
      rest: null,
      // One entry per session: an active workout is never one already queued
      // (`loadWorkoutFromStorage` drops it).
      pendingUploads: [...state.pendingUploads, entry],
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
    set({ queuedSessionId: entry.sessionId });
    // Queue first, then clear the slot. A crash between the two leaves the
    // workout in both; `loadWorkoutFromStorage` drops the active copy.
    await AsyncStorage.removeItem(ACTIVE_WORKOUT_KEY).catch((error) =>
      console.log("Failed to clear active workout:", error)
    );

    // The user lands on this workout's Session, which says it is saved: the "Saved" toast of an upload that
    // finishes inside the wait below would say it twice (TICKET-083). One that lands later still toasts.
    landingOn.add(entry.sessionId);
    const upload = uploadPendingWorkout(entry);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const uploaded = await Promise.race([
      upload,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), UPLOAD_GRACE_MS);
      }),
    ]);
    clearTimeout(timer);
    landingOn.delete(entry.sessionId);

    if (uploaded) return { status: "uploaded", sessionId: entry.sessionId };
    if (uploaded === null) {
      // Still pending: offline, or a slow connection. The "Saved" toast
      // follows if it lands (`attemptUpload`). The history caveat is the accepted TICKET-028 gap: "last
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
    return { status: "queued", sessionId: entry.sessionId };
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
      await AsyncStorage.removeItem(ACTIVE_WORKOUT_KEY); // Remove stored workout
      set({ activeWorkout: null, rest: null });
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
    // First, before the queue is loaded or drained: an old build's queue must
    // never replay. If the clear fails, load nothing this run: carrying on would
    // replay exactly what the clear exists to drop. The marker is set only after
    // the remove succeeds, so the next launch retries. Rejected: logging and
    // continuing (the old queue then uploads into the wiped Firestore).
    try {
      await clearLocalDataFromOlderBuilds();
    } catch (error) {
      console.error(
        "LOCAL CLEAR FAILED: older build's activeWorkout and upload queue not loaded this run; retried next launch.",
        error
      );
      return;
    }
    // A queue that cannot be read must not also cost the active workout.
    await loadPendingUploads().catch((error) => console.log("Failed to load upload queue:", error));
    watchSignInForUploads();
    drainPendingUploads();

    const storedWorkout = await AsyncStorage.getItem(ACTIVE_WORKOUT_KEY);
    if (!storedWorkout) return;

    const parsed = JSON.parse(storedWorkout) as ActiveWorkout;
    const sessionId = buildSessionId(parsed.id, parsed.startTime);
    if (get().pendingUploads.some((e) => e.sessionId === sessionId)) {
      // Finished, and the app died before the slot was cleared. The queue has it.
      await AsyncStorage.removeItem(ACTIVE_WORKOUT_KEY);
      return;
    }
    set({ activeWorkout: parsed });

    prefetchHistoryOnResume(parsed.exercises.length);
  },

  /**
   * 🔹 Rest timer (TICKET-021)
   *
   * Only timestamps are stored; what is left is derived from `Date.now()` on
   * every render by `restCountdown`. Synchronous and memory only, so Skip and
   * add-time never wait on storage.
   */
  startRest: (exerciseId, durationMs, setNumber) => {
    // A set logged in an edit draft was done on another day: nothing to rest for (TICKET-102). Here, not at the
    // logger's call, so no caller can start one.
    if (get().activeWorkout?.editOf) return;
    set({ rest: { exerciseId, startedAt: Date.now(), durationMs, setNumber } });
  },

  addRestTime: () => {
    const { rest } = get();
    if (rest) set({ rest: extendRest(rest, Date.now()) });
  },

  endRest: () => {
    set({ rest: null });
  },
}));

// ---------------------------------------------------------------------------
// Upload queue (TICKET-028)
// ---------------------------------------------------------------------------

/**
 * Write the in-memory queue to disk as it is now. Rejects if this write failed.
 *
 * AsyncStorage's native side runs writes one at a time in the order they are
 * issued, so the last one issued, the latest queue, lands last. Rejected
 * (TICKET-078): a promise chain in front of it, which repeated that guarantee.
 */
async function writePendingUploads(): Promise<void> {
  await AsyncStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(useWorkoutStore.getState().pendingUploads));
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
 * Read the queue from disk, replacing memory's (TICKET-078): this runs before
 * a workout can be resumed, so nothing can be queued yet. Rejected: merging in
 * entries already in memory, which needs a Start, a set and a Finish inside
 * this one disk read.
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
  useWorkoutStore.setState({ pendingUploads: stored });
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

  const run = attemptUpload(entry).finally(() => savesInFlight.delete(entry.sessionId));
  savesInFlight.set(entry.sessionId, run);
  return run;
}

async function attemptUpload(entry: PendingUpload): Promise<boolean> {
  try {
    console.log("Uploading workout to database:", entry.sessionId);
    const saved = await saveWorkoutSession(entry.uid, entry.workout, entry.endedAt);
    if (saved.deleted === true) {
      // Deleted (here or on another phone) while it waited: the server took its docs back out and folded nothing, so
      // the phone must not hold it or say "Saved". The entry leaves the queue; nothing is left to upload.
      updateEntry(entry.sessionId, () => null);
      await writePendingUploadsOrLog();
      return true;
    }
    const { session, summaries } = saved;
    // TICKET-075: the recent workouts hold it at once, 0 reads. Before the
    // entry leaves the queue below, so no screen shows its plan without it
    // between the two (`buildPlanRows` merges the queue).
    const toasts = !landingOn.has(entry.sessionId);
    if (toasts) useWorkoutStore.setState({ toastedSessionId: entry.sessionId });
    useRecentWorkoutsStore.getState().applyFinished(entry.uid, session);
    // TICKET-076: "last time" updates at once, with no read.
    useExerciseHistoryStore.getState().applyFinished(entry.uid, summaries);
    updateEntry(entry.sessionId, () => null);
    // If this write fails the entry comes back on restart and uploads again, which is safe: same ids, the rollup folds
    // by replacement, and a workout deleted meanwhile is taken back out by `saveWorkoutSession` (TICKET-086).
    await writePendingUploadsOrLog();
    // Names the workout and its length (TICKET-066): on Finish this is the one
    // message the user gets, on the hub; for a workout queued offline it is
    // the later "it landed", so it must say which one.
    if (toasts) {
      show.success("Saved", savedSummary(entry.workout.name, entry.workout.startTime, entry.endedAt));
    }
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

/**
 * Load the saved summaries and check them for a resumed session, as
 * `startWorkout` does for a new one. History is only ever checked at session
 * moments, never by a screen.
 *
 * Restore runs once at app start, before auth has settled: `initAuth` sets the
 * user only after a session check and a server write. Checking there would
 * see no uid and silently return. So check now if the user is known, otherwise
 * on the first user to appear. Repeat calls are free — the store skips a recent
 * check and joins one running — and a failure leaves the saved copy in place.
 */
function prefetchHistoryOnResume(exerciseCount: number) {
  if (exerciseCount === 0) return;

  const prefetch = (uid: string) => void useExerciseHistoryStore.getState().open(uid);

  const uid = useAuthStore.getState().user?.uid;
  if (uid) {
    prefetch(uid);
    return;
  }

  const stop = useAuthStore.subscribe((state) => {
    const signedIn = state.user?.uid;
    if (!signedIn) return;
    stop();
    prefetch(signedIn);
  });
}

