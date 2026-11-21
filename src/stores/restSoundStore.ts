import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import show from '../utils/toastUtils';
import { DEFAULT_REST_SOUND, REST_SOUNDS, RestSound } from '../config/restNotification';
import { REST_SOUND_KEY } from '../config/storageKeys';

/**
 * The sound that plays when a rest ends (TICKET-098): one global preference, set once and used by every
 * rest. Its own store, not `restPreferenceStore`: that one is about the duration, and the two have
 * nothing else in common. Same shape as it: loaded once at app start, persisted on set.
 */
interface RestSoundStore {
  restSound: RestSound;
  isLoaded: boolean;
  setRestSound: (sound: RestSound) => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

/** A stored name that is not one of the known sounds is corrupt (or from a build that had more), not a choice. */
export function isRestSound(value: unknown): value is RestSound {
  return typeof value === 'string' && (REST_SOUNDS as readonly string[]).includes(value);
}

export const useRestSoundStore = create<RestSoundStore>((set) => ({
  restSound: DEFAULT_REST_SOUND,
  isLoaded: false,

  // A missing or unreadable value keeps the default; nothing waits on this.
  loadFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem(REST_SOUND_KEY);
      set(isRestSound(stored) ? { restSound: stored, isLoaded: true } : { isLoaded: true });
    } catch (error) {
      set({ isLoaded: true });
    }
  },

  setRestSound: async (sound) => {
    if (!isRestSound(sound)) return;
    try {
      await AsyncStorage.setItem(REST_SOUND_KEY, sound);
      set({ restSound: sound });
    } catch (error) {
      show.alert('Error saving rest sound', 'Failed to save the sound to storage.');
    }
  },
}));
