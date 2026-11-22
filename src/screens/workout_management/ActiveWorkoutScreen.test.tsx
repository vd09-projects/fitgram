import { act, fireEvent, screen, within } from "@testing-library/react-native";
import ActiveWorkoutScreen from "./ActiveWorkoutScreen";
import { renderScreen } from "../../test/renderScreen";
import { buildSessionDocs, buildSessionId } from "../../utils/exerciseStats";
const buildSessionDocsFor = (workout: Parameters<typeof buildSessionDocs>[0]) => buildSessionDocs(workout, workout.startTime + 60_000).session;
import { buildExercise, buildStats, buildWorkout, CATALOG_ROW } from "../../test/fixtures";
import { EndWorkoutResult, useWorkoutStore } from "../../stores/useWorkoutStore";
import { getAllExerciseStats, saveWorkoutSession } from "../../services/db/workoutSessions";
import { useCatalogStore } from "../../stores/useCatalogStore";
import { loadCatalog } from "../../utils/catalog";
import show from "../../utils/toastUtils";
import { WorkoutRoutes } from "../../constants/routes";
import { FREESTYLE_ID } from "../../constants/freestyle";
import { toEditableWorkout } from "../../utils/editSession";

// Only the Finish tests reach the save, through the real `endWorkout`. The
// reads are the swap picker's (TICKET-047), mounted only while it is open.
jest.mock("../../services/db/workoutSessions", () => ({
  ...jest.requireActual("../../services/db/workoutSessions"),
  saveWorkoutSession: jest.fn(),
  getAllExerciseStats: jest.fn(async () => []),
  getChangedExerciseStats: jest.fn(async () => []),
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
// The confirmation's button (TICKET-096): its label is exactly "Finish", the footer's is "Finish workout".
const confirmFinish = () => fireEvent.press(screen.getByText("Finish"));

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

  // TICKET-056: on the last exercise the next arrow's box holds Add exercise.
  it("disables previous on the first exercise; on the last, next becomes Add exercise", () => {
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press", "Squat"]) });
    expect(previousArrow()).toBeDisabled();
    expect(nextArrow()).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Add exercise" })).toBeNull();

    fireEvent.press(nextArrow());
    expect(previousArrow()).toBeEnabled();
    expect(screen.queryByRole("button", { name: /^Next exercise/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Add exercise" })).toBeEnabled();
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
    save.mockResolvedValue({ sessionId: "s", summaries: [] });
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    // One set logged: a workout with none is refused before it reaches the save.
    const workout = buildWorkout([], {
      exercises: [buildExercise("Bench Press", { sets: [{ id: 1, segments: [{ Weight: 60, Reps: 5 }] }] })],
    });
    renderScreen(ActiveWorkoutScreen, { workout });

    fireEvent.press(finishButton());
    await act(async () => {
      confirmFinish();
      confirmFinish();
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(useWorkoutStore.getState().activeWorkout).toBeNull();
    // The second tap's refusal must not take the landing away (PR #80 review): the Session, not the hub.
    expect(screen.getByText(`route:Workout/${WorkoutRoutes.Session}`)).toBeOnTheScreen();
    expect(screen.queryByText("route:Workout/WorkoutHome")).toBeNull();
    log.mockRestore();
  });
});

// TICKET-096: Finish asks first, because a finished workout cannot be edited.
describe("Finish confirmation", () => {
  const loggedSet = { id: 1, segments: [{ Weight: 60, Reps: 5 }] };
  const renderWith = (exercises: ReturnType<typeof buildExercise>[]) => {
    const endWorkout = jest.fn(() => new Promise<EndWorkoutResult>(() => {}));
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout([], { exercises }), workoutActions: { endWorkout } });
    return endWorkout;
  };

  it("saves only after the confirmation's Finish, not on the footer tap or Keep logging", () => {
    const endWorkout = renderWith([buildExercise("Bench Press", { sets: [loggedSet] })]);

    fireEvent.press(finishButton());
    expect(screen.getByText("Finish this workout?")).toBeOnTheScreen();
    expect(endWorkout).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Keep logging"));
    expect(endWorkout).not.toHaveBeenCalled();
    expect(screen.queryByText("Finish this workout?")).toBeNull();

    // The positive half: without it, a Finish wired to nothing passes.
    fireEvent.press(finishButton());
    confirmFinish();
    expect(endWorkout).toHaveBeenCalledTimes(1);
  });

  it("says what is saved, and counts exercises with no sets without naming them", () => {
    renderWith([
      buildExercise("Bench Press", { sets: [loggedSet, { ...loggedSet, id: 2 }] }),
      buildExercise("Squat"),
      buildExercise("Row"),
    ]);

    fireEvent.press(finishButton());

    expect(screen.getByText("2 sets · 1 exercise")).toBeOnTheScreen();
    expect(screen.getByText("2 exercises")).toBeOnTheScreen();
    expect(screen.queryByText("Squat")).toBeNull();
  });

  it("with every exercise logged, one sentence and no summary card", () => {
    renderWith([buildExercise("Bench Press", { sets: [loggedSet] })]);

    fireEvent.press(finishButton());

    expect(screen.getByText(/1 set in 1 exercise will be saved\./)).toBeOnTheScreen();
    expect(screen.queryByText("No sets, left out")).toBeNull();
  });

  it("with no set logged, goes straight to the store's refusal and asks nothing", () => {
    const endWorkout = renderWith([buildExercise("Bench Press")]);

    fireEvent.press(finishButton());

    expect(screen.queryByText("Finish this workout?")).toBeNull();
    expect(endWorkout).toHaveBeenCalledTimes(1);
  });
});

// TICKET-066: with no workout the logger hands over to the hub.
describe("after the workout ends", () => {
  const loggedWorkout = () =>
    buildWorkout([], {
      name: "Shoulders & Core",
      startTime: Date.now() - 52 * 60_000,
      exercises: [buildExercise("Bench Press", { sets: [{ id: 1, segments: [{ Weight: 60, Reps: 5 }] }] })],
    });

  it.each([
    ["the footer tab (Layout stack)", undefined],
    ["the Workout stack", WorkoutRoutes.LogWorkout],
  ])("Finish from %s lands on the workout's Session, and the upload says Saved there, not in a toast", async (_, workoutRoute) => {
    (saveWorkoutSession as jest.Mock).mockResolvedValue({ sessionId: "s", summaries: [] });
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    const success = jest.spyOn(show, "success");
    renderScreen(ActiveWorkoutScreen, { workout: loggedWorkout(), workoutRoute });

    fireEvent.press(finishButton());
    await act(async () => confirmFinish());

    expect(screen.getByText(`route:Workout/${WorkoutRoutes.Session}`)).toBeOnTheScreen();
    expect(screen.queryByText("route:Workout/WorkoutHome")).toBeNull();
    expect(success).not.toHaveBeenCalled();
    success.mockRestore();
    log.mockRestore();
  });

  // The slot is empty from the start of Finish; the workout is safe only once the store says its queue write
  // succeeded (`queuedSessionId`). `endWorkout` is a double here, so the test decides when each of those happens.
  describe("the landing waits for the queue write (PR #76 review)", () => {
    const setup = () => {
      const workout = loggedWorkout();
      let finish!: (result: EndWorkoutResult) => void;
      const endWorkout = jest.fn(() => {
        useWorkoutStore.setState({ activeWorkout: null });
        return new Promise<EndWorkoutResult>((resolve) => (finish = resolve));
      });
      renderScreen(ActiveWorkoutScreen, { workout, workoutActions: { endWorkout } });
      return { workout, finish: (result: EndWorkoutResult) => finish(result) };
    };

    it("does not navigate while the write is pending, and lands once it is queued", async () => {
      const { workout } = setup();
      // Braces: `press` returns the handler's promise, which here never settles, and `act` would wait for it.
      fireEvent.press(finishButton());
      await act(async () => {
        confirmFinish();
      });

      expect(useWorkoutStore.getState().activeWorkout).toBeNull();
      expect(screen.queryByText(/^route:/)).toBeNull();

      await act(async () => useWorkoutStore.setState({ queuedSessionId: buildSessionId(workout.id, workout.startTime) }));
      expect(screen.getByText(`route:Workout/${WorkoutRoutes.Session}`)).toBeOnTheScreen();
    });

    it("a failed write puts the workout back: still on the logger, not on a Session and not on the hub", async () => {
      const { workout, finish } = setup();
      // Braces: `press` returns the handler's promise, which here never settles, and `act` would wait for it.
      fireEvent.press(finishButton());
      await act(async () => {
        confirmFinish();
      });
      expect(screen.queryByText(/^route:/)).toBeNull();

      await act(async () => {
        useWorkoutStore.setState({ activeWorkout: workout });
        finish({ status: "refused", reason: "Could not write the upload queue." });
      });
      expect(screen.queryByText(/^route:/)).toBeNull();
      // The put-back must not bring the confirmation back with it: the user already answered it.
      expect(screen.queryByText("Finish this workout?")).toBeNull();
      expect(finishButton()).toBeOnTheScreen();
    });
  });

  it("a Finish that is refused stays on the logger and lands nowhere", async () => {
    const alert = jest.spyOn(show, "alert").mockImplementation(() => {});
    // No sets logged: refused before anything is saved.
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press"]) });

    await act(async () => fireEvent.press(finishButton()));

    expect(useWorkoutStore.getState().activeWorkout).not.toBeNull();
    expect(screen.queryByText(/^route:/)).toBeNull();

    // The refused Finish left nothing behind: a Discard afterwards goes to the hub, not to a Session.
    fireEvent.press(screen.getByRole("button", { name: "Workout options" }));
    fireEvent.press(screen.getByText("Discard workout"));
    await act(async () => fireEvent.press(screen.getByText("Discard")));
    expect(screen.getByText("route:Workout/WorkoutHome")).toBeOnTheScreen();
    expect(screen.queryByText(`route:Workout/${WorkoutRoutes.Session}`)).toBeNull();
    alert.mockRestore();
  });

  it("Discard lands on the hub", async () => {
    renderScreen(ActiveWorkoutScreen, { workout: loggedWorkout() });
    fireEvent.press(screen.getByRole("button", { name: "Workout options" }));
    fireEvent.press(screen.getByText("Discard workout"));
    await act(async () => fireEvent.press(screen.getByText("Discard")));

    expect(screen.getByText("route:Workout/WorkoutHome")).toBeOnTheScreen();
  });

  it.each([
    ["the footer tab (Layout stack)", undefined],
    ["the Workout stack", WorkoutRoutes.LogWorkout],
  ])("opened from %s with no workout, it goes to the hub instead of 'No active workout'", (_, workoutRoute) => {
    renderScreen(ActiveWorkoutScreen, { workout: null, workoutRoute });

    expect(screen.getByText("route:Workout/WorkoutHome")).toBeOnTheScreen();
    expect(screen.queryByText("No active workout")).toBeNull();
  });
});

// TICKET-102 stage 1: a past workout opened as an edit draft.
describe("an edit draft", () => {
  const draft = () => {
    const stored = buildWorkout([], {
      id: "push",
      name: "Push",
      startTime: new Date(2026, 10, 9, 18).getTime(),
      exercises: [buildExercise("Bench Press", { sets: [{ id: 1, segments: [{ Weight: 650, Reps: 9 }] }] })],
    });
    const result = toEditableWorkout({ ...buildSessionDocsFor(stored), sessionId: "push_s" });
    if (result.status !== "ready") throw new Error(result.reason);
    return result.workout;
  };

  it("says Editing and the date instead of a timer, and offers Cancel edit and a switched-off Save, not Finish", () => {
    renderScreen(ActiveWorkoutScreen, { workout: draft(), workoutRoute: WorkoutRoutes.LogWorkout });
    expect(screen.getByLabelText("Editing, Mon 9 Nov")).toBeOnTheScreen();
    expect(screen.queryByText(/elapsed/)).toBeNull();
    expect(screen.getByText("THIS WORKOUT")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Finish workout/ })).toBeNull();
  });

  it("Cancel edit with nothing changed asks nothing, empties the slot and goes back to the Session", async () => {
    renderScreen(ActiveWorkoutScreen, { workout: draft(), workoutRoute: WorkoutRoutes.LogWorkout });
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Cancel edit" })));
    expect(useWorkoutStore.getState().activeWorkout).toBeNull();
    expect(screen.queryByText("Discard your changes?")).toBeNull();
    expect(screen.getByText(`route:Workout/${WorkoutRoutes.Session}`)).toBeOnTheScreen();
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
    expect(screen.getByLabelText(/^Weight · /)).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Time · /)).toBeNull();
    expect(screen.getByRole("button", { name: /^Last time 60 by 8/ })).toBeOnTheScreen();
  });

  it("a failed fetch for the new exercise reads HISTORY with its mark, and the sheet's Reload refetches it", async () => {
    const stats = getAllExerciseStats as jest.Mock;
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
    stats.mockResolvedValueOnce([rowStats]);
    fireEvent.press(screen.getByRole("button", { name: "History not loaded. Show history" }));
    expect(screen.getByText("Couldn't load history")).toBeOnTheScreen();
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Reload history" }));
    });

    expect(stats).toHaveBeenLastCalledWith("test-user");
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
    expect(screen.getByLabelText(/^Time · /)).toBeOnTheScreen();
  });
});

