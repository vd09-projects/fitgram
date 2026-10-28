import { act, fireEvent, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import ActiveWorkoutScreen from "../screens/workout_management/ActiveWorkoutScreen";
import { renderScreen } from "../test/renderScreen";
import { buildExercise, buildStats, buildWorkout } from "../test/fixtures";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useWorkoutStore } from "../stores/useWorkoutStore";
import { useColorSchemaStore } from "../stores/colorSchemaStore";
import { DefaultColorSchema, HinataHyugaColors } from "../constants/colors";
import { saveWorkoutSession } from "../services/db/workoutSessions";
import { ExerciseField } from "../types/workoutType";
import { Effort } from "../types/workoutSession";

// Only the Finish test reaches it, through the real `endWorkout`.
jest.mock("../services/db/workoutSessions", () => ({
  ...jest.requireActual("../services/db/workoutSessions"),
  saveWorkoutSession: jest.fn(),
}));

const weight = () => screen.getByLabelText("Weight · kg");
const reps = () => screen.getByLabelText("Reps");
const logButton = () => screen.getByRole("button", { name: /^Log set \d+$/ });
const loggedSets = () => useWorkoutStore.getState().activeWorkout?.exercises[0].sets ?? [];

const lastTime = buildStats("Bench Press", [
  { sets: [{ Weight: "60", Reps: "8" }, { Weight: "62.5", Reps: "6" }] },
]);
const withHistory = { [lastTime.exerciseId]: lastTime };

// Logging awaits storage before the store changes.
const logSet = () =>
  act(async () => {
    fireEvent.press(logButton());
  });

