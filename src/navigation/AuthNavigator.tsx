// src/navigation/AuthNavigator.tsx

import React from 'react';
import { createStackNavigator, StackNavigationProp } from '@react-navigation/stack';
import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import { AuthRoutes } from '../constants/routes';

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

const Stack = createStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name={AuthRoutes.SignIn}
        component={SignInScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={AuthRoutes.SignUp}
        component={SignUpScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// ✅ Use the generic helper to avoid hardcoded strings
export type ScreenNavigationProp<T extends keyof typeof AuthRoutes> = StackNavigationProp<AuthStackParamList, T>;