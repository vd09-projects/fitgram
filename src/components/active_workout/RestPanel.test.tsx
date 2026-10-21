import { act, fireEvent, screen } from "@testing-library/react-native";
import ActiveWorkoutScreen from "../../screens/workout_management/ActiveWorkoutScreen";
import { renderScreen } from "../../test/renderScreen";
import { buildExercise, buildStats, buildWorkout } from "../../test/fixtures";
import { useWorkoutStore } from "../../stores/useWorkoutStore";
import { useRestPreferenceStore } from "../../stores/restPreferenceStore";

// Last session: 60 × 8, 62.5 × 8. Stored best at 8 reps: 62.5 kg.
const lastTime = buildStats("Bench Press", [
  { sets: [{ Weight: "60", Reps: "8" }, { Weight: "62.5", Reps: "8" }] },
]);
const history = { [lastTime.exerciseId]: lastTime };

const button = (name: string | RegExp) => screen.getByRole("button", { name });

const logSet = async (weight: string, reps: string) => {
  fireEvent.changeText(screen.getByLabelText("Weight · kg"), weight);
  fireEvent.changeText(screen.getByLabelText("Reps"), reps);
  // Logging awaits storage before the store changes.
  await act(async () => {
    fireEvent.press(button(/^Log set \d+$/));
  });
};

const advanceSeconds = (seconds: number) =>
  act(() => {
    jest.advanceTimersByTime(seconds * 1000);
  });

describe("RestPanel", () => {
  it("logging a set swaps the card for the timer, with the next set's target", async () => {
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press"]), history });

    await logSet("60", "8");

    expect(screen.queryByRole("button", { name: /^Log set \d+$/ })).toBeNull();
    expect(screen.getByLabelText("1:30 rest left of 1:30")).toBeOnTheScreen();
    expect(screen.getByText("62.5 × 8")).toBeOnTheScreen();
    // The Today list is still below.
    expect(button("Remove set 1: 60 kg by 8")).toBeOnTheScreen();

    // Derived from the start timestamp: six seconds later it reads 1:24.
    advanceSeconds(6);
    expect(screen.getByLabelText("1:24 rest left of 1:30")).toBeOnTheScreen();
  });

  it("Skip returns to the card on the next set, keeping a pending undo", async () => {
    const workout = buildWorkout([], {
      exercises: [buildExercise("Bench Press", { sets: [{ id: 1, fields: { Weight: "60", Reps: "8" } }] })],
    });
    renderScreen(ActiveWorkoutScreen, { workout, history });

    await logSet("62.5", "8");
    await act(async () => {
      fireEvent.press(button("Remove set 1: 60 kg by 8"));
    });
    fireEvent.press(button("Skip rest"));

    expect(button(/^Log set \d+$/)).toHaveAccessibleName("Log set 2");
    expect(button(/^Undo/)).toHaveAccessibleName("Undo: restore set 1, 60 kg by 8");
    expect(useWorkoutStore.getState().rest).toBeNull();
  });

  it("rests for the preferred duration; add-time extends it; a rest that ran out reads done", async () => {
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press"]), history });
    useRestPreferenceStore.setState({ restDurationMs: 60_000 });
    await logSet("60", "8");
    expect(screen.getByLabelText("1:00 rest left of 1:00")).toBeOnTheScreen();

    fireEvent.press(button("Add 30 seconds"));
    expect(screen.getByLabelText("1:30 rest left of 1:30")).toBeOnTheScreen();

    advanceSeconds(10 * 60);
    expect(screen.getByLabelText("Rest done")).toBeOnTheScreen();
    expect(button("Next set")).toBeOnTheScreen();
  });

  it("the rest survives leaving the exercise and coming back", async () => {
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press", "Squat"]), history });
    await logSet("60", "8");

    await act(async () => {
      fireEvent.press(button("Next exercise: Squat"));
    });
    // The other exercise is not blocked.
    expect(button("Log set 1")).toBeOnTheScreen();
    advanceSeconds(20);
    await act(async () => {
      fireEvent.press(button("Previous exercise: Bench Press"));
    });

    expect(screen.getByLabelText("1:10 rest left of 1:30")).toBeOnTheScreen();
  });

  it("names what a best set beat, and a worse set at the same reps after it gets no banner", async () => {
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press"]), history });

    await logSet("65", "8");
    expect(screen.getByTestId("personal-best-banner")).toHaveAccessibleName(
      /^Heaviest 8-rep set yet\. 65 kg, beat 62\.5 kg from \d{1,2} [A-Z][a-z]{2}$/
    );

    fireEvent.press(button("Skip rest"));
    // Still beats the stored 62.5, but not the 65 just logged.
    await logSet("63", "8");
    expect(screen.getByLabelText("1:30 rest left of 1:30")).toBeOnTheScreen();
    expect(screen.queryByTestId("personal-best-banner")).toBeNull();
  });
});
