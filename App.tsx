import { StyleSheet, Text, View } from 'react-native';
import * as Font from 'expo-font';
import AppNavigator from './src/navigation/AppNavigator';
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/constants/toastConfig';
import { useEffect, useState } from 'react';

export default function App() {
  const [fontLoaded, setFontLoaded] = useState(false);

  useEffect(() => {
    Font.loadAsync({
      'ComicRelief': require('./assets/fonts/ComicRelief-Regular.ttf'),
      'ComicReliefBold': require('./assets/fonts/ComicRelief-Bold.ttf'),
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
