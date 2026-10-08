// src/stores/useExerciseHistoryStore.ts
//
// Session-lifetime cache of exercise history, keyed by **exerciseId**.
//
// Keyed by exercise, not workout, because that is the question being asked: the
// last bench press is the last bench press in any plan. A plan's whole history
// is one batched query of one document per exercise, so one prefetch at workout
// start serves every reader and nothing a reader does can trigger a read.
//
// Writers: `prefetchExerciseHistory` (called from `startWorkout`) and
// `invalidateExercises` (called after a workout is saved).
// Readers: `useExerciseHistory`, which only selects state.

import { create } from "zustand";
import { getExerciseStats } from "../services/db/workoutSessions";
import { ExerciseHistoryEntry } from "../types/exerciseHistory";

type PrefetchOptions = {
  /** Refetch even for exercises already cached as ready. Default false. */
  force?: boolean;
};

interface ExerciseHistoryStoreState {
  /** exerciseId -> cached rollup. */
  entries: Record<string, ExerciseHistoryEntry>;
  /**
   * Firestore history fetches issued this app session. Instrumentation for the
   * one claim this cache exists to make: starting a workout costs one fetch and
   * no reader costs another. `src/scripts/verifyHistoryReads.ts` asserts on it.
   */
  fetchCount: number;

  prefetchExerciseHistory: (
    userId: string | undefined,
    exerciseIds: string[] | undefined,
    options?: PrefetchOptions
  ) => Promise<void>;
  invalidateExercises: (exerciseIds: string[] | undefined) => void;
  clearExerciseHistory: () => void;
}

const emptyEntry = (exerciseId: string): ExerciseHistoryEntry => ({
  exerciseId,
  status: "idle",
  stats: null,
  fetchedAt: null,
  error: null,
});

/**
 * In-flight fetches per exercise, outside the store so overlapping callers await
 * the existing promise instead of issuing a second read.
 */
const inFlight = new Map<string, Promise<void>>();

export const useExerciseHistoryStore = create<ExerciseHistoryStoreState>(
  (set, get) => ({
    entries: {},
    fetchCount: 0,

    /**
     * Fetch history for a batch of exercises once. Never throws and never
     * rejects: history is an enhancement on the logging flow, so a failure must
     * not surface as a rejection to a caller that is mid-`startWorkout`.
     */
    prefetchExerciseHistory: async (userId, exerciseIds, options) => {
      if (!userId || !exerciseIds || exerciseIds.length === 0) return;

      const force = options?.force ?? false;
      const unique = [...new Set(exerciseIds.filter(Boolean))];
      const entries = get().entries;

      const awaited: Promise<void>[] = [];
      const toFetch: string[] = [];

      for (const id of unique) {
        const pending = inFlight.get(id);
        if (pending && !force) {
          awaited.push(pending);
          continue;
        }
        // Cached for the app session. `error` and `idle` are retried.
        if (!force && entries[id]?.status === "ready") continue;
        toFetch.push(id);
      }

      if (toFetch.length === 0) {
        await Promise.all(awaited);
        return;
      }

      const run = (async () => {
        set((state) => {
          const next = { ...state.entries };
          for (const id of toFetch) {
            next[id] = { ...(next[id] ?? emptyEntry(id)), status: "loading" };
          }
          return { entries: next, fetchCount: state.fetchCount + 1 };
        });

        try {
          const stats = await getExerciseStats(userId, toFetch);
          const fetchedAt = Date.now();
          set((state) => {
            const next = { ...state.entries };
            for (const id of toFetch) {
              next[id] = {
                exerciseId: id,
                status: "ready",
                // null is the no-history path: never performed, not an error.
                stats: stats[id] ?? null,
                fetchedAt,
                error: null,
              };
            }
            return { entries: next };
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          set((state) => {
            const next = { ...state.entries };
            for (const id of toFetch) {
              const base = next[id] ?? emptyEntry(id);
              next[id] = {
                ...base,
                // Offline: keep serving whatever was already cached.
                status: base.stats ? "ready" : "error",
                error: message,
              };
            }
            return { entries: next };
          });
        }
      })();

      for (const id of toFetch) inFlight.set(id, run);
      try {
        await Promise.all([run, ...awaited]);
      } finally {
        for (const id of toFetch) {
          if (inFlight.get(id) === run) inFlight.delete(id);
        }
      }
    },

    /** Drop cached history so the next prefetch refetches it. */
    invalidateExercises: (exerciseIds) => {
      if (!exerciseIds || exerciseIds.length === 0) return;
      for (const id of exerciseIds) inFlight.delete(id);
      set((state) => {
        const next = { ...state.entries };
        let changed = false;
        for (const id of exerciseIds) {
          if (next[id]) {
            delete next[id];
            changed = true;
          }
        }
        return changed ? { entries: next } : state;
      });
    },

    clearExerciseHistory: () => {
      inFlight.clear();
      set({ entries: {} });
    },
  })
);
