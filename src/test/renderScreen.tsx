// src/test/renderScreen.tsx
//
// The one way to render a screen in a test. How to use it: src/test/README.md.
//
// Supplies what every screen needs and nothing it should not have:
// - The providers that crash without a parent: ThemeProvider (useThemeTokens
//   throws) and TourGuideProvider (useTour() defaults to `{}`, so the first
//   method call is "undefined is not a function").
// - A real NavigationContainer, so a navigation call is judged by where it
//   lands, not by its arguments. The screen under test is the only route in
//   its stack, with stubs for every other Layout route and a nested stub
//   Workout stack. See `RouteStub`.
// - Store state: workout, exercise history and auth are reset on every call,
//   then seeded from the options. Zustand stores are module singletons and
//   otherwise carry state from one test into the next.
//
// Deliberately left out:
// - AppControlProvider. Nothing consumes `useAppControl`, and its mount effect
//   calls `loadWorkoutFromStorage()`, which would race the seeded workout. Add
//   it here only if a screen starts reading it, and clear storage first.
// - Firebase. Auth is seeded `initialized: true`, so `useAuthUser` never calls
//   `initAuthIfNeeded`. Store actions that write to Firestore are replaced per
//   test through `workoutActions` when a test needs to observe them.

import React from "react";
import { Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { render, RenderResult } from "@testing-library/react-native";
import type { User } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider } from "../components/app_manager/ThemeContext";
import { TourGuideProvider } from "../components/guide_tour/TourGuideProvider";
import { LayoutRoutes, WorkoutRoutes } from "../constants/routes";
import { useWorkoutStore } from "../stores/useWorkoutStore";
import { useExerciseHistoryStore } from "../stores/useExerciseHistoryStore";
import { useAuthStore } from "../stores/authStore";
import { ActiveWorkout } from "../types/zustandWorkoutType";
import { ExerciseStatsDoc } from "../types/workoutSession";

type WorkoutState = ReturnType<typeof useWorkoutStore.getState>;
type LayoutRouteName = (typeof LayoutRoutes)[keyof typeof LayoutRoutes];

export type RenderScreenOptions = {
  /** The active workout, or null for none. Default null. */
  workout?: ActiveWorkout | null;
  /**
   * Replace store actions with test doubles, e.g. `{ endWorkout: jest.fn() }`.
   * Anything not listed keeps its real implementation, so a test that checks
   * `currentExerciseIndex` moving uses the real `setCurrentExerciseIndex`.
   */
  workoutActions?: Partial<Omit<WorkoutState, "activeWorkout">>;
  /**
   * Cached history per exercise id, seeded as `status: "ready"`. `null` means
   * fetched and the exercise has never been done. An exercise not listed is
   * `idle` (never prefetched), which is the default for every exercise.
   */
  history?: Record<string, ExerciseStatsDoc | null>;
  /** Signed-in user. Default `{ uid: "test-user" }`; null for signed out. */
  user?: Pick<User, "uid"> | null;
  /** Route the screen is registered under. Default `LogWorkout`. */
  route?: LayoutRouteName;
};

export const TEST_USER_ID = "test-user";

const workoutInitial = useWorkoutStore.getInitialState();
const historyInitial = useExerciseHistoryStore.getInitialState();
const authInitial = useAuthStore.getInitialState();

/**
 * Put every store back to its initial state and empty AsyncStorage.
 * `renderScreen` calls this itself; call it directly only in a test that
 * touches a store without rendering.
 */
export function resetStores() {
  useWorkoutStore.setState(workoutInitial, true);
  useExerciseHistoryStore.setState(historyInitial, true);
  useAuthStore.setState(authInitial, true);
  AsyncStorage.clear();
}

/**
 * Stands in for every route other than the screen under test. Renders its own
 * route path as text, so a test asserts where navigation went with
 * `screen.getByText("route:Workout/WorkoutHome")`. A navigation to a route that
 * does not exist lands nowhere, and that assertion fails.
 */
function RouteStub({ route }: { route: { name: string } }) {
  return <Text>{`route:${route.name}`}</Text>;
}

const LayoutStack = createStackNavigator();
const WorkoutStack = createStackNavigator();

function WorkoutStackStub() {
  return (
    <WorkoutStack.Navigator id={undefined} screenOptions={{ headerShown: false }}>
      {Object.values(WorkoutRoutes).map((name) => (
        <WorkoutStack.Screen key={name} name={name}>
          {() => <Text>{`route:${LayoutRoutes.Workout}/${name}`}</Text>}
        </WorkoutStack.Screen>
      ))}
    </WorkoutStack.Navigator>
  );
}

export function renderScreen(
  Screen: React.ComponentType<any>,
  options: RenderScreenOptions = {}
): RenderResult {
  const { workout = null, workoutActions, history, user, route = LayoutRoutes.LogWorkout } = options;

  resetStores();
  useWorkoutStore.setState({ activeWorkout: workout, ...workoutActions });
  useAuthStore.setState({
    user: (user === undefined ? { uid: TEST_USER_ID } : user) as User | null,
    initialized: true,
  });
  if (history) {
    useExerciseHistoryStore.setState({
      entries: Object.fromEntries(
        Object.entries(history).map(([exerciseId, stats]) => [
          exerciseId,
          { exerciseId, status: "ready" as const, stats, fetchedAt: 0, error: null },
        ])
      ),
    });
  }

  // The screen under test is the initial and only route on the stack, as when
  // it is opened from the footer: nothing is behind it, so `canGoBack()` is false.
  const otherRoutes = Object.values(LayoutRoutes).filter(
    (name) => name !== route && name !== LayoutRoutes.Workout
  );

  return render(
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <ThemeProvider>
          <TourGuideProvider>
            <NavigationContainer>
              <LayoutStack.Navigator
                id={undefined}
                initialRouteName={route}
                screenOptions={{ headerShown: false }}
              >
                <LayoutStack.Screen name={route} component={Screen} />
                {route !== LayoutRoutes.Workout && (
                  <LayoutStack.Screen name={LayoutRoutes.Workout} component={WorkoutStackStub} />
                )}
                {otherRoutes.map((name) => (
                  <LayoutStack.Screen key={name} name={name} component={RouteStub} />
                ))}
              </LayoutStack.Navigator>
            </NavigationContainer>
          </TourGuideProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
