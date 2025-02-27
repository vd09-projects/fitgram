import React from 'react';
import { createStackNavigator, StackNavigationProp } from '@react-navigation/stack';
import FeedScreen from '../screens/FeedScreen';
import WorkoutScreen from '../screens/WorkoutScreen';
import { LayoutRoutes } from '../constants/routes';
import HomeScreen from '../screens/HomeScreen';

export type LayoutStackParamList = {
  Feed: undefined;
  Workout: undefined;
  Home: undefined;
};

const Stack = createStackNavigator<LayoutStackParamList>();

export default function LayoutNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name={LayoutRoutes.Feed}
        component={FeedScreen}
        options={{ headerShown: false }} />

      <Stack.Screen
        name={LayoutRoutes.Workout}
        component={WorkoutScreen}
        options={{ headerShown: false }} />
        
      <Stack.Screen
        name={LayoutRoutes.Home}
        component={HomeScreen}
        options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

export type LayoutScreenNavigationProp<T extends keyof typeof LayoutRoutes> = StackNavigationProp<LayoutStackParamList, T>;
