// App.tsx
import { AppState, StyleSheet, Text, View } from 'react-native';
import * as Font from 'expo-font';
import AppNavigator from './src/navigation/AppNavigator';
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/constants/toastConfig';
import { useEffect, useRef, useState } from 'react';
import { FONT_FAMILY } from './src/constants/styles';
import { useColorSchemaStore } from './src/stores/colorSchemaStore';
import { ThemeProvider } from './src/components/app_manager/ThemeContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TourGuideProvider } from './src/components/guide_tour/TourGuideProvider';
import { TooltipOverlay } from './src/components/guide_tour/TourStepOverlay';
import { AppControlProvider } from './src/components/app_manager/AppControlProvider';
import { refreshLastActive } from './src/services/initAuth';

export default function App() {
  const [fontLoaded, setFontLoaded] = useState(false);
  const isLoaded = useColorSchemaStore((s) => s.isLoaded);
  const loadFromStorage = useColorSchemaStore((s) => s.loadFromStorage);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    Font.loadAsync({
      [FONT_FAMILY.regular.name]: FONT_FAMILY.regular.path,
      [FONT_FAMILY.bold.name]: FONT_FAMILY.bold.path,
    }).then(() => setFontLoaded(true));

    loadFromStorage();

    // Update last-active timestamp each time the user brings the app to foreground
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        refreshLastActive();
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, []);

  if (!fontLoaded) return null;
  if (!isLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppControlProvider>
        <ThemeProvider>
          <TourGuideProvider>
            <AppNavigator />
            <Toast config={toastConfig} />
            <TooltipOverlay />
          </TourGuideProvider>
        </ThemeProvider>
      </AppControlProvider>
    </GestureHandlerRootView>
  );
}