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
import { useRestPreferenceStore } from "../stores/restPreferenceStore";
import { useCatalogStore } from "../stores/useCatalogStore";
import { usePlansStore } from "../stores/usePlansStore";
import { useRecentWorkoutsStore } from "../stores/useRecentWorkoutsStore";
import { ActiveWorkout } from "../types/zustandWorkoutType";
import { ExerciseStatsDoc } from "../types/workoutSession";

type WorkoutState = ReturnType<typeof useWorkoutStore.getState>;
type LayoutRouteName = (typeof LayoutRoutes)[keyof typeof LayoutRoutes];
type WorkoutRouteName = (typeof WorkoutRoutes)[keyof typeof WorkoutRoutes];

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
   * Saved summary per exercise id, seeded as after a successful check. `null`
   * means the exercise has never been done, and so does not listing it: both
   * are "ready, none". Leave `history` out for an unloaded store, where every
   * exercise is `idle`.
   */
  history?: Record<string, ExerciseStatsDoc | null>;
  /** Signed-in user. Default `{ uid: "test-user" }`; null for signed out. */
  user?: Pick<User, "uid"> | null;
  /** Route the screen is registered under. Default `LogWorkout`. */
  route?: LayoutRouteName;
  /**
   * Register the screen inside the Workout stack under this route instead, as
   * the app does for the Workout tab's screens, so a `navigate` to a sibling
   * Workout route lands on its stub (`route:Workout/AddExercise`). Overrides
   * `route`.
   */
  workoutRoute?: WorkoutRouteName;
};

export const TEST_USER_ID = "test-user";

const workoutInitial = useWorkoutStore.getInitialState();
const authInitial = useAuthStore.getInitialState();
const restPreferenceInitial = useRestPreferenceStore.getInitialState();
const catalogInitial = useCatalogStore.getInitialState();

/**
 * Put every store back to its initial state and empty AsyncStorage.
 * `renderScreen` calls this itself; call it directly only in a test that
 * touches a store without rendering.
 */
export function resetStores() {
  useWorkoutStore.setState(workoutInitial, true);
  useAuthStore.setState(authInitial, true);
  useRestPreferenceStore.setState(restPreferenceInitial, true);
  useCatalogStore.setState(catalogInitial, true);
  // `clear` also drops the store's module state (a check in flight, the
  // stored-copy read), which `setState` cannot reach.
  usePlansStore.getState().clear();
  usePlansStore.setState({ readout: { reads: 0, log: [] } }); // debug readout (Plans Store page)
  useRecentWorkoutsStore.getState().clear();
  useRecentWorkoutsStore.setState({ readout: { reads: 0, log: [] }, billedReads: 0 }); // debug readout
  useExerciseHistoryStore.getState().clear();
  useExerciseHistoryStore.setState({ readout: { reads: 0, log: [] } }); // debug readout
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

/**
 * The nested Workout stack: a stub per route, or `Screen` itself under
 * `screenRoute` (`workoutRoute`), which is then the stack's initial route.
 */
function workoutStack(Screen?: React.ComponentType<any>, screenRoute?: WorkoutRouteName) {
  return function WorkoutStackStub() {
    return (
      <WorkoutStack.Navigator
        id={undefined}
        initialRouteName={screenRoute}
        screenOptions={{ headerShown: false }}
      >
        {Object.values(WorkoutRoutes).map((name) =>
          name === screenRoute && Screen ? (
            <WorkoutStack.Screen key={name} name={name} component={Screen} />
          ) : (
            <WorkoutStack.Screen key={name} name={name}>
              {() => <Text>{`route:${LayoutRoutes.Workout}/${name}`}</Text>}
            </WorkoutStack.Screen>
          )
        )}
      </WorkoutStack.Navigator>
    );
  };
}

export function renderScreen(
  Screen: React.ComponentType<any>,
  options: RenderScreenOptions = {}
): RenderResult {
  const { workout = null, workoutActions, history, user, workoutRoute } = options;
  const route = workoutRoute ? LayoutRoutes.Workout : (options.route ?? LayoutRoutes.LogWorkout);

  resetStores();
  useWorkoutStore.setState({ activeWorkout: workout, ...workoutActions });
  useAuthStore.setState({
    user: (user === undefined ? { uid: TEST_USER_ID } : user) as User | null,
    initialized: true,
  });
  if (history) {
    // As after a successful check: loaded, so an exercise with no doc (or seeded
    // null) is never done, and a recent check, so a screen's trigger is skipped.
    useExerciseHistoryStore.setState({
      uid: user === undefined ? TEST_USER_ID : (user?.uid ?? null),
      storedRead: true,
      lastResult: "ok",
      lastOkAt: Date.now(),
      byId: Object.fromEntries(
        Object.entries(history).flatMap(([exerciseId, stats]) => (stats ? [[exerciseId, stats]] : []))
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
                {workoutRoute ? (
                  <LayoutStack.Screen name={LayoutRoutes.Workout} component={workoutStack(Screen, workoutRoute)} />
                ) : (
                  <>
                    <LayoutStack.Screen name={route} component={Screen} />
                    {route !== LayoutRoutes.Workout && (
                      <LayoutStack.Screen name={LayoutRoutes.Workout} component={workoutStack()} />
                    )}
                  </>
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
