// TICKET-091 (boards UnitSheet, UnitCarrySheet, UnitSheetLogged, UnitAfterSet1).
// The store action's own cases are in useWorkoutStore.test.ts; these check what
// the screen does with it.

import { act, fireEvent, screen, within } from "@testing-library/react-native";
import ActiveWorkoutScreen from "../../screens/workout_management/ActiveWorkoutScreen";
import { renderScreen } from "../../test/renderScreen";
import { buildExercise, buildStats, buildWorkout } from "../../test/fixtures";
import { useWorkoutStore } from "../../stores/useWorkoutStore";
import { ExerciseField } from "../../types/workoutType";

const PLATES: ExerciseField[] = [
  { name: "Weight", role: "weight", unit: "plates" },
  { name: "Reps", role: "reps" },
];
const WALK: ExerciseField[] = [
  { name: "Weight", role: "weight", unit: "kg" },
  { name: "Distance", role: "distance", unit: "m" },
];

// Last time on the machine was in plates; the slot starts in the catalog's kg.
const lastTime = buildStats("Bench Press", [{ fields: PLATES, sets: [{ Weight: "8", Reps: "15" }] }]);
const history = { [lastTime.exerciseId]: lastTime };

const unitButton = (field: string, unit: string) =>
  screen.getByRole("button", { name: `${field} unit: ${unit}. Change unit` });
const openSheet = (field = "Weight", unit = "kg") => fireEvent.press(unitButton(field, unit));
const sheet = () => within(screen.getByTestId("units-sheet"));
const choose = async (unit: string) => {
  // The store writes to the phone before the card changes.
  await act(async () => {
    fireEvent.press(sheet().getByRole("radio", { name: unit }));
  });
};

describe("Units sheet", () => {
  it("the label opens it; choosing last time's unit relabels the card and brings the targets back", async () => {
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press"]), history });
    expect(screen.getByText(/^Last time was in plates/)).toBeOnTheScreen();

    openSheet();
    expect(sheet().getByText("Last time: plates")).toBeOnTheScreen();
    expect(sheet().getByRole("radio", { name: "kg" })).toBeChecked();
    // Reps has no unit, so no block for it.
    expect(sheet().queryByLabelText("Reps unit")).toBeNull();
    // Before a set is logged there is nothing to relabel.
    expect(screen.queryByTestId("units-relabel")).toBeNull();

    await choose("plates");

    expect(sheet().getByRole("radio", { name: "plates" })).toBeChecked();
    expect(sheet().getByText(/^Plates or pin number/)).toBeOnTheScreen();
    expect(screen.getByLabelText("Weight · plates")).toBeOnTheScreen();
    // The stepper follows the unit: one plate a tap, not 2.5.
    expect(screen.getByRole("button", { name: "Increase Weight by 1" })).toBeOnTheScreen();
    // Units match again, so the comparison with last time is back.
    expect(screen.queryByText(/^Last time was in plates/)).toBeNull();
    expect(screen.getAllByText("8 × 15").length).toBeGreaterThan(0);
  });

  it("after a set it still changes: the note says so before the tap, the set keeps its numbers", async () => {
    const workout = buildWorkout([], {
      exercises: [buildExercise("Bench Press", { sets: [{ id: 1, segments: [{ Weight: "8", Reps: "15" }] }] })],
    });
    renderScreen(ActiveWorkoutScreen, { workout, history });
    expect(screen.getByRole("button", { name: "Remove set 1: 8 kg by 15" })).toBeOnTheScreen();

    openSheet();
    expect(screen.getByTestId("units-relabel")).toHaveTextContent(
      "A new unit also relabels today's 1 set. The numbers stay as typed: 8 kg × 15 becomes 8 plates × 15.",
      // The info icon's glyph is the first character of the text.
      { exact: false }
    );

    await choose("plates");

    expect(screen.getByRole("button", { name: "Remove set 1: 8 plates by 15" })).toBeOnTheScreen();
    expect(useWorkoutStore.getState().activeWorkout?.exercises[0].sets[0].segments).toEqual([
      { Weight: "8", Reps: "15" },
    ]);
  });

});

// Stage 2 (boards UnitNotice, UnitCarryCard, UnitMenu).
describe("unit notice and menu item", () => {
  const WALK_LB: ExerciseField[] = [
    { name: "Weight", role: "weight", unit: "lb" },
    { name: "Distance", role: "distance", unit: "m" },
  ];
  const walkLast = buildStats("Farmer's Walk", [{ fields: WALK_LB, sets: [{ Weight: "50", Distance: "40" }] }]);

  it("the unit notice is a line only: nothing beside it offers the fix", () => {
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press"]), history });
    expect(screen.getByText("Last time was in plates (8 plates × 15)")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /^Use / })).toBeNull();
  });

  it("an exercise with no reps still gets the line, naming the field that differs", () => {
    const workout = buildWorkout([], { exercises: [buildExercise("Farmer's Walk", { fields: WALK })] });
    renderScreen(ActiveWorkoutScreen, { workout, history: { [walkLast.exerciseId]: walkLast } });

    expect(screen.getByText("Last time weight was in lb (50 lb · 40 m)")).toBeOnTheScreen();
  });

  it("⋯ → Units opens the sheet with the units as they are, at any set", () => {
    const workout = buildWorkout([], {
      exercises: [buildExercise("Farmer's Walk", { fields: WALK, sets: [{ id: 1, segments: [{ Weight: "24", Distance: "40" }] }] })],
    });
    renderScreen(ActiveWorkoutScreen, { workout });

    fireEvent.press(screen.getByRole("button", { name: "Farmer's Walk options" }));
    fireEvent.press(screen.getByRole("button", { name: "Units, Weight kg · Distance m" }));

    expect(sheet().getByLabelText("Distance unit")).toBeOnTheScreen();
  });

  it("during rest the panel shows the line", async () => {
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout(["Bench Press"]), history });
    fireEvent.changeText(screen.getByLabelText("Weight · kg"), "40");
    fireEvent.changeText(screen.getByLabelText("Reps"), "12");
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: /^Log set \d+$/ }));
    });

    expect(screen.getByLabelText(/rest left/)).toBeOnTheScreen();
    // Set 2: last time stopped at one set, so no numbers are quoted. Exact text:
    // the Today row's caption also starts "Last time was in plates".
    expect(screen.getByText("Last time was in plates")).toBeOnTheScreen();
  });

  it("⋯ has no Units item when no field has a unit to choose, whatever the exercise is", () => {
    const pullUp = buildExercise("Pull-Up", { fields: [{ name: "Reps", role: "reps" }] });
    renderScreen(ActiveWorkoutScreen, { workout: buildWorkout([], { exercises: [pullUp] }) });

    fireEvent.press(screen.getByRole("button", { name: "Pull-Up options" }));

    expect(screen.getByRole("button", { name: /^Split set 1,/ })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /^Units/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /unit: / })).toBeNull();
  });
});

