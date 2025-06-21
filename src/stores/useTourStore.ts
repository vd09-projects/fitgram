import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SEEN_TOURS_KEY = 'seen_tours_key';

type TourStore = {
  isTourActive: boolean;
  currentStepId: string | null;
  currentTourId: string | null;
  seenTours: Record<string, boolean>;
  isLoaded: boolean;

  loadSeenTours: () => Promise<void>;
  markTourSeen: (tourId: string) => Promise<void>;
  resetTourSeen: (tourId: string) => Promise<void>;

  setIsTourActive: (val: boolean) => void;
  setCurrentStepId: (val: string | null) => void;
  setCurrentTourId: (val: string | null) => void;
  hasSeenTour: (tourId: string) => boolean;

  reset: () => void;
};

export const useTourStore = create<TourStore>((set, get) => ({
  isTourActive: false,
  currentStepId: null,
  currentTourId: null,
  seenTours: {},
  isLoaded: false,

  loadSeenTours: async () => {
    try {
      const stored = await AsyncStorage.getItem(SEEN_TOURS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        set({ seenTours: parsed, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch (error) {
      console.warn('Failed to load tour seen state', error);
      set({ isLoaded: true });
    }
  },

  markTourSeen: async (tourId: string) => {
    const current = { ...get().seenTours, [tourId]: true };
    set({ seenTours: current });
    try {
      await AsyncStorage.setItem(SEEN_TOURS_KEY, JSON.stringify(current));
    } catch (error) {
      console.warn('Failed to save tour seen state', error);
    }
  },

  resetTourSeen: async (tourId: string) => {
    const current = { ...get().seenTours };
    delete current[tourId];
    set({ seenTours: current });
    try {
      await AsyncStorage.setItem(SEEN_TOURS_KEY, JSON.stringify(current));
    } catch (error) {
      console.warn('Failed to reset tour seen state', error);
    }
  },

  hasSeenTour: (tourId: string) => {
    return !!get().seenTours[tourId];
  },

  setIsTourActive: (val) => set({ isTourActive: val }),
  setCurrentStepId: (val) => set({ currentStepId: val }),
  setCurrentTourId: (val) => set({ currentTourId: val }),

  reset: () => {
    set({
      isTourActive: false,
      currentStepId: null,
      currentTourId: null,
      seenTours: {},
    });
    AsyncStorage.removeItem(SEEN_TOURS_KEY).catch(() =>
      console.warn('Failed to clear tour seen state')
    );
  },
}));