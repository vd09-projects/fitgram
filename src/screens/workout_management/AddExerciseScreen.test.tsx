// TICKET-051: Manage Workout edits the plan's exercises as a list, in a draft,
// with one Save changes for the whole plan.
// TICKET-050: Recent comes from one recent-sessions query per open.
// TICKET-052: plans are chosen and created in a sheet; a first plan without one.

import { StyleSheet, TextInput } from "react-native";
import { act, fireEvent, screen, within } from "@testing-library/react-native";
import AddExerciseScreen from "./AddExerciseScreen";
import { renderScreen, RenderScreenOptions, TEST_USER_ID } from "../../test/renderScreen";
import { buildWorkout } from "../../test/fixtures";
import { CATALOG } from "../../catalog";
import { getAllWorkoutPlans, overrideWorkoutDetails } from "../../services/db/userDB";
import { useCatalogStore } from "../../stores/useCatalogStore";
import { loadCatalog } from "../../utils/catalog";
import { getWorkoutSessions } from "../../services/db/workoutSessions";
import { WorkoutPlan } from "../../types/workoutType";
import * as planDraft from "../../utils/planDraft";
import { EMPTY_PLAN_ERROR } from "../../utils/planDraft";
import show from "../../utils/toastUtils";

jest.mock("../../services/db/userDB", () => ({
  ...jest.requireActual("../../services/db/userDB"),
  getAllWorkoutPlans: jest.fn(),
  overrideWorkoutDetails: jest.fn(),
  newPlanId: jest.fn(() => "generated_id"),
}));
jest.mock("../../services/db/workoutSessions", () => ({
  ...jest.requireActual("../../services/db/workoutSessions"),
  getWorkoutSessions: jest.fn(async () => ({ sessions: [], lastDoc: null })),
}));
// Manage Workout checks the catalog's hash on focus; nothing uploaded here.
jest.mock("../../services/db/catalog", () => ({
  ...jest.requireActual("../../services/db/catalog"),
  fetchCatalogMeta: jest.fn(async () => ({ catalog: null, searchWords: null })),
}));
// The harness puts nothing behind the screen, so no back can fire
// `beforeRemove`. The real hook still runs; its callback is kept so a test can
// call it as a back press would.
let leaveCallback: ((event: { data: { action: { type: string } } }) => void) | null = null;
jest.mock("@react-navigation/native", () => {
  const actual = jest.requireActual("@react-navigation/native");
  return {
    ...actual,
    usePreventRemove: (prevent: boolean, callback: typeof leaveCallback) => {
      leaveCallback = callback;
      return actual.usePreventRemove(prevent, callback);
    },
  };
});
jest.mock("../../utils/toastUtils", () => ({
  __esModule: true,
  default: { alert: jest.fn(), success: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const save = overrideWorkoutDetails as jest.Mock;

const push = (): WorkoutPlan => ({
  id: "push",
  name: "Push",
  exercises: [
    {
      id: "bench_press__barbell",
      name: "",
      nameSnapshot: "Bench Press · Barbell",
      fields: [
        { name: "Weight", role: "weight", unit: "kg" },
        { name: "Reps", role: "reps" },
      ],
    },
  ],
});
const pull = (): WorkoutPlan => ({ id: "pull", name: "Pull", exercises: [] });

function renderManage(plans: WorkoutPlan[], options: RenderScreenOptions = {}) {
  (getAllWorkoutPlans as jest.Mock).mockResolvedValue(plans);
  renderScreen(AddExerciseScreen, options);
  const load = loadCatalog(CATALOG);
  if (load.kind !== "ok") throw new Error("catalog");
  act(() => useCatalogStore.setState({ catalog: { version: "v1", movements: load.movements, index: load.index }, cacheLoaded: true }));
}

async function openPlan(plans: WorkoutPlan[], name: string, options: RenderScreenOptions = {}) {
  renderManage(plans, options);
  await selectPlan(plans, name);
}

const openSheet = async () => fireEvent.press(await screen.findByLabelText(/^(Choose a plan|Plan: .*)$/));

async function selectPlan(_plans: WorkoutPlan[], name: string) {
  await openSheet();
  fireEvent.press(within(screen.getByTestId("plan-sheet")).getByText(name));
}

const saveButton = () => screen.getByRole("button", { name: /Save changes|Saving…/ });

beforeEach(() => {
  save.mockReset();
  jest.mocked(show.alert).mockClear();
  jest.mocked(show.warn).mockClear();
});

it("a collapsed row shows its fields; editing one enables Save, which writes the whole plan", async () => {
  await openPlan([push()], "Push");
  expect(screen.getByText("Weight kg · Reps")).toBeTruthy();
  expect(saveButton()).toBeDisabled();

  fireEvent.press(screen.getByLabelText(/edit fields$/));
  fireEvent.press(screen.getByLabelText("Set Weight unit to plates"));
  fireEvent.changeText(screen.getByDisplayValue("Weight"), "Load");
  // D2: renaming a saved field warns, since history reads by name (TICKET-030).
  expect(screen.getByText(`Past sessions logged as "Weight" won't show under the new name.`)).toBeTruthy();

  save.mockResolvedValue(undefined);
  await act(async () => fireEvent.press(saveButton()));
  expect(save).toHaveBeenCalledWith(TEST_USER_ID, {
    ...push(),
    exercises: [{ ...push().exercises[0], fields: [{ name: "Load", role: "weight", unit: "plates" }, { name: "Reps", role: "reps" }] }],
  });
  expect(saveButton()).toBeDisabled();
});

it("a picked exercise arrives expanded; the picker's In plan follows the draft, not the saved plan", async () => {
  await openPlan([push()], "Push");
  const searchPecDeck = () => {
    fireEvent.press(screen.getByLabelText("Add exercise"));
    const picker = screen.getByTestId("exercise-picker");
    fireEvent.changeText(within(picker).UNSAFE_getByType(TextInput), "pec deck");
    return picker;
  };

  fireEvent.press(within(searchPecDeck()).getByText("Pec Deck (Machine Fly)"));
  expect(screen.queryByTestId("exercise-picker")).toBeNull();
  expect(screen.getByLabelText(/^Pec Deck.*collapse$/)).toBeTruthy();
  expect(screen.getByDisplayValue("Weight")).toBeTruthy();

  // D3: added but not saved, so already In plan.
  let picker = searchPecDeck();
  expect(within(picker).getByText("In plan")).toBeTruthy();
  fireEvent.press(within(picker).getByLabelText("Back"));

  // Removed in the draft: pickable again.
  fireEvent.press(screen.getByLabelText(/^Remove Pec Deck/));
  picker = searchPecDeck();
  expect(within(picker).queryByText("In plan")).toBeNull();
});

it("refuses to save an empty plan", async () => {
  await openPlan([push()], "Push");
  fireEvent.press(screen.getByLabelText(/edit fields$/));
  fireEvent.press(screen.getByLabelText(/^Remove /));
  await act(async () => fireEvent.press(saveButton()));
  expect(save).not.toHaveBeenCalled();
  expect(show.alert).toHaveBeenCalledWith("Plan not saved", EMPTY_PLAN_ERROR);
});

it("offline: says not saved yet when the write is still pending, and Save can be pressed again", async () => {
  // The 10 s bound itself is raceSave's (planDraft.test.ts); fake timers here
  // leaked into the next test's render. This checks what the screen does with it.
  const race = jest.spyOn(planDraft, "raceSave").mockResolvedValue("pending");
  try {
    await openPlan([push()], "Push");
    fireEvent.press(screen.getByLabelText(/edit fields$/));
    fireEvent.press(screen.getByLabelText("Set Weight unit to plates"));
    save.mockReturnValue(new Promise<void>(() => {}));

    await act(async () => fireEvent.press(saveButton()));

    expect(show.warn).toHaveBeenCalledWith("Not saved yet", expect.stringMatching(/^Check your connection/));
    expect(screen.getByText("Save changes")).toBeTruthy();
    expect(saveButton()).toBeEnabled();
  } finally {
    race.mockRestore();
  }
});

it("switching plan with unsaved changes asks first; Keep editing keeps them", async () => {
  const plans = [push(), pull()];
  await openPlan(plans, "Push");
  fireEvent.press(screen.getByLabelText(/edit fields$/));
  fireEvent.press(screen.getByLabelText("Set Weight unit to plates"));

  await selectPlan(plans, "Pull");
  fireEvent.press(screen.getByText("Keep editing"));
  expect(screen.getByLabelText(/collapse$/)).toBeTruthy();
  expect(saveButton()).toBeEnabled();

  await selectPlan(plans, "Pull");
  fireEvent.press(screen.getByText("Discard"));
  expect(screen.queryByLabelText(/collapse$/)).toBeNull();
  expect(screen.getByLabelText("Plan: Pull")).toBeTruthy();
});

// Device review, round 1.

it("(1) leaving while the draft's write is still queued says Still saving, not Discard", async () => {
  const race = jest.spyOn(planDraft, "raceSave").mockResolvedValue("pending");
  try {
    await openPlan([push()], "Push");
    fireEvent.press(screen.getByLabelText(/edit fields$/));
    fireEvent.press(screen.getByLabelText("Set Weight unit to plates"));
    save.mockReturnValue(new Promise<void>(() => {}));
    await act(async () => fireEvent.press(saveButton()));

    act(() => leaveCallback!({ data: { action: { type: "GO_BACK" } } }));
    expect(screen.getByText("Still saving")).toBeTruthy();
    expect(screen.getByText("Leave")).toBeTruthy();
    expect(screen.queryByText("Discard changes?")).toBeNull();
  } finally {
    race.mockRestore();
  }
});

it("(3) the arrow opens the row, and tapping it again closes it without removing the exercise", async () => {
  await openPlan([push()], "Push");
  fireEvent.press(screen.getByTestId("row-chevron-bench_press__barbell"));
  expect(screen.getByLabelText(/collapse$/)).toBeTruthy();

  fireEvent.press(screen.getByTestId("row-chevron-bench_press__barbell"));
  expect(screen.queryByLabelText(/collapse$/)).toBeNull();
  expect(screen.getByText("Weight kg · Reps")).toBeTruthy();
  expect(saveButton()).toBeDisabled();
});

it("(4) a refused Save names the exercise and its problem", async () => {
  await openPlan([push()], "Push");
  fireEvent.press(screen.getByLabelText(/edit fields$/));
  fireEvent.changeText(screen.getByDisplayValue("Weight"), "");
  await act(async () => fireEvent.press(saveButton()));
  expect(save).not.toHaveBeenCalled();
  expect(show.alert).toHaveBeenCalledWith("Plan not saved", "Bench Press · Barbell: fields cannot be empty.");
});

it("(5) the in-progress banner shows for the plan with a running workout, not for another", async () => {
  const plans = [push(), pull()];
  await openPlan(plans, "Push", { workout: buildWorkout([], { id: "push", name: "Push" }) });
  const banner = "Workout in progress on this plan. Changes apply from your next start.";
  expect(screen.getByText(banner)).toBeTruthy();
  await selectPlan(plans, "Pull");
  expect(screen.queryByText(banner)).toBeNull();
});

it("Save changes keeps its fill and centring on the button itself, not on the tour wrapper", async () => {
  await openPlan([push()], "Push");
  // MultiTourSteps moves some of its child's style to a wrapper; on the device
  // that drew the fill on the wrapper and left the label at the button's top.
  expect(StyleSheet.flatten(saveButton().props.style)).toMatchObject({
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 15,
  });
});

it("Recent comes from one recent-sessions query per open, none per picker open or keystroke", async () => {
  const mockSessions = getWorkoutSessions as jest.Mock;
  mockSessions.mockClear();
  mockSessions.mockResolvedValue({
    sessions: [{ sessionId: "s1", workoutId: "push", workoutName: "Push", startedAt: Date.now(), endedAt: Date.now(),
      exerciseIds: ["bench_press__barbell__close_grip"], rollupPending: false }],
    lastDoc: null,
  });
  await openPlan([pull()], "Pull");

  fireEvent.press(await screen.findByLabelText("Add exercise"));
  const picker = screen.getByTestId("exercise-picker");
  expect(await within(picker).findByText("Recent")).toBeTruthy();
  expect(within(picker).getByText(/^Barbell, close grip · /)).toBeTruthy();
  fireEvent.changeText(within(picker).UNSAFE_getByType(TextInput), "bench");
  fireEvent.press(within(picker).getByLabelText("Back"));
  fireEvent.press(screen.getByLabelText("Add exercise"));

  expect(mockSessions).toHaveBeenCalledTimes(1);
  expect(mockSessions).toHaveBeenCalledWith(TEST_USER_ID, { pageSize: 20 });
});

// TICKET-052: New plan and first plan.

it("New plan: the sheet's first row names a plan, which opens empty and is written with its first exercise", async () => {
  renderManage([push()]);
  await openSheet();
  fireEvent.press(screen.getByRole("button", { name: "New plan" }));
  fireEvent.changeText(screen.getByLabelText("New plan"), "  Legs   Day ");
  fireEvent.press(screen.getByRole("button", { name: "Create" }));

  // D4: the empty plan, not the picker; D6 b: nothing to save until an exercise.
  expect(screen.getByLabelText("Plan: Legs Day")).toBeTruthy();
  expect(screen.queryByTestId("exercise-picker")).toBeNull();
  expect(saveButton()).toBeDisabled();

  fireEvent.press(screen.getByLabelText("Add exercise"));
  const picker = screen.getByTestId("exercise-picker");
  fireEvent.changeText(within(picker).UNSAFE_getByType(TextInput), "pec deck");
  fireEvent.press(within(picker).getByText("Pec Deck (Machine Fly)"));
  expect(saveButton()).toBeEnabled();
  save.mockResolvedValue(undefined);
  await act(async () => fireEvent.press(saveButton()));
  // D1: the generated id, never the name's slug.
  expect(save).toHaveBeenCalledWith(TEST_USER_ID, expect.objectContaining({ id: "generated_id", name: "Legs Day" }));
});

it("New plan refuses a name a plan already has, and keeps the open plan", async () => {
  await openPlan([push()], "Push");
  await openSheet();
  fireEvent.press(screen.getByRole("button", { name: "New plan" }));
  fireEvent.changeText(screen.getByLabelText("New plan"), "push");
  fireEvent.press(screen.getByRole("button", { name: "Create" }));
  expect(screen.getByText('A plan named "Push" already exists.')).toBeTruthy();
  expect(screen.getByLabelText("Plan: Push")).toBeTruthy();
});

it("no plans: the first-plan form, Create disabled until a name is typed, then the plan opens empty", async () => {
  renderManage([]);
  expect(await screen.findByText("Your first plan")).toBeTruthy();
  expect(screen.queryByLabelText("Choose a plan")).toBeNull();
  const create = () => screen.getByRole("button", { name: "Create" });
  expect(create()).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText("Plan name"), "   ");
  expect(create()).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText("Plan name"), "Full Body");
  fireEvent.press(create());
  expect(screen.getByLabelText("Plan: Full Body")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Add exercise" })).toBeTruthy();
  expect(screen.queryByText("Your first plan")).toBeNull();
});

it("a failed plan load says so with Retry, never the first-plan form (D5)", async () => {
  (getAllWorkoutPlans as jest.Mock).mockRejectedValueOnce(new Error("offline")).mockResolvedValue([push()]);
  renderScreen(AddExerciseScreen);
  expect(await screen.findByText("Couldn't load plans.")).toBeTruthy();
  expect(screen.queryByText("Your first plan")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByLabelText("Choose a plan")).toBeTruthy();
});
