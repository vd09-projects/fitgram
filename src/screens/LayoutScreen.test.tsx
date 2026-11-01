// Header and footer taps build the Layout history that Android back walks
// (TICKET-060). The real LayoutScreen and LayoutNavigator, with each screen
// stubbed to its route name. `goBack()` on the container ref is the GO_BACK
// action Android back dispatches; jest runs as iOS, where the hardware button
// is not wired, so it is called directly.
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { createNavigationContainerRef, NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemeProvider } from "../components/app_manager/ThemeContext";
import { TourGuideProvider } from "../components/guide_tour/TourGuideProvider";
import { resetStores } from "../test/renderScreen";
import LayoutScreen from "./LayoutScreen";

jest.mock("./HomeScreen", () => () => require("react").createElement(require("react-native").Text, null, "screen:Home"));
jest.mock("./FeedScreen", () => () => require("react").createElement(require("react-native").Text, null, "screen:Feed"));
jest.mock("./ProfileScreen", () => () => require("react").createElement(require("react-native").Text, null, "screen:Profile"));
jest.mock("../navigation/WorkoutNavigator", () => () => require("react").createElement(require("react-native").Text, null, "screen:Workout"));
jest.mock("./workout_management/ActiveWorkoutScreen", () => () => require("react").createElement(require("react-native").Text, null, "screen:LogWorkout"));

const navigationRef = createNavigationContainerRef();

const history = () => navigationRef.getRootState().routes.map((route) => route.name);

const back = () => act(() => navigationRef.goBack());

function renderLayout() {
  resetStores();
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
            <NavigationContainer ref={navigationRef}>
              <LayoutScreen />
            </NavigationContainer>
          </TourGuideProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

it("walks back through the tabs visited and stops at Home", () => {
  renderLayout();
  fireEvent.press(screen.getByText("Workout"));
  fireEvent.press(screen.getByText("Feed"));
  expect(history()).toEqual(["Home", "Workout", "Feed"]);

  back();
  expect(screen.getByText("screen:Workout")).toBeOnTheScreen();
  back();
  expect(screen.getByText("screen:Home")).toBeOnTheScreen();
  // Nothing left behind Home, so the next back leaves the app.
  expect(navigationRef.canGoBack()).toBe(false);
});

it("moves a revisited tab to the top, so back returns to the tab left for it", () => {
  // Scenario 1 (TICKET-060): Feed → Workout (on Log Workout) → Feed → back
  // must land on Workout again, not on Home.
  renderLayout();
  fireEvent.press(screen.getByText("Feed"));
  fireEvent.press(screen.getByText("Workout"));
  fireEvent.press(screen.getByText("Feed"));
  expect(history()).toEqual(["Home", "Workout", "Feed"]);

  back();
  expect(screen.getByText("screen:Workout")).toBeOnTheScreen();
});

it("keeps the moved tab's route, so its nested screens survive the move", () => {
  renderLayout();
  fireEvent.press(screen.getByText("Workout"));
  const workoutKey = navigationRef.getRootState().routes.find((route) => route.name === "Workout")?.key;
  fireEvent.press(screen.getByText("Feed"));
  fireEvent.press(screen.getByText("Workout"));

  const routes = navigationRef.getRootState().routes;
  // Same key: the same card moved, not a fresh Workout pushed in its place.
  expect(routes[routes.length - 1].key).toBe(workoutKey);
  expect(routes.filter((route) => route.name === "Workout")).toHaveLength(1);
});

it("header Home clears the history back to Home", () => {
  renderLayout();
  fireEvent.press(screen.getByText("Workout"));
  fireEvent.press(screen.getByText("Feed"));
  fireEvent.press(screen.getByText("Fitgram"));
  expect(history()).toEqual(["Home"]);
  expect(navigationRef.canGoBack()).toBe(false);
});
