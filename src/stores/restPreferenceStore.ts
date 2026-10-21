import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_REST_MS } from '../utils/restTimer';
import show from '../utils/toastUtils';

/**
 * How long to rest between sets — one global preference (TICKET-021, Phase 3
 * open decision 1).
 *
 * Global, not per exercise. Chosen because a per-exercise value added later
 * falls back to this one, so starting global costs nothing to undo; per
 * exercise drags in `ExerciseFieldEditor`, the catalogue seed and its own UI.
 * The per-exercise version is TICKET-038.
 *
 * Its own store, not `useWorkoutStore`: this is a preference that outlives
 * every session. The running timer is session state and lives there.
 * Same shape as `colorSchemaStore`: loaded once at app start, persisted on set.
 */
interface RestPreferenceStore {
  restDurationMs: number;
  isLoaded: boolean;
  setRestDurationMs: (ms: number) => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

const REST_DURATION_KEY = 'rest_duration_ms';

/** 5 s to 30 min. Anything outside is a corrupt value, not a preference. */
export function isValidRestDuration(ms: unknown): ms is number {
  return typeof ms === 'number' && Number.isInteger(ms) && ms >= 5_000 && ms <= 30 * 60_000;
}

export const useRestPreferenceStore = create<RestPreferenceStore>((set) => ({
  restDurationMs: DEFAULT_REST_MS,
  isLoaded: false,

  // Load from AsyncStorage on app start (disk read only once). A missing or
  // unreadable value keeps the default; nothing waits on this.
  loadFromStorage: async () => {
    try {
      const stored = Number(await AsyncStorage.getItem(REST_DURATION_KEY));
      set(isValidRestDuration(stored) ? { restDurationMs: stored, isLoaded: true } : { isLoaded: true });
    } catch (error) {
      set({ isLoaded: true }); // fail gracefully: the default still works
    }
  },

  // Update in-memory and persist to disk
  setRestDurationMs: async (ms) => {
    if (!isValidRestDuration(ms)) return;
    try {
      await AsyncStorage.setItem(REST_DURATION_KEY, String(ms));
      set({ restDurationMs: ms });
    } catch (error) {
      show.alert('Error saving rest time', 'Failed to save rest duration to storage.');
    }
  },
}));
