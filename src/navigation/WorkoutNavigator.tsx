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
import HistoryHomeScreen from '../screens/workout_management/HistoryHomeScreen';
import SessionScreen from '../screens/workout_management/SessionScreen';
import ExerciseScreen from '../screens/workout_management/ExerciseScreen';
// Debug tooling, kept (TICKET-070): PlansStoreDebugScreen.
import PlansStoreDebugScreen from '../screens/workout_management/PlansStoreDebugScreen';
import { useThemeTokens } from '../components/app_manager/ThemeContext';
import { showDebugScreens } from '../config/envConfig';

export type WorkoutStackParamList = {
  WorkoutLogs: undefined;
  AddExercise: undefined;
  StartWorkout: undefined;
  WorkoutHome: undefined;
  LogWorkout: undefined;
  HistoryDebug: undefined;
  HistoryHome: undefined;
  /** `finished`: opened by Finish, so the screen says "Workout saved" once the workout is on the server (TICKET-083). */
  Session: { sessionId: string; workoutName: string; startedAt: number; finished?: true };
  Exercise: { exerciseId: string; exerciseName: string };
  PlansStoreDebug: undefined;
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

      <Stack.Screen
        name={WorkoutRoutes.HistoryHome}
        getId={singleCopy}
        component={HistoryHomeScreen}
        options={{ headerShown: false }}
      />

      {/* Own id per session: `singleCopy` would move the one Session to the top instead of opening
          another, so a workout opened from a workout would replace the first one's state. */}
      <Stack.Screen
        name={WorkoutRoutes.Session}
        getId={({ params }) => params.sessionId}
        component={SessionScreen}
        options={{ headerShown: false }}
      />

      {/* Own id per exercise, as the Session's: a lift opened from a Session of another lift must not move the first. */}
      <Stack.Screen
        name={WorkoutRoutes.Exercise}
        getId={({ params }) => params.exerciseId}
        component={ExerciseScreen}
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

          {/* Debug tooling, kept (TICKET-070): PlansStoreDebugScreen. */}
          <Stack.Screen
            name={WorkoutRoutes.PlansStoreDebug}
            getId={singleCopy}
            component={PlansStoreDebugScreen}
            options={{ headerShown: false }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export type WorkoutScreenNavigationProp<T extends keyof typeof WorkoutRoutes> = StackNavigationProp<WorkoutStackParamList, T>;