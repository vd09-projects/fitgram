import React from 'react';
import { createStackNavigator, StackNavigationProp } from '@react-navigation/stack';
import WorkoutScreen from '../screens/WorkoutScreen';
import { WorkoutRoutes } from '../constants/routes';
import StartWorkoutScreen from '../screens/workout_management/StartWorkoutScreen';
import ActiveWorkoutScreen from '../screens/workout_management/ActiveWorkoutScreen';
import AddExerciseScreen from '../screens/workout_management/AddExerciseScreen';
import WorkoutLogsScreen from '../screens/workout_management/WorkoutLogsScreen';
import { useThemeTokens } from '../components/ThemeContext';

export type WorkoutStackParamList = {
  WorkoutLogs: undefined;
  AddExercise: undefined;
  StartWorkout: undefined;
  WorkoutHome: undefined;
  LogWorkout: undefined;
};

const Stack = createStackNavigator<WorkoutStackParamList>();

export default function WorkoutNavigator() {
  const t = useThemeTokens();
  return (
    <Stack.Navigator
      initialRouteName={WorkoutRoutes.WorkoutHome}
      screenOptions={{
        headerStyle: { backgroundColor: t.colors.primary },
        headerTintColor: t.colors.textSecondary,
        headerTitleStyle: { fontSize: 18, fontWeight: 'bold' }
      }}
    >
      <Stack.Screen
        name={WorkoutRoutes.WorkoutLogs}
        component={WorkoutLogsScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name={WorkoutRoutes.WorkoutHome}
        component={WorkoutScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name={WorkoutRoutes.StartWorkout}
        component={StartWorkoutScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name={WorkoutRoutes.AddExercise}
        component={AddExerciseScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name={WorkoutRoutes.LogWorkout}
        component={ActiveWorkoutScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

export type WorkoutScreenNavigationProp<T extends keyof typeof WorkoutRoutes> = StackNavigationProp<WorkoutStackParamList, T>;