describe("ExerciseLogger", () => {
  it("ghosts last session's values for the set about to be logged", () => {
    const workout = buildWorkout([], {
      exercises: [buildExercise("Bench Press", { sets: [{ id: 1, fields: { Weight: "60", Reps: "8" } }] })],
    });
    renderScreen(ActiveWorkoutScreen, { workout, history: withHistory });

    expect(logButton()).toHaveAccessibleName("Log set 2");
    expect(weight().props.placeholder).toBe("62.5");
    expect(reps().props.placeholder).toBe("6");
    expect(weight().props.value).toBe("");
    expect(screen.getByText("62.5 × 6")).toBeOnTheScreen();

    // An empty field steps from its ghost.
    fireEvent.press(screen.getByRole("button", { name: "Increase Weight by 2.5" }));
    expect(weight().props.value).toBe("65");
  });

  const PLANK: ExerciseField[] = [
    { name: "Time", role: "time", unit: "s" },
    { name: "Notes", role: "other" },
  ];

  const LB: ExerciseField[] = [
    { name: "Weight", role: "weight", unit: "lb" },
    { name: "Reps", role: "reps" },
  ];
  const twoSetsDone = [
    { id: 1, fields: { Weight: "60", Reps: "8" } },
    { id: 2, fields: { Weight: "62.5", Reps: "6" } },
  ];

  it.each([
    ["never prefetched", undefined, buildExercise("Bench Press"), "Last session not loaded"],
    ["first time", { "bench-press": null }, buildExercise("Bench Press"), "First time on this exercise"],
    [
      "plank, no weight+reps",
      { plank: buildStats("Plank", [{ fields: PLANK, sets: [{ Time: "60" }] }]) },
      buildExercise("Plank", { fields: PLANK }),
      "No weight and reps to target",
    ],
    // Set 3 against a last session of 2 sets: setAt(3) is null, not a zero.
    [
      "past the sets last session reached",
      withHistory,
      buildExercise("Bench Press", { sets: twoSetsDone }),
      "Last time stopped at 2 sets",
    ],
    // Last time in kg, the exercise is now lb: units are never converted.
    [
      "unit changed since last session",
      withHistory,
      buildExercise("Bench Press", { fields: LB }),
      "Last time was in kg (60 kg × 8), so no targets",
    ],
  ])("%s: no ghost, says why, still logs", async (_case, history, exercise, notice) => {
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout([], { exercises: [exercise] }), history });

    expect(screen.getByText(notice)).toBeOnTheScreen();
    expect(screen.queryByText("LAST TIME")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Repeat/ })).toBeNull();

    const [first] = exercise.fields;
    const input = screen.getByLabelText(first.unit ? `${first.name} · ${first.unit}` : first.name);
    expect(input.props.placeholder).toBeUndefined();

    for (const field of exercise.fields.filter((f) => f.role !== "other")) {
      fireEvent.changeText(screen.getByLabelText(field.unit ? `${field.name} · ${field.unit}` : field.name), "5");
    }
    await logSet();
    expect(loggedSets()).toHaveLength(exercise.sets.length + 1);
  });

  it("repeat fills every field from last session's set", async () => {
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press"]), history: withHistory });

    fireEvent.press(screen.getByRole("button", { name: /^Repeat last session's set 1/ }));
    expect(weight().props.value).toBe("60");
    expect(reps().props.value).toBe("8");

    await logSet();
    expect(loggedSets()[0].fields).toEqual({ Weight: "60", Reps: "8" });
  });

  it("refuses Log set with an untouched field and names it, ghost or not", async () => {
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press"]), history: withHistory });

    await logSet();
    expect(screen.getByText("Enter Weight and Reps to log set 1")).toBeOnTheScreen();

    // Typing clears the message; the next refusal names only what is left.
    fireEvent.changeText(weight(), "60");
    expect(screen.queryByText(/^Enter /)).toBeNull();
    await logSet();

    expect(screen.getByText("Enter Reps to log set 1")).toBeOnTheScreen();
    expect(loggedSets()).toHaveLength(0);
  });

  it("refuses an empty set when every field is optional", async () => {
    const exercise = buildExercise("Stretch", { fields: [{ name: "Notes", role: "other" }] });
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout([], { exercises: [exercise] }) });

    await logSet();

    expect(screen.getByText("Enter a value to log set 1")).toBeOnTheScreen();
    expect(loggedSets()).toHaveLength(0);
  });

  it("a logged set advances the set number and clears the inputs", async () => {
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press"]), history: withHistory });

    fireEvent.changeText(weight(), "61");
    fireEvent.changeText(reps(), "8");
    await logSet();
    // Logging starts a rest (TICKET-021); Skip brings the card back.
    fireEvent.press(screen.getByRole("button", { name: "Skip rest" }));

    expect(loggedSets()).toEqual([{ id: 1, fields: { Weight: "61", Reps: "8" } }]);
    expect(logButton()).toHaveAccessibleName("Log set 2");
    expect(weight().props.value).toBe("");
    expect(reps().props.value).toBe("");
    expect(weight().props.placeholder).toBe("62.5");
  });

  it("a set logged on the card is what Finish saves", async () => {
    const save = saveWorkoutSession as jest.Mock;
    save.mockResolvedValue({ sessionId: "s", rollupApplied: true });
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press"]), history: withHistory });

    fireEvent.press(screen.getByRole("button", { name: /^Repeat last session's set 1/ }));
    await logSet();
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: /Finish workout/ }));
    });

    expect(save).toHaveBeenCalledTimes(1);
    const savedWorkout = save.mock.calls[0][1];
    expect(savedWorkout.exercises[0].sets).toEqual([{ id: 1, fields: { Weight: "60", Reps: "8" } }]);
    log.mockRestore();
  });

  it("renders in the Hinata schema from its role tokens", () => {
    useColorSchemaStore.setState({ currentColorSchema: HinataHyugaColors.name });
    try {
      renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press"]), history: withHistory });
      const style = StyleSheet.flatten(weight().props.style);
      expect(style.borderColor).toBe(HinataHyugaColors.role.fieldEdge);
      expect(style.backgroundColor).toBe(HinataHyugaColors.role.raised);
      expect(weight().props.placeholderTextColor).toBe(HinataHyugaColors.role.textGhost);
    } finally {
      // Not reset by renderScreen; leaking it would re-theme every later test.
      useColorSchemaStore.setState({ currentColorSchema: DefaultColorSchema });
    }
  });

  // TICKET-034
  it("shows last time's mark for the set about to be logged, on the pill and spelled out", async () => {
    const marked = buildStats("Bench Press", [
      { sets: [{ Weight: "60", Reps: "8" }, { Weight: "65", Reps: "6" }], setEffort: [null, Effort.Hard] },
    ]);
    renderScreen(ActiveWorkoutScreen, {
      workout: buildWorkout([], {
        exercises: [buildExercise("Bench Press", { sets: [{ id: 1, fields: { Weight: "60", Reps: "8" } }] })],
      }),
      history: { [marked.exerciseId]: marked },
    });

    expect(screen.getByRole("button", { name: "Last time 65 by 6, felt hard. Show history" })).toBeOnTheScreen();
    expect(screen.getByText(/^Felt hard last time/)).toBeOnTheScreen();
  });
});

