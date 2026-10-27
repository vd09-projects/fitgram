// TICKET-043 stage 3: the picker's main behaviours, on the real catalog and
// search words. The sheet's rules are tested as pure functions in
// utils/versionSheet.test.ts; these check the screen wires them up.

import React from "react";
import { TextInput } from "react-native";
import { fireEvent, screen } from "@testing-library/react-native";
import { CATALOG } from "../../catalog";
import { SEARCH_WORDS } from "../../catalog/searchWords";
import { renderScreen } from "../../test/renderScreen";
import type { Exercise } from "../../types/workoutType";
import { planExerciseForVersion } from "../../utils/catalog";
import ExercisePicker, { preparePicker } from "./ExercisePicker";

const bench = CATALOG.find((m) => m.id === "bench_press")!;

function renderPicker(inPlan: string[] = [], customExercises: Exercise[] = []) {
  const onPick = jest.fn();
  const plan = new Set(inPlan);
  renderScreen(() => (
    <ExercisePicker
      movements={CATALOG}
      searchWords={SEARCH_WORDS}
      customExercises={customExercises}
      inPlan={plan}
      onPick={onPick}
      onClose={jest.fn()}
    />
  ));
  return onPick;
}
const type = (text: string) => fireEvent.changeText(screen.UNSAFE_getByType(TextInput), text);

describe("ExercisePicker", () => {
  it("lists every movement A–Z before typing; a search shows one row per movement, and custom exercises", () => {
    renderPicker([], [{ id: "my_hack_thing", name: "Hack Thing", fields: [] }]);
    const first = [...CATALOG].sort((a, b) => a.name.localeCompare(b.name))[0];
    expect(screen.getByText(first.name)).toBeTruthy();

    type("chest");
    expect(screen.getAllByText("Bench Press")).toHaveLength(1);
    expect(screen.getByText(`${bench.versions.length} versions`)).toBeTruthy();
    expect(screen.getByText("Chest · triceps, front delts")).toBeTruthy();

    type("hack thing");
    expect(screen.getByText("Hack Thing")).toBeTruthy();
    expect(screen.getByText("Custom")).toBeTruthy();
  });

  it('"db bench" preselects Dumbbell, and Add returns what planExerciseFromPick expects', () => {
    const onPick = renderPicker();
    type("db bench");
    fireEvent.press(screen.getByText("Bench Press"));

    expect(screen.getByLabelText("Equipment Dumbbell").props.accessibilityState).toMatchObject({ selected: true });
    fireEvent.press(screen.getByText("Add Bench Press · Dumbbell"));
    const dumbbell = bench.versions.find((v) => v.id === "bench_press__dumbbell")!;
    expect(onPick).toHaveBeenCalledWith(planExerciseForVersion(bench, dumbbell));
  });

  it("what is already in the plan cannot be added: a one-version row reads In plan, a combination is disabled", () => {
    const onPick = renderPicker(["pec_deck__machine", "bench_press__dumbbell__incline"]);
    type("pec deck");
    expect(screen.getByText("In plan")).toBeTruthy();
    fireEvent.press(screen.getByText("Pec Deck (Machine Fly)"));
    expect(onPick).not.toHaveBeenCalled();

    type("incline db bench");
    fireEvent.press(screen.getByText("Bench Press"));
    expect(screen.getByLabelText("Angle Incline").props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByText("Already in this plan"));
    expect(onPick).not.toHaveBeenCalled();
  });

  it('heads typo results "Close matches", others "Exercises", and explains no match', () => {
    renderPicker();
    type("dumbell curl"); // the equipment word itself was corrected
    expect(screen.getByText("Close matches")).toBeTruthy();
    type("curl");
    expect(screen.getByText("Exercises")).toBeTruthy();
    type("zzzz qqqq");
    expect(screen.getByText("No exercise matches")).toBeTruthy();
  });

  it("builds the search catalog once per catalog, words and custom list, not once per open", () => {
    const custom: Exercise[] = [];
    const first = preparePicker(CATALOG, SEARCH_WORDS, custom);
    expect(preparePicker(CATALOG, SEARCH_WORDS, custom)).toBe(first);
    expect(preparePicker(CATALOG, SEARCH_WORDS, [])).not.toBe(first);
  });
});
