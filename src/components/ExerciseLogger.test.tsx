import { act, fireEvent, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import ActiveWorkoutScreen from "../screens/workout_management/ActiveWorkoutScreen";
import { renderScreen } from "../test/renderScreen";
import { buildExercise, buildStats, buildWorkout } from "../test/fixtures";
import { useWorkoutStore } from "../stores/useWorkoutStore";
import { useColorSchemaStore } from "../stores/colorSchemaStore";
import { DefaultColorSchema, HinataHyugaColors } from "../constants/colors";
import { saveWorkoutSession } from "../services/db/workoutSessions";
import { ExerciseField } from "../types/workoutType";

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
      "Last time used a different unit, so no targets",
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
});