// TICKET-040: edit a logged set before Finish.
describe("ExerciseLogger edit mode", () => {
  const benchWith = (sets: { id: number; fields: Record<string, string>; effort?: Effort }[]) =>
    buildWorkout([], { exercises: [buildExercise("Bench Press", { sets })] });
  const press = (name: string | RegExp) =>
    act(async () => {
      fireEvent.press(screen.getByRole("button", { name }));
    });
  const openEdit = async (row: RegExp, setNumber: number) => {
    await press(row);
    await press(`Edit set ${setNumber}`);
  };

  it("saves over the set in place: mark and position kept, no rest, next set's typing back after", async () => {
    renderScreen(ActiveWorkoutScreen, {
      workout: benchWith([
        { id: 1, fields: { Weight: "60", Reps: "8" } },
        { id: 2, fields: { Weight: "56", Reps: "8" }, effort: Effort.Easy },
        { id: 3, fields: { Weight: "65", Reps: "8" } },
      ]),
      history: withHistory,
    });
    fireEvent.changeText(weight(), "70");

    await openEdit(/^Set 2, 56 kg by 8/, 2);
    expect(weight().props.value).toBe("56");
    expect(weight().props.placeholder).toBe("62.5"); // last session's set 2, not set 4
    fireEvent.changeText(weight(), "65");
    await press("Save set 2");

    expect(loggedSets()).toEqual([
      { id: 1, fields: { Weight: "60", Reps: "8" } },
      { id: 2, fields: { Weight: "65", Reps: "8" }, effort: Effort.Easy },
      { id: 3, fields: { Weight: "65", Reps: "8" } },
    ]);
    expect(useWorkoutStore.getState().rest).toBeNull();
    expect(logButton()).toHaveAccessibleName("Log set 4");
    expect(weight().props.value).toBe("70");
  });

  it("clearing an optional field in the edit clears it from the set", async () => {
    const fields: ExerciseField[] = [
      { name: "Weight", role: "weight", unit: "kg" },
      { name: "Reps", role: "reps" },
      { name: "Band", role: "other" },
    ];
    const exercise = buildExercise("Bench Press", {
      fields,
      sets: [{ id: 1, fields: { Weight: "60", Reps: "8", Band: "red" } }],
    });
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout([], { exercises: [exercise] }) });

    await openEdit(/^Set 1, /, 1);
    fireEvent.changeText(screen.getByLabelText("Band"), "");
    await press("Save set 1");

    expect(loggedSets()).toEqual([{ id: 1, fields: { Weight: "60", Reps: "8" } }]);
  });

  // Ids are ordinals: a remove or undo during the edit would renumber the set
  // being edited, and Save would land on another one.
  it("keeps the list read-only while editing, so the edit lands on its own set; Undo waits", async () => {
    renderScreen(ActiveWorkoutScreen, {
      workout: benchWith([
        { id: 1, fields: { Weight: "60", Reps: "8" } },
        { id: 2, fields: { Weight: "650", Reps: "8" } },
        { id: 3, fields: { Weight: "70", Reps: "8" } },
      ]),
    });
    await press("Remove set 1: 60 kg by 8");
    await openEdit(/^Set 1, 650 kg by 8/, 1);

    expect(screen.queryByRole("button", { name: /^Remove set/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Undo/ })).toBeNull();
    expect(screen.getByText("Undo after this edit")).toBeOnTheScreen();

    fireEvent.changeText(weight(), "65");
    await press("Save set 1");
    await press(/^Undo/);
    expect(loggedSets().map((s) => s.fields.Weight)).toEqual(["60", "65", "70"]);
  });

  it("a failed save keeps the edit open and says so", async () => {
    renderScreen(ActiveWorkoutScreen, { workout: benchWith([{ id: 1, fields: { Weight: "60", Reps: "8" } }]) });
    await openEdit(/^Set 1, /, 1);
    fireEvent.changeText(weight(), "65");
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disk full"));
    await press("Save set 1");

    expect(screen.getByText("Couldn't save set 1")).toBeOnTheScreen();
    expect(weight().props.value).toBe("65");
    expect(loggedSets()[0].fields.Weight).toBe("60");
  });

  // No UI path removes the edited set; this stands in for the next one that does.
  it("ends an edit whose set leaves the store, so it cannot reopen when that id returns", async () => {
    renderScreen(ActiveWorkoutScreen, {
      workout: benchWith([
        { id: 1, fields: { Weight: "60", Reps: "8" } },
        { id: 2, fields: { Weight: "62.5", Reps: "8" } },
      ]),
    });
    await openEdit(/^Set 2, /, 2);
    const { removeSet, restoreSet } = useWorkoutStore.getState();
    const exerciseId = useWorkoutStore.getState().activeWorkout!.exercises[0].id;
    let removed: Awaited<ReturnType<typeof removeSet>> = null;
    await act(async () => {
      removed = await removeSet(exerciseId, 2);
    });
    await act(async () => {
      await restoreSet(exerciseId, removed!);
    });

    expect(logButton()).toHaveAccessibleName("Log set 3");
    expect(screen.queryByRole("button", { name: "Save set 2" })).toBeNull();
  });

  it("during a rest, takes the panel's slot without touching the rest, and gives it back on Save", async () => {
    renderScreen(ActiveWorkoutScreen, {
      workout: benchWith([{ id: 1, fields: { Weight: "60", Reps: "8" } }]),
    });
    const rest = { exerciseId: "bench-press", startedAt: Date.now(), durationMs: 90_000, setNumber: 1 };
    act(() => useWorkoutStore.setState({ rest }));

    await openEdit(/^Set 1, 60 kg by 8/, 1);
    expect(screen.queryByRole("button", { name: "Skip rest" })).toBeNull();
    expect(screen.getByLabelText(/^Rest keeps running, 1:(30|29) left$/)).toBeOnTheScreen();

    fireEvent.changeText(weight(), "");
    await press("Save set 1");
    expect(screen.getByText("Enter Weight to save set 1")).toBeOnTheScreen();

    fireEvent.changeText(weight(), "62.5");
    await press("Save set 1");
    expect(useWorkoutStore.getState().rest).toBe(rest);
    expect(screen.getByRole("button", { name: "Skip rest" })).toBeOnTheScreen();
    expect(loggedSets()[0].fields.Weight).toBe("62.5");
  });
});

