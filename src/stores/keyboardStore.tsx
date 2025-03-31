import { create } from 'zustand';

// Zustand store for keyboard state
interface KeyboardState {
  isKeyboardVisible: boolean;
  setKeyboardVisible: (visible: boolean) => void;
}

// Create Zustand store
export const useKeyboardStore = create<KeyboardState>((set) => ({
  isKeyboardVisible: false,
  setKeyboardVisible: (visible) => set({ isKeyboardVisible: visible }),
}));