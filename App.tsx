import { StyleSheet, Text, View } from 'react-native';
import * as Font from 'expo-font';
import AppNavigator from './src/navigation/AppNavigator';
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/constants/toastConfig';
import { useEffect, useState } from 'react';
import { FONT_FAMILY } from './src/constants/styles';

export default function App() {
  const [fontLoaded, setFontLoaded] = useState(false);

  useEffect(() => {
    Font.loadAsync({
      [FONT_FAMILY.regular.name]: FONT_FAMILY.regular.path,
      [FONT_FAMILY.bold.name]: FONT_FAMILY.bold.path,
    }).then(() => setFontLoaded(true));
  }, []);

  if (!fontLoaded) return null;

  return (
    <>
      <AppNavigator />
      <Toast config={toastConfig} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