// TICKET-056: add from the workout menu or the last exercise's +, through the shared picker.
describe("add exercise", () => {
  const seedCatalog = () => {
    const load = loadCatalog([CATALOG_ROW]);
    if (load.kind !== "ok") throw new Error("fixture catalog refused");
    act(() => useCatalogStore.setState({ catalog: { version: "h1", movements: load.movements, index: load.index } }));
  };

  it("from the workout menu on exercise 1: the picker says where it goes, and the pick lands on it with its own last time", async () => {
    const rowStats = buildStats("row__barbell", [{ sets: [{ Weight: 60, Reps: 8 }] }]);
    renderScreen(ActiveWorkoutScreen, {
      workout: buildWorkout(["Bench Press", "Squat"]),
      history: { [rowStats.exerciseId]: rowStats },
    });
    seedCatalog();

    fireEvent.press(screen.getByRole("button", { name: "Workout options" }));
    fireEvent.press(screen.getByRole("button", { name: /^Add exercise, Goes at the end/ }));
    expect(screen.getByText("Goes after Squat. Your plan stays as it is.")).toBeOnTheScreen();
    await act(async () => {
      fireEvent.press(screen.getByText("Row"));
    });

    expect(useWorkoutStore.getState().activeWorkout!.exercises.map((e) => e.id)).toEqual(["bench-press", "squat", "row__barbell"]);
    expect(screen.getByLabelText("Exercise 3 of 3")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: /^Last time 60 by 8/ })).toBeOnTheScreen();
  });

  // TICKET-067: an empty Freestyle offers Add exercise in the middle, and says
  // nothing about a plan it does not have, in the picker or the menu.
  it("an empty Freestyle: Add exercise in the middle opens the picker, which promises nothing about a plan", async () => {
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout([], { id: FREESTYLE_ID, name: "Freestyle" }) });
    seedCatalog();

    expect(screen.getByText("Add your first exercise")).toBeOnTheScreen();
    fireEvent.press(within(screen.getByTestId("logger-empty")).getByRole("button", { name: "Add exercise" }));
    expect(screen.getByText("Your first exercise.")).toBeOnTheScreen();
    await act(async () => {
      fireEvent.press(screen.getByText("Row"));
    });
    expect(useWorkoutStore.getState().activeWorkout!.exercises.map((e) => e.id)).toEqual(["row__barbell"]);
    expect(screen.queryByTestId("logger-empty")).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "Workout options" }));
    fireEvent.press(screen.getByRole("button", { name: "Add exercise, Goes at the end of today's list." }));
    expect(screen.getByText("Goes after Row.")).toBeOnTheScreen();
  });

  it("swapping an added exercise offers no Back to plan and says nothing about the plan", async () => {
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press"]) });
    seedCatalog();
    await act(async () => {
      await useWorkoutStore.getState().addExercise({ id: "row__barbell", name: "", nameSnapshot: "Row", fields: CATALOG_ROW.versions[0].fields });
    });

    fireEvent.press(screen.getByRole("button", { name: "Row options" }));
    fireEvent.press(screen.getByRole("button", { name: /^Swap exercise/ }));

    expect(screen.getByText("For this workout only.")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /^Back to plan/ })).toBeNull();
  });
});

