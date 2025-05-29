import { StyleSheet, Text, View } from 'react-native';
import * as Font from 'expo-font';
import AppNavigator from './src/navigation/AppNavigator';
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/constants/toastConfig';
import { useEffect, useState } from 'react';
import { FONT_FAMILY } from './src/constants/styles';
import { useColorSchemaStore } from './src/stores/colorSchemaStore';

export default function App() {
  const [fontLoaded, setFontLoaded] = useState(false);
  const isLoaded = useColorSchemaStore((s) => s.isLoaded);
  const loadFromStorage = useColorSchemaStore((s) => s.loadFromStorage);

  useEffect(() => {
    Font.loadAsync({
      [FONT_FAMILY.regular.name]: FONT_FAMILY.regular.path,
      [FONT_FAMILY.bold.name]: FONT_FAMILY.bold.path,
    }).then(() => setFontLoaded(true));

    loadFromStorage();
  }, []);

  if (!fontLoaded) return null;
  if (!isLoaded) return null;

  return (
    <>
      <AppNavigator />
      <Toast config={toastConfig} />
    </>
  );
}
