import { useKeyboardStore } from '../stores/keyboardStore';
import { Keyboard } from 'react-native';

let isInitialized = false; // Singleton flag to prevent multiple initializations

export function useKeyboardVisibility() {
  const { isKeyboardVisible, setKeyboardVisible } = useKeyboardStore();

  // Prevent `useEffect` from even running if already initialized
  if (!isInitialized) {
    isInitialized = true; // Mark as initialized

    Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
  }

  return isKeyboardVisible; // Return current keyboard state
}