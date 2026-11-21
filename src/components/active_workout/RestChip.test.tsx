import { act, fireEvent, screen } from "@testing-library/react-native";
import ActiveWorkoutScreen from "../../screens/workout_management/ActiveWorkoutScreen";
import { renderScreen } from "../../test/renderScreen";
import { buildWorkout } from "../../test/fixtures";
import { useWorkoutStore } from "../../stores/useWorkoutStore";
import { REST_DONE_CHIP_MS } from "../../config/workout";
import RestChip from "./RestChip";

const button = (name: string | RegExp) => screen.getByRole("button", { name });

const logSet = async () => {
  fireEvent.changeText(screen.getByLabelText("Weight · kg"), "60");
  fireEvent.changeText(screen.getByLabelText("Reps"), "8");
  await act(async () => {
    fireEvent.press(button(/^Log set \d+$/));
  });
};

const goNext = async (name: string) => {
  await act(async () => {
    fireEvent.press(button(`Next exercise: ${name}`));
  });
};

const advanceSeconds = (seconds: number) =>
  act(() => {
    jest.advanceTimersByTime(seconds * 1000);
  });

// Rest started on Bench Press (1:30 by default); the user then moves to Squat.
const restOnBenchThenSquat = async () => {
  renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press", "Squat"]) });
  await logSet();
  await goNext("Squat");
};

describe("RestChip", () => {
  it("shows the time left on another exercise, and not on the resting one", async () => {
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press", "Squat"]) });
    await logSet();
    // On the resting exercise the card is on screen, so no chip.
    expect(screen.queryByLabelText(/^Rest .* left on Bench Press/)).toBeNull();

    await goNext("Squat");
    expect(button("Rest 1:30 left on Bench Press. Go to Bench Press")).toBeOnTheScreen();

    advanceSeconds(20);
    expect(button("Rest 1:10 left on Bench Press. Go to Bench Press")).toBeOnTheScreen();
  });

  it("tapping it goes to the resting exercise and leaves the timer alone", async () => {
    await restOnBenchThenSquat();
    advanceSeconds(20);
    const before = useWorkoutStore.getState().rest;

    await act(async () => {
      fireEvent.press(button(/^Rest .* left on Bench Press/));
    });

    expect(screen.getByLabelText("1:10 rest left of 1:30")).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Rest .* left on Bench Press/)).toBeNull();
    expect(useWorkoutStore.getState().rest).toBe(before);
  });

  it("reads Rest over at the end, then clears itself while the rest stays", async () => {
    await restOnBenchThenSquat();

    advanceSeconds(90);
    expect(button("Rest over on Bench Press. Go to Bench Press")).toBeOnTheScreen();

    advanceSeconds(REST_DONE_CHIP_MS);
    expect(screen.queryByLabelText(/Bench Press\. Go to Bench Press/)).toBeNull();
    // Display only: the rest is still there for the resting exercise's card to read.
    expect(useWorkoutStore.getState().rest).not.toBeNull();
  });

  it("stops its clock when the chip has nothing left to show", () => {
    // Count its own interval, not the screen's timers: other components keep theirs.
    const setSpy = jest.spyOn(global, "setInterval");
    const clearSpy = jest.spyOn(global, "clearInterval");
    const rest = { exerciseId: "bench", startedAt: Date.now(), durationMs: 90_000, setNumber: 1 };
    renderScreen(() => <RestChip rest={rest} viewingExerciseId="squat" exerciseName="Bench Press" onPress={() => {}} />);
    const half = setSpy.mock.calls.findIndex(([, ms]) => ms === 500);
    expect(half).not.toBe(-1);
    const chipClock = setSpy.mock.results[half].value;

    advanceSeconds(90 + REST_DONE_CHIP_MS / 1000 + 1);

    expect(clearSpy).toHaveBeenCalledWith(chipClock);
    setSpy.mockRestore();
    clearSpy.mockRestore();
  });

  it("starts its clock again when add-time lengthens a rest whose chip had cleared", () => {
    const Host = () => (
      <RestChip rest={useWorkoutStore((s) => s.rest)} viewingExerciseId="squat" exerciseName="Bench Press" onPress={() => {}} />
    );
    renderScreen(Host);
    act(() => useWorkoutStore.getState().startRest("bench", 90_000, 1));
    advanceSeconds(90 + REST_DONE_CHIP_MS / 1000 + 1);
    expect(screen.queryByLabelText(/Bench Press\. Go to Bench Press/)).toBeNull();

    act(() => useWorkoutStore.getState().addRestTime());
    advanceSeconds(10);

    expect(screen.getByLabelText("Rest 0:20 left on Bench Press. Go to Bench Press")).toBeOnTheScreen();
  });
});
