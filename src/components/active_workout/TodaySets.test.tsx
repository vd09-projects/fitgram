import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { AllColorSchemas, DefaultColorSchema } from "../../constants/colors";
import ActiveWorkoutScreen from "../../screens/workout_management/ActiveWorkoutScreen";
import { renderScreen } from "../../test/renderScreen";
import { buildExercise, buildStats, buildWorkout } from "../../test/fixtures";
import { useWorkoutStore } from "../../stores/useWorkoutStore";
import { ExerciseField } from "../../types/workoutType";
import { ExerciseSet } from "../../types/zustandWorkoutType";

const sets = (...pairs: [string, string][]): ExerciseSet[] =>
  pairs.map(([Weight, Reps], i) => ({ id: i + 1, fields: { Weight, Reps } }));

const benchWith = (today: ExerciseSet[], fields?: ExerciseField[]) =>
  buildWorkout([], { exercises: [buildExercise("Bench Press", { sets: today, ...(fields && { fields }) })] });

const historyOf = (...pastSets: [string, string][]) => {
  const stats = buildStats("Bench Press", [{ sets: pastSets.map(([Weight, Reps]) => ({ Weight, Reps })) }]);
  return { [stats.exerciseId]: stats };
};

const role = AllColorSchemas[DefaultColorSchema].role;
const colorOf = (testID: string, label: string) =>
  StyleSheet.flatten(within(screen.getByTestId(testID)).getByText(label).props.style).color;

const press = (name: string | RegExp) =>
  act(async () => {
    fireEvent.press(screen.getByRole("button", { name }));
  });

describe("TodaySets", () => {
  it("shows today's sets with deltas against the same set last time", () => {
    renderScreen(ActiveWorkoutScreen, {
      workout: benchWith(sets(["60", "9"], ["62.5", "6"])),
      history: historyOf(["60", "8"], ["62.5", "6"], ["60", "8"]),
    });

    expect(screen.getByText("60 kg × 9")).toBeOnTheScreen();
    expect(within(screen.getByTestId("delta-improved")).getByText("+1 rep")).toBeOnTheScreen();
    expect(within(screen.getByTestId("delta-matched")).getByText("matched")).toBeOnTheScreen();
    expect(colorOf("delta-improved", "+1 rep")).toBe(role.signal);
    // 915 today against last time's first two sets, 855 — not its full 1,335.
    expect(screen.getByText("2 sets · 915 kg")).toBeOnTheScreen();
    expect(screen.getByText("+7.0% volume vs first 2 sets")).toBeOnTheScreen();
  });

  it("calls heavier-but-fewer down when volume fell, and shows both numbers", () => {
    renderScreen(ActiveWorkoutScreen, {
      workout: benchWith(sets(["67.5", "8"])),
      history: historyOf(["65", "9"]),
    });

    // 540 against 585: not an improvement because the weight went up.
    expect(within(screen.getByTestId("delta-down")).getByText("+2.5 kg · −1 rep")).toBeOnTheScreen();
    expect(colorOf("delta-down", "+2.5 kg · −1 rep")).toBe(role.textSecondary);
  });

  const LB: ExerciseField[] = [
    { name: "Weight", role: "weight", unit: "lb" },
    { name: "Reps", role: "reps" },
  ];
  it.each([
    ["first time", { "bench-press": null }, undefined],
    ["unit changed since last session", historyOf(["60", "8"]), LB],
  ])("%s: rows with values, no delta, no percentage", (_case, history, fields) => {
    renderScreen(ActiveWorkoutScreen, { workout: benchWith(sets(["135", "8"]), fields), history });

    const values = fields ? "135 lb × 8" : "135 kg × 8";
    // Set number and values, and nothing else: no 0, no dash posing as a delta.
    expect(screen.getByLabelText(`Set 1, ${values.replace("×", "by")}`)).toHaveTextContent(`1${values}`);
    expect(screen.queryByTestId(/^delta-/)).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("says volume is unavailable, with counts, rather than a partial sum", () => {
    renderScreen(ActiveWorkoutScreen, {
      workout: benchWith(sets(["60", "8"], ["60", "eight"])),
      history: historyOf(["60", "8"], ["60", "8"]),
    });

    expect(screen.getByText("2 sets · volume unavailable (1 of 2 sets)")).toBeOnTheScreen();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("removes a set, undo puts it back in place, and the footer follows both", async () => {
    renderScreen(ActiveWorkoutScreen, {
      workout: benchWith(sets(["60", "8"], ["650", "8"], ["60", "8"])),
      history: historyOf(["60", "8"], ["60", "8"], ["60", "8"]),
    });
    expect(screen.getByText("3 sets · 6,160 kg")).toBeOnTheScreen();

    await press("Remove set 2: 650 kg by 8");
    expect(screen.queryByText("650 kg × 8")).toBeNull();
    expect(screen.getByText("2 sets · 960 kg")).toBeOnTheScreen();

    await press("Undo: restore set 2, 650 kg by 8");
    const stored = useWorkoutStore.getState().activeWorkout!.exercises[0].sets;
    expect(stored.map((s) => s.fields.Weight)).toEqual(["60", "650", "60"]);
    expect(screen.getByText("3 sets · 6,160 kg")).toBeOnTheScreen();
  });

  it("keeps one undo at a time, and logging a set clears it", async () => {
    renderScreen(ActiveWorkoutScreen, {
      workout: benchWith(sets(["60", "8"], ["650", "8"], ["70", "8"])),
      history: historyOf(["60", "8"]),
    });

    await press("Remove set 2: 650 kg by 8");
    await press("Remove set 2: 70 kg by 8");
    expect(screen.getAllByRole("button", { name: /^Undo/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /^Undo/ })).toHaveAccessibleName(
      "Undo: restore set 2, 70 kg by 8"
    );

    fireEvent.changeText(screen.getByLabelText("Weight · kg"), "60");
    fireEvent.changeText(screen.getByLabelText("Reps"), "8");
    await press(/^Log set \d+$/);
    expect(screen.queryByRole("button", { name: /^Undo/ })).toBeNull();
  });

  // Covers TICKET-018 and TICKET-019 together: both rely on ExerciseLogger being
  // keyed by exercise to drop typed values and a pending undo on navigation.
  it("leaving an exercise drops its typed values and its pending undo", async () => {
    const workout = buildWorkout([], {
      exercises: [
        buildExercise("Bench Press", { sets: sets(["60", "8"], ["650", "8"]) }),
        buildExercise("Squat", { sets: sets(["100", "5"]) }),
      ],
    });
    renderScreen(ActiveWorkoutScreen, { workout, history: historyOf(["60", "8"]) });

    fireEvent.changeText(screen.getByLabelText("Weight · kg"), "62.5");
    await press("Remove set 2: 650 kg by 8");
    expect(screen.getByRole("button", { name: /^Undo/ })).toBeOnTheScreen();

    await press("Next exercise: Squat");
    expect(screen.getByLabelText("Weight · kg").props.value).toBe("");
    expect(screen.queryByRole("button", { name: /^Undo/ })).toBeNull();

    await press("Previous exercise: Bench Press");
    expect(screen.getByLabelText("Weight · kg").props.value).toBe("");
    expect(screen.queryByRole("button", { name: /^Undo/ })).toBeNull();
    expect(useWorkoutStore.getState().activeWorkout!.exercises[0].sets).toHaveLength(1);
  });
});