// TICKET-069: ⋯ → Remove from today, with one Undo under the header.
describe("remove exercise", () => {
  const cardioAndBack = () => buildWorkout(["Treadmill Walk", "Stationary Bike", "Lat Pulldown"]);
  const openMenu = (name: string) => fireEvent.press(screen.getByRole("button", { name: `${name} options` }));
  const remove = async (name: string) => {
    openMenu(name);
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: /^Remove from today/ }));
    });
  };

  it("lands on the next exercise with the Undo bar; Undo brings the removed one back, in view", async () => {
    renderScreen(ActiveWorkoutScreen, { workout: cardioAndBack() });

    await remove("Treadmill Walk");

    expect(screen.getByLabelText("Exercise 1 of 2")).toBeOnTheScreen();
    expect(screen.getByText("Stationary Bike")).toBeOnTheScreen();
    expect(screen.getByLabelText("Treadmill Walk removed")).toBeOnTheScreen();

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Undo" }));
    });

    expect(screen.getByLabelText("Exercise 1 of 3")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Treadmill Walk options" })).toBeOnTheScreen();
    expect(screen.queryByTestId("removed-exercise-bar")).toBeNull();
  });

  it("the Undo bar goes on the next action (paging)", async () => {
    renderScreen(ActiveWorkoutScreen, { workout: cardioAndBack() });
    await remove("Treadmill Walk");

    await act(async () => {
      fireEvent.press(nextArrow());
    });

    expect(screen.getByText("Lat Pulldown")).toBeOnTheScreen();
    expect(screen.queryByTestId("removed-exercise-bar")).toBeNull();
  });

  // Typing lives in the logger, not the store, so it is not "the next action".
  it("the Undo bar stays while the user types into the next exercise", async () => {
    renderScreen(ActiveWorkoutScreen, { workout: cardioAndBack() });
    await remove("Treadmill Walk");

    fireEvent.changeText(screen.getByLabelText("Weight · kg"), "60");

    expect(screen.getByDisplayValue("60")).toBeOnTheScreen();
    expect(screen.getByLabelText("Treadmill Walk removed")).toBeOnTheScreen();
  });

  it("is disabled with its reason once a set is logged", () => {
    const logged = buildExercise("Lat Pulldown", { sets: [{ id: 1, segments: [{ Weight: 55, Reps: 10 }] }] });
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout([], { exercises: [logged] }) });

    openMenu("Lat Pulldown");

    expect(
      screen.getByRole("button", { name: "Remove from today, Only before set 1. Delete the logged sets to remove." })
    ).toBeDisabled();
  });

  // Swap said "Your plan keeps it." in a Freestyle from TICKET-067 until here.
  it("in a Freestyle, Swap and Remove say nothing about a plan", () => {
    renderScreen(ActiveWorkoutScreen, {
      workout: buildWorkout([], { id: FREESTYLE_ID, name: "Freestyle", exercises: [buildExercise("Lat Pulldown")] }),
    });

    openMenu("Lat Pulldown");

    // By label: a role's name also matches the row's title text, which is the
    // same with or without the detail line.
    expect(screen.getByLabelText("Swap exercise")).toBeEnabled();
    expect(screen.getByLabelText("Remove from today")).toBeEnabled();
  });
});
