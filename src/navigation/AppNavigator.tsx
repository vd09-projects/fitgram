// src/navigation/AppNavigator.tsx
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AuthNavigator from './AuthNavigator';
import { useAuthUser } from '../hooks/useAuthUser';
import LayoutScreen from '../screens/LayoutScreen';
import { enableScreens } from 'react-native-screens';
import { TextBase } from '../components/TextBase';
import { useColorSchemaStore } from '../stores/colorSchemaStore';

enableScreens();

export default function AppNavigator() {
  const { user, initialized } = useAuthUser();
  const schema = useColorSchemaStore((s) => s.schema);
  const bg = schema?.primary ?? '#1A1D1A';
  const textColor = schema?.textPrimary ?? '#DAD3C9';
  const spinnerColor = schema?.button ?? '#436671';

  if (!initialized) {
    return (
      <View style={[styles.splash, { backgroundColor: bg }]}>
        <TextBase style={[styles.title, { color: textColor }]}>Fitgram</TextBase>
        <ActivityIndicator size="small" color={spinnerColor} style={styles.spinner} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? (
        <LayoutScreen />
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  spinner: {
    marginTop: 20,
  },
});