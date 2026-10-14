import { act, fireEvent, screen } from "@testing-library/react-native";
import ActiveWorkoutScreen from "./ActiveWorkoutScreen";
import { renderScreen } from "../../test/renderScreen";
import { buildWorkout } from "../../test/fixtures";
import { useWorkoutStore } from "../../stores/useWorkoutStore";
import { saveWorkoutSession } from "../../services/db/workoutSessions";

// Only the Finish tests reach it, through the real `endWorkout`.
jest.mock("../../services/db/workoutSessions", () => ({
  ...jest.requireActual("../../services/db/workoutSessions"),
  saveWorkoutSession: jest.fn(),
}));

const previousArrow = () => screen.getByRole("button", { name: /^Previous exercise/ });
const nextArrow = () => screen.getByRole("button", { name: /^Next exercise/ });
const storedIndex = () => useWorkoutStore.getState().activeWorkout?.currentExerciseIndex;
// Found by role, not label: the label changes to "Saving…", and a lookup by the
// new label would fail for the wrong reason when the relabel broke.
const finishButton = () => screen.getByRole("button", { name: /Finish workout|Saving…/ });

describe("ActiveWorkoutScreen", () => {
  it("next then previous returns to the same exercise, and the store follows", () => {
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press", "Squat", "Row"]) });
    expect(screen.getByText("Bench Press")).toBeOnTheScreen();

    fireEvent.press(nextArrow());
    expect(screen.getByText("Squat")).toBeOnTheScreen();
    expect(storedIndex()).toBe(1);

    fireEvent.press(previousArrow());
    expect(screen.getByText("Bench Press")).toBeOnTheScreen();
    expect(storedIndex()).toBe(0);
  });

  it("disables previous on the first exercise and next on the last", () => {
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press", "Squat"]) });
    expect(previousArrow()).toBeDisabled();
    expect(nextArrow()).toBeEnabled();

    fireEvent.press(nextArrow());
    expect(previousArrow()).toBeEnabled();
    expect(nextArrow()).toBeDisabled();
  });

  // TICKET-017: with nothing behind it (opened from the footer tab), back
  // navigated to a Workout-stack route the Layout stack does not know.
  it("back with nothing behind it opens the Workout tab", () => {
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press"]) });

    fireEvent.press(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByText("route:Workout/WorkoutHome")).toBeOnTheScreen();
  });

  it("discards only after the confirmation's Discard, not on the menu tap or Keep logging", () => {
    const cancelWorkout = jest.fn().mockResolvedValue(undefined);
    renderScreen(ActiveWorkoutScreen, {
      workout: buildWorkout(["Bench Press"]),
      workoutActions: { cancelWorkout },
    });
    const openDiscardConfirmation = () => {
      fireEvent.press(screen.getByRole("button", { name: "Workout options" }));
      fireEvent.press(screen.getByText("Discard workout"));
    };

    openDiscardConfirmation();
    expect(screen.getByText("Discard this workout?")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Keep logging"));
    expect(cancelWorkout).not.toHaveBeenCalled();

    // The positive half: without it, a Discard button wired to nothing passes.
    openDiscardConfirmation();
    fireEvent.press(screen.getByText("Discard"));
    expect(cancelWorkout).toHaveBeenCalledTimes(1);
  });

  it("disables and relabels Finish while a save is in flight", () => {
    // Never resolves, so the first save is still in flight for the second tap.
    const endWorkout = jest.fn(() => new Promise<void>(() => {}));
    renderScreen(ActiveWorkoutScreen, {
      workout: buildWorkout(["Bench Press"]),
      workoutActions: { endWorkout },
    });

    fireEvent.press(finishButton());
    expect(finishButton()).toHaveTextContent("Saving…");
    expect(finishButton()).toBeDisabled();
    fireEvent.press(finishButton());

    expect(endWorkout).toHaveBeenCalledTimes(1);
    expect(endWorkout).toHaveBeenCalledWith("test-user");
  });

  // TICKET-027: both taps land before React re-renders, so no screen guard can
  // see the first. The store's in-flight save is what stops the second.
  it("two Finish taps inside one frame save once", async () => {
    const save = saveWorkoutSession as jest.Mock;
    save.mockResolvedValue({ sessionId: "s", rollupApplied: true });
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press"]) });

    await act(async () => {
      fireEvent.press(finishButton());
      fireEvent.press(finishButton());
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(useWorkoutStore.getState().activeWorkout).toBeNull();
    log.mockRestore();
  });
});