// TICKET-033-1, canvas boards S1–S3.
describe("ExerciseLogger split set", () => {
  const splitWeight = (n: number) => screen.getByLabelText(`Split ${n} Weight · kg`);
  const splitReps = (n: number) => screen.getByLabelText(`Split ${n} Reps`);
  const start = (first: [string, string]) => {
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press"]), history: withHistory });
    fireEvent.changeText(weight(), first[0]);
    fireEvent.changeText(reps(), first[1]);
    fireEvent.press(screen.getByRole("button", { name: "Add a split to set 1" }));
  };

  it("starts each new row empty, and counts a row once something is typed in it", () => {
    start(["20", "5"]);

    // No guessed weight (user, 2026-10-29): every value in a row is typed.
    expect(splitWeight(1).props.value).toBe("");
    expect(splitReps(1).props.value).toBe("");
    // Split rows are compact: no steppers (board S2).
    expect(screen.queryByRole("button", { name: "Increase Weight by 2.5" })).toBeNull();
    // A blank row is dropped on Log, so it is not counted yet.
    expect(screen.getByLabelText("Set 1")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Cancel split 1" })).toBeOnTheScreen();

    fireEvent.changeText(splitWeight(1), "17.5");
    expect(screen.getByLabelText("Set 1, 1 split")).toBeOnTheScreen();
    fireEvent.changeText(splitReps(1), "3");
    fireEvent.press(screen.getByRole("button", { name: "Add another split" }));

    expect(splitWeight(2).props.value).toBe("");
    expect(screen.getByRole("button", { name: "Remove split 1" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Cancel split 2" })).toBeOnTheScreen();
  });

  it("logs the whole set with one Log: first segment as the set, the rest as splits, empty last row dropped, one rest", async () => {
    start(["20", "5"]);
    fireEvent.changeText(splitWeight(1), "17.5");
    fireEvent.changeText(splitReps(1), "3");
    fireEvent.press(screen.getByRole("button", { name: "Add another split" }));
    await logSet();

    expect(loggedSets()).toEqual([
      { id: 1, fields: { Weight: "20", Reps: "5" }, splits: [{ Weight: "17.5", Reps: "3" }] },
    ]);
    expect(useWorkoutStore.getState().rest?.setNumber).toBe(1);
    fireEvent.press(screen.getByRole("button", { name: "Skip rest" }));
    // The next set starts as a normal set.
    expect(screen.queryByLabelText("Split 1 Weight · kg")).toBeNull();
    expect(screen.getByRole("button", { name: "Add a split to set 2" })).toBeOnTheScreen();
  });

  it("refuses Log while an earlier split row is half filled, and names the row", async () => {
    start(["20", "5"]);
    fireEvent.changeText(splitWeight(1), "17.5");
    fireEvent.changeText(splitReps(1), "3");
    fireEvent.press(screen.getByRole("button", { name: "Add another split" }));
    fireEvent.changeText(splitWeight(2), "15");
    fireEvent.changeText(splitReps(2), "2");
    fireEvent.changeText(splitWeight(1), "");
    await logSet();

    expect(screen.getByText("Split 1: Enter Weight to log set 1")).toBeOnTheScreen();
    expect(loggedSets()).toHaveLength(0);
  });

  it("removing the first row makes the next row the set", async () => {
    start(["20", "5"]);
    fireEvent.changeText(splitWeight(1), "17.5");
    fireEvent.changeText(splitReps(1), "3");
    // With one row left there is nothing to remove: the card is a normal set.
    fireEvent.press(screen.getByRole("button", { name: "Remove the first row of set 1" }));

    expect(screen.queryByLabelText("Split 1 Weight · kg")).toBeNull();
    expect(weight().props.value).toBe("17.5");
    await logSet();
    expect(loggedSets()).toEqual([{ id: 1, fields: { Weight: "17.5", Reps: "3" } }]);
  });

  it("cancelling the only split row returns to a normal set with what was typed", () => {
    start(["20", "5"]);
    fireEvent.press(screen.getByRole("button", { name: "Cancel split 1" }));

    expect(screen.queryByLabelText("Split 1 Weight · kg")).toBeNull();
    expect(weight().props.value).toBe("20");
    expect(screen.getByRole("button", { name: "Increase Weight by 2.5" })).toBeOnTheScreen();
  });
});
