// TICKET-043 stage 3: the picker's main behaviours, on the real catalog and
// search words. TICKET-050 stage 2: the start page (Recent), filters and the
// version used last. The sheet's rules are tested as pure functions in
// utils/versionSheet.test.ts; these check the screen wires them up.

import React from "react";
import { TextInput } from "react-native";
import { fireEvent, screen, within } from "@testing-library/react-native";
import { CATALOG } from "../../catalog";
import { SEARCH_WORDS } from "../../catalog/searchWords";
import { renderScreen } from "../../test/renderScreen";
import type { Exercise } from "../../types/workoutType";
import type { WorkoutSessionDoc } from "../../types/workoutSession";
import { buildCatalogIndex, planExerciseForVersion } from "../../utils/catalog";
import { preparePicker } from "../../utils/pickerData";
import { buildRecentHistory, recentDateLabel, type RecentHistory } from "../../utils/recents";
import ExercisePicker, { type PickerMode } from "./ExercisePicker";

const bench = CATALOG.find((m) => m.id === "bench_press")!;
const closeGrip = bench.versions.find((v) => v.id === "bench_press__barbell__close_grip")!;

/** One logged workout: close-grip bench and the pec deck, two days ago. */
const LOGGED_AT = Date.now() - 2 * 86_400_000;
const history = (): RecentHistory => {
  const session: WorkoutSessionDoc = {
    sessionId: "s1", workoutId: "push", workoutName: "Push", startedAt: LOGGED_AT, endedAt: LOGGED_AT + 1,
    exerciseIds: [closeGrip.id, "pec_deck__machine"], rollupPending: false,
  };
  return buildRecentHistory([session], [], "me", buildCatalogIndex(CATALOG), [])!;
};

function renderPicker(inPlan: string[] = [], customExercises: Exercise[] = [], recentHistory: RecentHistory | null = null, mode?: PickerMode) {
  const onPick = jest.fn();
  const plan = new Set(inPlan);
  renderScreen(() => (
    <ExercisePicker
      movements={CATALOG}
      searchWords={SEARCH_WORDS}
      customExercises={customExercises}
      inPlan={plan}
      recentHistory={recentHistory}
      mode={mode}
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
    expect(screen.getByText("In this plan: Dumbbell, incline")).toBeTruthy(); // why it is disabled
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

  it("before typing: Recent with the combination and date, then All exercises; a one-version recent adds at once or reads In plan; no history, A–Z", () => {
    const date = recentDateLabel(LOGGED_AT, Date.now());
    const onPick = renderPicker([], [], history());
    expect(screen.getByText("Recent")).toBeTruthy();
    expect(screen.getByText(`Barbell, close grip · ${date}`)).toBeTruthy();
    expect(screen.getByText("All exercises")).toBeTruthy();
    fireEvent.press(screen.getByText(date)); // Pec Deck: one version, its row shows the date only
    const pecDeck = CATALOG.find((m) => m.id === "pec_deck")!;
    expect(onPick).toHaveBeenCalledWith(planExerciseForVersion(pecDeck, pecDeck.versions[0]));

    screen.unmount();
    const blocked = renderPicker(["pec_deck__machine"], [], history());
    expect(screen.getByText("In plan")).toBeTruthy();
    fireEvent.press(screen.getByText(date));
    expect(blocked).not.toHaveBeenCalled();

    // No history known (query pending or failed): no Recent, the A–Z list.
    screen.unmount();
    renderPicker([], [], null);
    expect(screen.queryByText("Recent")).toBeNull();
    expect(screen.getByText("Exercises")).toBeTruthy();
  });

  it("a recent opens its sheet on the version used last, marked last except on defaults", () => {
    const onPick = renderPicker([], [], history());
    fireEvent.press(screen.getByText("Bench Press"));
    expect(screen.getByLabelText("Equipment Barbell, last used").props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText("Grip Close, last used").props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText("Angle Flat").props.accessibilityState).toMatchObject({ selected: true }); // default: no "last"
    expect(screen.getByText(`Last logged: Barbell, close grip, ${recentDateLabel(LOGGED_AT, Date.now())}`)).toBeTruthy();
    fireEvent.press(screen.getByText("Add Bench Press · Barbell, close grip"));
    expect(onPick).toHaveBeenCalledWith(planExerciseForVersion(bench, closeGrip));
  });

  it("Chest + Dumbbell: Recent goes, only matching movements remain, ANDed with a query; the sheet opens on Dumbbell", () => {
    renderPicker([], [], history());
    fireEvent.press(screen.getByLabelText("Muscle filter"));
    fireEvent.press(screen.getByText("Chest"));
    fireEvent.press(screen.getByLabelText("Equipment filter"));
    fireEvent.press(within(screen.getByTestId("filter-sheet")).getByText("Dumbbell"));

    expect(screen.queryByText("Recent")).toBeNull();
    expect(screen.getByText("Floor Press")).toBeTruthy();
    expect(screen.queryByText("Overhead Press")).toBeNull(); // chest is secondary there
    expect(screen.queryByText("Pec Deck (Machine Fly)")).toBeNull(); // chest, no dumbbell

    type("press"); // unfiltered, this lists Overhead Press first
    expect(screen.getByText("Bench Press")).toBeTruthy();
    expect(screen.queryByText("Overhead Press")).toBeNull();

    type("");
    fireEvent.press(screen.getByText("Bench Press"));
    // The filter counts as typed equipment, so last used (Barbell) does not apply.
    expect(screen.getByLabelText("Equipment Dumbbell").props.accessibilityState).toMatchObject({ selected: true });
  });

  it("builds the search catalog once per catalog, words and custom list, not once per open", () => {
    const custom: Exercise[] = [];
    const first = preparePicker(CATALOG, SEARCH_WORDS, custom);
    expect(preparePicker(CATALOG, SEARCH_WORDS, custom)).toBe(first);
    expect(preparePicker(CATALOG, SEARCH_WORDS, [])).not.toBe(first);
  });

  it("swap: Back to plan reads In workout and is disabled when another slot holds the plan's exercise", () => {
    const plank: Exercise = { id: "plank__bodyweight", name: "Plank", fields: [] };
    const mode: PickerMode = {
      kind: "swap",
      replacing: { id: "bench_press__dumbbell__flat", title: "Bench Press" },
      planned: { exercise: plank, title: "Plank" },
    };
    const onPick = renderPicker(["bench_press__dumbbell__flat", plank.id], [], null, mode);
    const back = screen.getByRole("button", { name: "Back to plan: Plank" });
    expect(back.props.accessibilityState).toMatchObject({ disabled: true });
    expect(within(back).getByText("In workout")).toBeTruthy();
    fireEvent.press(back);
    expect(onPick).not.toHaveBeenCalled();
  });
});
