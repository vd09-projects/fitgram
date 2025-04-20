import React from 'react';
import { createStackNavigator, StackNavigationProp } from '@react-navigation/stack';
import FeedScreen from '../screens/FeedScreen';
import { LayoutRoutes } from '../constants/routes';
import HomeScreen from '../screens/HomeScreen';
import WorkoutNavigator from './WorkoutNavigator';  // ✅ Import WorkoutNavigator
import ActiveWorkoutScreen from '../screens/ActiveWorkoutScreen';

export type LayoutStackParamList = {
  Feed: undefined;
  Workout: undefined;
  Home: undefined;
  LogWorkout: undefined;
};

const Stack = createStackNavigator<LayoutStackParamList>();

export default function LayoutNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name={LayoutRoutes.Feed}
        component={FeedScreen}
        options={{ headerShown: false }} />

      {/* ✅ Replace direct WorkoutScreen navigation with WorkoutNavigator */}
      <Stack.Screen
        name={LayoutRoutes.Workout}
        component={WorkoutNavigator}  
        options={{ headerShown: false }} />
        
        <Stack.Screen
        name={LayoutRoutes.Home}
        component={HomeScreen}
        options={{ headerShown: false }} />

<Stack.Screen
        name={LayoutRoutes.LogWorkout}
        component={ActiveWorkoutScreen}
        options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

export type LayoutScreenNavigationProp<T extends keyof typeof LayoutRoutes> = StackNavigationProp<LayoutStackParamList, T>;