import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { Modal } from "react-native";
import ActiveWorkoutScreen from "../../screens/workout_management/ActiveWorkoutScreen";
import { renderScreen } from "../../test/renderScreen";
import { buildExercise, buildStats, buildWorkout, StatsSessionSpec } from "../../test/fixtures";
import { ExerciseField } from "../../types/workoutType";
import { ExerciseSet } from "../../types/zustandWorkoutType";
import { formatSessionDate } from "../../utils/setDeltas";

const LB: ExerciseField[] = [
  { name: "Weight", role: "weight", unit: "lb" },
  { name: "Reps", role: "reps" },
];

const sets = (...pairs: [string, string][]): ExerciseSet[] =>
  pairs.map(([Weight, Reps], i) => ({ id: i + 1, fields: { Weight, Reps } }));

const benchWith = (today: ExerciseSet[]) =>
  buildWorkout([], { exercises: [buildExercise("Bench Press", { sets: today })] });

const historyOf = (...sessions: StatsSessionSpec[]) => {
  const stats = buildStats("Bench Press", sessions);
  return { [stats.exerciseId]: stats };
};

// The newest session is a day ago, the next two days ago (fixture default).
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => formatSessionDate(Date.now() - n * DAY_MS);

const openHistory = () => fireEvent.press(screen.getByRole("button", { name: /Show history$/ }));
const sheet = () => screen.getByTestId("history-sheet");

describe("ExerciseHistorySheet", () => {
  it("opens from the pill; the close control and Android back both dismiss it", () => {
    renderScreen(ActiveWorkoutScreen, {
      workout: benchWith(sets(["60", "9"])),
      history: historyOf({ sets: [{ Weight: "60", Reps: "8" }, { Weight: "62.5", Reps: "6" }] }),
    });
    expect(screen.queryByTestId("history-sheet")).toBeNull();

    openHistory();
    expect(within(sheet()).getByLabelText(`Set 1: ${daysAgo(1)} 60 kg by 8; today 60 kg by 9, improved: +1 rep`)).toBeOnTheScreen();
    expect(within(sheet()).getByText("UP NEXT")).toBeOnTheScreen();

    fireEvent.press(within(sheet()).getByRole("button", { name: "Close history" }));
    expect(screen.queryByTestId("history-sheet")).toBeNull();

    openHistory();
    // The screen has other modals (discard dialog); the open one is the sheet.
    const open = screen.UNSAFE_getAllByType(Modal).filter((modal) => modal.props.visible);
    expect(open).toHaveLength(1);
    fireEvent(open[0], "requestClose");
    expect(screen.queryByTestId("history-sheet")).toBeNull();
  });

  it("selecting a session chip switches the table to that session", () => {
    renderScreen(ActiveWorkoutScreen, {
      workout: benchWith(sets(["60", "8"])),
      history: historyOf({ sets: [{ Weight: "60", Reps: "8" }] }, { sets: [{ Weight: "55", Reps: "8" }] }),
    });
    openHistory();
    expect(within(sheet()).getByText("matched")).toBeOnTheScreen();

    fireEvent.press(within(sheet()).getByRole("button", { name: new RegExp(`^${daysAgo(2)},`) }));

    expect(within(sheet()).getByText("55 kg × 8")).toBeOnTheScreen();
    expect(within(sheet()).getByText("+5 kg")).toBeOnTheScreen();
    expect(within(sheet()).queryByText("matched")).toBeNull();
  });

  it("shows a session in another unit with its numbers, no deltas, and why", () => {
    renderScreen(ActiveWorkoutScreen, {
      workout: benchWith(sets(["60", "9"])),
      history: historyOf({ fields: LB, sets: [{ Weight: "135", Reps: "8" }] }),
    });
    openHistory();

    expect(within(sheet()).getByText("135 lb × 8")).toBeOnTheScreen();
    expect(within(sheet()).getByText("Logged in lb, today in kg, so not compared")).toBeOnTheScreen();
    expect(within(sheet()).queryByTestId(/^delta-/)).toBeNull();
  });

  it("an exercise with no history opens to an empty state, not an empty table", () => {
    renderScreen(ActiveWorkoutScreen, { workout: benchWith([]), history: { "bench-press": null } });
    openHistory();

    expect(within(sheet()).getByText("No history yet. Sessions you finish will show here.")).toBeOnTheScreen();
    expect(within(sheet()).queryByTestId("history-table")).toBeNull();
  });

  it("dismissing keeps a typed-but-unlogged value and the set number", async () => {
    renderScreen(ActiveWorkoutScreen, {
      workout: benchWith(sets(["60", "8"])),
      history: historyOf({ sets: [{ Weight: "60", Reps: "8" }, { Weight: "62.5", Reps: "6" }] }),
    });
    fireEvent.changeText(screen.getByLabelText("Weight · kg"), "61");

    openHistory();
    fireEvent.press(within(sheet()).getByRole("button", { name: "Close history" }));

    expect(screen.getByLabelText("Weight · kg").props.value).toBe("61");
    expect(screen.getByRole("button", { name: /^Log set \d+$/ })).toHaveAccessibleName("Log set 2");
    // And the set still logs with what was typed.
    fireEvent.changeText(screen.getByLabelText("Reps"), "6");
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Log set 2" }));
    });
    // Logging starts a rest (TICKET-021); Skip brings the card back.
    fireEvent.press(screen.getByRole("button", { name: "Skip rest" }));
    expect(screen.getByRole("button", { name: "Log set 3" })).toBeOnTheScreen();
  });
});
