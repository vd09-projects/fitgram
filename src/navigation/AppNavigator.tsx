// src/navigation/AppNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AuthNavigator from './AuthNavigator';
import { useAuthUser } from '../hooks/useAuthUser';
import LayoutScreen from '../screens/LayoutScreen';
import { enableScreens } from 'react-native-screens'; // ✅ Add this line

enableScreens(); // ✅ Call this before using any navigator

export default function AppNavigator() {
  const { user } = useAuthUser();

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