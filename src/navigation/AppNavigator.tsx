// src/navigation/AppNavigator.tsx (simplified)
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AuthNavigator from './AuthNavigator';
import { useAuthUser } from '../hooks/useAuthUser';
import LayoutScreen from '../screens/LayoutScreen';

export default function AppNavigator() {
  const { user } = useAuthUser();

  return (
    <NavigationContainer>
      {/* <AuthNavigator /> */}
      {user ? (
        // If user is logged in, show the new Layout with tabs
        <LayoutScreen />
      ) : (
        // Otherwise show sign-in / sign-up flow
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}