import { act, screen } from "@testing-library/react-native";
import ActiveWorkoutScreen from "../screens/workout_management/ActiveWorkoutScreen";
import { renderScreen } from "../test/renderScreen";
import { buildWorkout } from "../test/fixtures";
import { useTourStore } from "../stores/useTourStore";

describe("ScrollableScreen", () => {
  // The buffer is ~40% of the screen height. Always present, it let a screen
  // with little content scroll up into empty space and stay there.
  it("adds the tour's scroll buffer only while a tour is running", () => {
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press"]) });
    expect(screen.queryByTestId("tour-scroll-buffer")).toBeNull();

    try {
      act(() => useTourStore.setState({ isTourActive: true }));
      expect(screen.getByTestId("tour-scroll-buffer")).toBeOnTheScreen();
    } finally {
      // Not reset by renderScreen; leaking it would put every later test in a tour.
      act(() => useTourStore.setState({ isTourActive: false }));
    }
  });
});
