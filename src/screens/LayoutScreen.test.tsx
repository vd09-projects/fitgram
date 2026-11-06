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
// The real WorkoutNavigator (its `getId` decides how the stack grows), with its
// screens stubbed. A test walks Workout home → Start → Log as the app does (tap
// the screen text to go on). Log has the real BackButton and a leave guard like
// Manage Workout's, which blocks while `mockLeaveGuard.block` is set at render.
const mockLeaveGuard = { block: false, asked: 0 };
// A declaration, not a const: the mock factories below are hoisted above it.
function mockStub(text: string, next?: string) {
  return function Stub() {
    const React = require("react");
    const { Text } = require("react-native");
    const navigation = require("@react-navigation/native").useNavigation();
    return React.createElement(Text, { onPress: next ? () => navigation.navigate(next) : undefined }, text);
  };
}
jest.mock("./workout_management/WorkoutHubScreen", () => mockStub("screen:Workout", "StartWorkout"));
jest.mock("./workout_management/StartWorkoutScreen", () => mockStub("screen:NestedStart", "LogWorkout"));
jest.mock("./workout_management/AddExerciseScreen", () => mockStub("screen:Manage"));
jest.mock("./workout_management/WorkoutLogsScreen", () => mockStub("screen:Logs"));
jest.mock("./workout_management/ExerciseHistoryDebugScreen", () => mockStub("screen:HistoryDebug"));
jest.mock("./workout_management/PendingUploadsDebugScreen", () => mockStub("screen:PendingDebug"));
jest.mock("./workout_management/PlansStoreDebugScreen", () => mockStub("screen:PlansStoreDebug"));
jest.mock("./workout_management/ActiveWorkoutScreen", () => () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  const { usePreventRemove } = require("@react-navigation/native");
  const BackButton = require("../components/BackButton").default;
  usePreventRemove(mockLeaveGuard.block, () => { mockLeaveGuard.asked += 1; });
  return React.createElement(View, null, React.createElement(BackButton), React.createElement(Text, null, "screen:NestedLog"));
});

const navigationRef = createNavigationContainerRef();

beforeEach(() => {
  mockLeaveGuard.block = false;
  mockLeaveGuard.asked = 0;
});

const history = () => navigationRef.getRootState().routes.map((route) => route.name);

const back = () => act(() => navigationRef.goBack());

const workoutState = () => navigationRef.getRootState().routes.find((route) => route.name === "Workout")?.state;

// The nested Workout stack: its route names and the focused one.
const workoutStack = () => {
  const nested = workoutState();
  const names = nested?.routes.map((route) => route.name) ?? [];
  return { names, focused: names[nested?.index ?? names.length - 1] };
};

// Workout home → Start Workout → Log Workout, from the footer.
const openLogger = () => {
  fireEvent.press(screen.getByText("Workout"));
  fireEvent.press(screen.getByText("screen:Workout"));
  fireEvent.press(screen.getByText("screen:NestedStart"));
};

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

it("keeps the moved tab's route key, so the same card moves", () => {
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

it("Workout opens on Workout home, and back retraces the screens it was on", () => {
  // The user's scenario: Feed → Workout → Start Workout → start a session →
  // tap Workout → back walks Log Workout, Start Workout, then Feed.
  renderLayout();
  fireEvent.press(screen.getByText("Feed"));
  openLogger();
  fireEvent.press(screen.getByText("Workout"));
  expect(workoutStack()).toEqual({ names: ["StartWorkout", "LogWorkout", "WorkoutHome"], focused: "WorkoutHome" });

  back();
  expect(workoutStack().focused).toBe("LogWorkout");
  back();
  expect(workoutStack().focused).toBe("StartWorkout");
  back();
  expect(history()).toEqual(["Home", "Feed"]);
});

it("each Workout screen is in the stack once, however many loops", () => {
  // Without WorkoutNavigator's `getId`, each loop pushed two more screens.
  renderLayout();
  for (let loop = 0; loop < 3; loop++) {
    fireEvent.press(screen.getByText("Workout"));
    fireEvent.press(screen.getByText("screen:Workout"));
    fireEvent.press(screen.getByText("screen:NestedStart"));
  }
  fireEvent.press(screen.getByText("Workout"));
  expect(workoutStack()).toEqual({ names: ["StartWorkout", "LogWorkout", "WorkoutHome"], focused: "WorkoutHome" });
});

it("Workout opens on Workout home from another tab, with Workout home in the stack once", () => {
  renderLayout();
  openLogger();
  fireEvent.press(screen.getByText("Feed"));
  fireEvent.press(screen.getByText("Workout"));
  expect(workoutStack()).toEqual({ names: ["StartWorkout", "LogWorkout", "WorkoutHome"], focused: "WorkoutHome" });

  // Already on Workout home: nothing moves.
  fireEvent.press(screen.getByText("Workout"));
  expect(workoutStack().names).toEqual(["StartWorkout", "LogWorkout", "WorkoutHome"]);
  expect(history()).toEqual(["Home", "Feed", "Workout"]);
});

it("tapping Workout keeps an unsaved nested screen beneath, without asking to discard it", () => {
  // Manage Workout with unsaved edits: nothing is removed, so no guard is asked
  // and back returns to the screen with its edits.
  mockLeaveGuard.block = true;
  renderLayout();
  openLogger();
  const keys = () => workoutState()?.routes.map((route) => route.key).sort();
  const before = keys();
  fireEvent.press(screen.getByText("Workout"));
  expect(mockLeaveGuard.asked).toBe(0);
  expect(workoutStack().focused).toBe("WorkoutHome");
  // Same keys: the same screens moved, still mounted, local state intact.
  expect(keys()).toEqual(before);

  back();
  expect(workoutStack().focused).toBe("LogWorkout");
});

it("Back on a nested screen asks its leave guard", () => {
  mockLeaveGuard.block = true;
  renderLayout();
  openLogger();

  fireEvent.press(screen.getByLabelText("Back"));
  expect(mockLeaveGuard.asked).toBe(1);
  expect(workoutStack().focused).toBe("LogWorkout");
});

it("header back is hidden on Home and returns to the previous tab elsewhere", () => {
  renderLayout();
  expect(screen.queryByLabelText("Back")).toBeNull();

  fireEvent.press(screen.getByText("Feed"));
  fireEvent.press(screen.getByText("Workout"));
  fireEvent.press(screen.getByLabelText("Back"));
  expect(history()).toEqual(["Home", "Feed"]);

  fireEvent.press(screen.getByLabelText("Back"));
  expect(history()).toEqual(["Home"]);
  expect(screen.queryByLabelText("Back")).toBeNull();
});

it("header Home clears the history back to Home", () => {
  renderLayout();
  fireEvent.press(screen.getByText("Workout"));
  fireEvent.press(screen.getByText("Feed"));
  fireEvent.press(screen.getByText("Fitgram"));
  expect(history()).toEqual(["Home"]);
  expect(navigationRef.canGoBack()).toBe(false);
});
