import { act, fireEvent, screen } from "@testing-library/react-native";
import ActiveWorkoutScreen from "./ActiveWorkoutScreen";
import { renderScreen } from "../../test/renderScreen";
import { buildExercise, buildStats, buildWorkout, CATALOG_ROW } from "../../test/fixtures";
import { EndWorkoutResult, useWorkoutStore } from "../../stores/useWorkoutStore";
import { getExerciseStats, saveWorkoutSession } from "../../services/db/workoutSessions";
import { useCatalogStore } from "../../stores/useCatalogStore";
import { loadCatalog } from "../../utils/catalog";

// Only the Finish tests reach the save, through the real `endWorkout`. The
// reads are the swap picker's (TICKET-047), mounted only while it is open.
jest.mock("../../services/db/workoutSessions", () => ({
  ...jest.requireActual("../../services/db/workoutSessions"),
  saveWorkoutSession: jest.fn(),
  getExerciseStats: jest.fn(async () => ({})),
  getWorkoutSessions: jest.fn(async () => ({ sessions: [], lastDoc: null })),
}));
jest.mock("../../services/db/userDB", () => ({
  ...jest.requireActual("../../services/db/userDB"),
  getAllWorkoutPlans: jest.fn(async () => []),
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
    const endWorkout = jest.fn(() => new Promise<EndWorkoutResult>(() => {}));
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
    // One set logged: a workout with none is refused before it reaches the save.
    const workout = buildWorkout([], {
      exercises: [buildExercise("Bench Press", { sets: [{ id: 1, segments: [{ Weight: 60, Reps: 5 }] }] })],
    });
    renderScreen(ActiveWorkoutScreen, { workout });

    await act(async () => {
      fireEvent.press(finishButton());
      fireEvent.press(finishButton());
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(useWorkoutStore.getState().activeWorkout).toBeNull();
    log.mockRestore();
  });
});

// TICKET-047: swap from the exercise menu, through the shared picker.
describe("swap exercise", () => {
  const plank = () =>
    buildExercise("Plank", { fields: [{ name: "Time", role: "time", unit: "s" }] });
  const seedCatalog = () => {
    const load = loadCatalog([CATALOG_ROW]);
    if (load.kind !== "ok") throw new Error("fixture catalog refused");
    act(() => useCatalogStore.setState({ catalog: { version: "h1", movements: load.movements, index: load.index } }));
  };
  const openMenu = (name: string) => fireEvent.press(screen.getByRole("button", { name: `${name} options` }));

  it("is disabled with its reason once a set is logged", () => {
    const logged = buildExercise("Plank", {
      fields: [{ name: "Time", role: "time", unit: "s" }],
      sets: [{ id: 1, segments: [{ Time: 60 }] }],
    });
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout([], { exercises: [logged] }) });

    openMenu("Plank");

    expect(
      screen.getByRole("button", { name: "Swap exercise, Only before set 1. Delete the logged sets to swap." })
    ).toBeDisabled();
  });

  it("a pick puts the new exercise on the logger with its own fields and last time, not the planned one's", async () => {
    const plannedStats = buildStats("Plank", [{ sets: [{ Time: 45 }], fields: plank().fields }]);
    const rowStats = buildStats("row__barbell", [{ sets: [{ Weight: 60, Reps: 8 }] }]);
    renderScreen(ActiveWorkoutScreen, {
      workout: buildWorkout([], { exercises: [plank(), buildExercise("Squat")] }),
      history: { [plannedStats.exerciseId]: plannedStats, [rowStats.exerciseId]: rowStats },
    });
    seedCatalog();

    openMenu("Plank");
    fireEvent.press(screen.getByRole("button", { name: /^Swap exercise/ }));
    expect(screen.getByText("Swap Plank")).toBeOnTheScreen();
    await act(async () => {
      fireEvent.press(screen.getByText("Row"));
    });

    expect(useWorkoutStore.getState().activeWorkout!.exercises.map((e) => e.id)).toEqual(["row__barbell", "squat"]);
    expect(screen.getByLabelText("Exercise 1 of 2")).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Weight/)).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Time/)).toBeNull();
    expect(screen.getByRole("button", { name: /^Last time 60 by 8/ })).toBeOnTheScreen();
  });

  it("a failed fetch for the new exercise reads HISTORY with its mark, and the sheet's Reload refetches it", async () => {
    const stats = getExerciseStats as jest.Mock;
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    stats.mockRejectedValueOnce(new Error("offline"));
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout([], { exercises: [plank()] }) });
    seedCatalog();

    await act(async () => {
      await useWorkoutStore.getState().swapExercise("plank", { id: "row__barbell", name: "", nameSnapshot: "Row", fields: CATALOG_ROW.versions[0].fields });
    });

    // The failed state, not "never done": read as ready-with-no-history, this
    // pill would be "Show history" and the card would say "First time".
    expect(screen.getByRole("button", { name: "History not loaded. Show history" })).toHaveTextContent(/HISTORY/);

    const rowStats = buildStats("row__barbell", [{ sets: [{ Weight: 60, Reps: 8 }] }]);
    stats.mockResolvedValueOnce({ row__barbell: rowStats });
    fireEvent.press(screen.getByRole("button", { name: "History not loaded. Show history" }));
    expect(screen.getByText("Couldn't load history")).toBeOnTheScreen();
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Reload history" }));
    });

    expect(stats).toHaveBeenLastCalledWith("test-user", ["row__barbell"]);
    expect(screen.getByRole("button", { name: /^Last time 60 by 8/ })).toBeOnTheScreen();
    log.mockRestore();
  });

  it("offers Back to plan once swapped, and it restores the planned exercise", async () => {
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout([], { exercises: [plank()] }) });
    seedCatalog();
    await act(async () => {
      await useWorkoutStore.getState().swapExercise("plank", { id: "row__barbell", name: "", nameSnapshot: "Row", fields: CATALOG_ROW.versions[0].fields });
    });

    openMenu("Row");
    fireEvent.press(screen.getByRole("button", { name: /^Swap exercise/ }));
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Back to plan: Plank" }));
    });

    const slot = useWorkoutStore.getState().activeWorkout!.exercises[0];
    expect(slot.id).toBe("plank");
    expect(slot.planned).toBeUndefined();
    expect(screen.getByLabelText(/^Time/)).toBeOnTheScreen();
  });
});
