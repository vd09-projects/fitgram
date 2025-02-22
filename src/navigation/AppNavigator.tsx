// src/navigation/AppNavigator.tsx (simplified)
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AuthNavigator from './AuthNavigator';

export default function AppNavigator() {

  return (
    <NavigationContainer>
      <AuthNavigator />
      {/* {user ? (
        // If user is logged in, show the new Layout with tabs
        <LayoutScreen />
      ) : (
        // Otherwise show sign-in / sign-up flow
        <AuthNavigator />
      )} */}
    </NavigationContainer>
  );
}