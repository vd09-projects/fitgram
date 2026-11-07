import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AllColorSchemas, ColorSchemaKeyType, DefaultColorSchema } from '../constants/colors';
import show from '../utils/toastUtils';
import { COLOR_SCHEMA_KEY } from '../config/storageKeys';

interface ColorSchemaStore {
  currentColorSchema: ColorSchemaKeyType;
  isLoaded: boolean;
  setCurrentColorSchema: (name: ColorSchemaKeyType) => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

// COLOR_SCHEMA_KEY: value and reason in src/config/storageKeys.ts.

export const useColorSchemaStore = create<ColorSchemaStore>((set, get) => ({
  currentColorSchema: DefaultColorSchema,
  isLoaded: false,

  // Load from AsyncStorage on app start (disk read only once)
  loadFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem(COLOR_SCHEMA_KEY);
      if (stored && stored in AllColorSchemas) {
        set({ currentColorSchema: stored as ColorSchemaKeyType, isLoaded: true });
      } else {
        set({ isLoaded: true }); // fallback to default schema
      }
    } catch (error) {
      show.alert('Error loading theme', 'Failed to load color schema from storage.');
      set({ isLoaded: true }); // fail gracefully
    }
  },

  // Update in-memory and persist to disk
  setCurrentColorSchema: async (name) => {
    try {
      await AsyncStorage.setItem(COLOR_SCHEMA_KEY, name);
      set({ currentColorSchema: name });
    } catch (error) {
      show.alert('Error saving theme', 'Failed to save color schema to storage.');
    }
  },
}));