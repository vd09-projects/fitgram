import React from 'react';
import { createStackNavigator, StackNavigationProp } from '@react-navigation/stack';
import WorkoutHubScreen from '../screens/workout_management/WorkoutHubScreen';
import { WorkoutRoutes } from '../constants/routes';
import StartWorkoutScreen from '../screens/workout_management/StartWorkoutScreen';
import ActiveWorkoutScreen from '../screens/workout_management/ActiveWorkoutScreen';
import AddExerciseScreen from '../screens/workout_management/AddExerciseScreen';
import WorkoutLogsScreen from '../screens/workout_management/WorkoutLogsScreen';
// TEMPORARY — remove with ExerciseHistoryDebugScreen.
import ExerciseHistoryDebugScreen from '../screens/workout_management/ExerciseHistoryDebugScreen';
// TEMPORARY — remove with PendingUploadsDebugScreen.
import PendingUploadsDebugScreen from '../screens/workout_management/PendingUploadsDebugScreen';
import { useThemeTokens } from '../components/app_manager/ThemeContext';
import { showDebugScreens } from '../config/envConfig';

export type WorkoutStackParamList = {
  WorkoutLogs: undefined;
  AddExercise: undefined;
  StartWorkout: undefined;
  WorkoutHome: undefined;
  LogWorkout: undefined;
  HistoryDebug: undefined;
  PendingUploadsDebug: undefined;
};

const Stack = createStackNavigator<WorkoutStackParamList>();

// Every Workout screen is in this stack at most once. With a `getId`, the
// router's `navigate` moves an existing copy of the screen to the top (same
// key, still mounted, state kept) instead of pushing another copy; React
// Navigation 7 pushes otherwise, so loops like Workout home → Start → Log →
// Workout grew the stack by two screens per loop, every copy mounted. Moving
// keeps the visit order, so back retraces where the user has been (the
// same rule as the Layout tabs, LayoutScreen `openTab`).
// Rejected: `navigate(name, { pop: true })` at each call site, which goes back
// to the existing copy and drops everything above it from the history.
const singleCopy = () => 'single';

export default function WorkoutNavigator() {
  const t = useThemeTokens();
  return (
    <Stack.Navigator
      id={undefined}
      initialRouteName={WorkoutRoutes.WorkoutHome}
      screenOptions={{
        headerStyle: { backgroundColor: t.colors.primary },
        headerTintColor: t.colors.textSecondary,
        headerTitleStyle: { fontSize: 18, fontWeight: 'bold' }
      }}
    >
      <Stack.Screen
        name={WorkoutRoutes.WorkoutLogs}
        getId={singleCopy}
        component={WorkoutLogsScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name={WorkoutRoutes.WorkoutHome}
        getId={singleCopy}
        component={WorkoutHubScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name={WorkoutRoutes.StartWorkout}
        getId={singleCopy}
        component={StartWorkoutScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name={WorkoutRoutes.AddExercise}
        getId={singleCopy}
        component={AddExerciseScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name={WorkoutRoutes.LogWorkout}
        getId={singleCopy}
        component={ActiveWorkoutScreen}
        options={{ headerShown: false }}
      />

      {/* Debug screens: registered only when the flag is on, so a build
          without it has no route to them. */}
      {showDebugScreens && (
        <>
          {/* TEMPORARY — remove with ExerciseHistoryDebugScreen. */}
          <Stack.Screen
            name={WorkoutRoutes.HistoryDebug}
            getId={singleCopy}
            component={ExerciseHistoryDebugScreen}
            options={{ headerShown: false }}
          />

          {/* TEMPORARY — remove with PendingUploadsDebugScreen. */}
          <Stack.Screen
            name={WorkoutRoutes.PendingUploadsDebug}
            getId={singleCopy}
            component={PendingUploadsDebugScreen}
            options={{ headerShown: false }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export type WorkoutScreenNavigationProp<T extends keyof typeof WorkoutRoutes> = StackNavigationProp<WorkoutStackParamList, T>;