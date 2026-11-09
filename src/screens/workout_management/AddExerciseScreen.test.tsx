// TICKET-051: Manage Workout edits the plan's exercises as a list, in a draft,
// with one Save changes for the whole plan.
// TICKET-050: Recent comes from the recent workouts store, checked once per open (TICKET-075).
// TICKET-052: plans are chosen and created in a sheet; a first plan without one.

import { StyleSheet, TextInput } from "react-native";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { NavigationProp, ParamListBase, useNavigation } from "@react-navigation/native";
import AddExerciseScreen from "./AddExerciseScreen";
import { renderScreen, RenderScreenOptions, TEST_USER_ID } from "../../test/renderScreen";
import { buildWorkout } from "../../test/fixtures";
import { CATALOG } from "../../catalog";
import { getAllWorkoutPlans, getChangedPlans, getPlanFromServer, newVersionId, overrideWorkoutDetails } from "../../services/db/userDB";
import { usePlansStore } from "../../stores/usePlansStore";
import { loadCatalog } from "../../utils/catalog";
import { LayoutRoutes } from "../../constants/routes";
import { getChangedSessions, getNewestSessionStamp, getPlanSessionsFromServer } from "../../services/db/workoutSessions";
import { serveRecentWorkouts } from "../../test/recentWorkouts";
import { WorkoutPlan } from "../../types/workoutType";
import * as planDraft from "../../utils/planDraft";
import { EMPTY_PLAN_ERROR } from "../../utils/planDraft";
import show from "../../utils/toastUtils";
import { PLANS_CHECK_SKIP_MS } from "../../config/sync";

jest.mock("../../services/db/userDB", () => ({
  ...jest.requireActual("../../services/db/userDB"),
  getAllWorkoutPlans: jest.fn(),
  getChangedPlans: jest.fn(async () => []),
  getPlanFromServer: jest.fn(),
  overrideWorkoutDetails: jest.fn(),
  newPlanId: jest.fn(() => "generated_id"),
  newVersionId: jest.fn(() => "version_id"),
}));
jest.mock("../../services/db/workoutSessions", () => ({
  ...jest.requireActual("../../services/db/workoutSessions"),
  getNewestSessionStamp: jest.fn(async () => null),
  getPlanSessionsFromServer: jest.fn(async () => []),
  getChangedSessions: jest.fn(async () => []),
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
  const load = loadCatalog(CATALOG);
  if (load.kind !== "ok") throw new Error("catalog");
  renderScreen(AddExerciseScreen, { ...options, catalog: { version: "v1", movements: load.movements, index: load.index } });
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
    // Loaded with no version: saved as rev 1, made on none (TICKET-073).
    version: { rev: 1, id: "version_id", base: null },
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
    // TICKET-070 D8: the store keeps what the server has, not the unsent edit.
    expect(usePlansStore.getState().plans).toEqual([push()]);
  } finally {
    race.mockRestore();
  }
});

it("switching plan with unsaved changes asks first; Keep editing keeps them", async () => {
  const plans = [push(), pull()];
  await openPlan(plans, "Push");
  fireEvent.press(screen.getByLabelText(/edit fields$/));
  fireEvent.press(screen.getByLabelText("Set Weight unit to plates"));

  // The plan already open is not a switch: no question, edits kept (PR #26).
  await selectPlan(plans, "Push");
  expect(screen.queryByText("Discard changes?")).toBeNull();
  expect(saveButton()).toBeEnabled();

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

it("Recent comes from the recent workouts' check on open, none per picker open or keystroke", async () => {
  // TICKET-075: served through the store's reads; the plan held is Pull, so the session is Pull's.
  [getNewestSessionStamp, getPlanSessionsFromServer, getChangedSessions].forEach((read) => jest.mocked(read).mockClear());
  serveRecentWorkouts([{ sessionId: "s1", workoutId: "pull", workoutName: "Pull", startedAt: Date.now(), endedAt: Date.now(),
    exerciseIds: ["bench_press__barbell__close_grip"] }]);
  await openPlan([pull()], "Pull");

  fireEvent.press(await screen.findByLabelText("Add exercise"));
  const picker = screen.getByTestId("exercise-picker");
  expect(await within(picker).findByText("Recent")).toBeTruthy();
  expect(within(picker).getByText(/^Barbell, close grip · /)).toBeTruthy();
  fireEvent.changeText(within(picker).UNSAFE_getByType(TextInput), "bench");
  fireEvent.press(within(picker).getByLabelText("Back"));
  fireEvent.press(screen.getByLabelText("Add exercise"));

  // One first load: the baseline, then Pull's and Freestyle's queries. No change check followed.
  expect(getNewestSessionStamp).toHaveBeenCalledTimes(1);
  expect(jest.mocked(getPlanSessionsFromServer).mock.calls.map(([uid, planId]) => [uid, planId]).sort()).toEqual([
    [TEST_USER_ID, "freestyle"],
    [TEST_USER_ID, "pull"],
  ]);
  expect(getChangedSessions).not.toHaveBeenCalled();
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
  const readsBefore = (getAllWorkoutPlans as jest.Mock).mock.calls.length;
  jest.mocked(getChangedPlans).mockResolvedValueOnce([
    { id: "generated_id", name: "Legs Day", exercises: [], updatedAt: { seconds: 9, nanoseconds: 0 } },
  ]);
  await act(async () => fireEvent.press(saveButton()));
  // D1: the generated id, never the name's slug.
  expect(save).toHaveBeenCalledWith(TEST_USER_ID, expect.objectContaining({ id: "generated_id", name: "Legs Day" }));
  // TICKET-070 D8: the confirmed Save is in the store, in id order, with no
  // full re-read: its stamp comes back from one change query.
  expect(usePlansStore.getState().plans?.map((plan) => plan.id)).toEqual(["generated_id", "push"]);
  expect(usePlansStore.getState().lastSeen).toEqual({ seconds: 9, nanoseconds: 0 });
  expect(getAllWorkoutPlans).toHaveBeenCalledTimes(readsBefore);
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

// TICKET-061: Archive beside the PLAN heading is an edit, stored by Save
// changes with the rest of the plan (user, 2026-11-01).
describe("archive", () => {
  const PENDING = "Archived when you save · then not listed when you start a workout";
  const ARCHIVED = "Archived · not listed when you start a workout";

  it("is an edit: nothing is written until Save, which stores it with the plan", async () => {
    save.mockResolvedValue(undefined);
    await openPlan([push(), pull()], "Push");
    fireEvent.press(screen.getByRole("button", { name: "Archive" }));

    expect(save).not.toHaveBeenCalled();
    expect(screen.getByText(PENDING)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unarchive" })).toBeTruthy();
    await act(async () => fireEvent.press(saveButton()));
    expect(save).toHaveBeenCalledWith(TEST_USER_ID, expect.objectContaining({ id: "push", archived: true }));
    expect(screen.getByText(ARCHIVED)).toBeTruthy();
    expect(saveButton()).toBeDisabled();
  });

  it("Unarchive says it waits for Save, which writes the plan without the flag", async () => {
    save.mockResolvedValue(undefined);
    renderManage([{ ...push(), archived: true }]);
    await openSheet();
    const sheet = within(screen.getByTestId("plan-sheet"));
    fireEvent.press(sheet.getByRole("button", { name: "Show archived" }));
    fireEvent.press(sheet.getByText("Push"));
    expect(screen.getByText(ARCHIVED)).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Unarchive" }));
    expect(screen.getByText("Unarchived when you save · then listed when you start a workout")).toBeTruthy();
    await act(async () => fireEvent.press(saveButton()));
    expect(save).toHaveBeenCalledWith(TEST_USER_ID, expect.not.objectContaining({ archived: expect.anything() }));
    expect(screen.queryByText(/when you start a workout/)).toBeNull();
  });

  it("switching plan with an unsaved Archive asks to discard it", async () => {
    const plans = [push(), pull()];
    await openPlan(plans, "Push");
    fireEvent.press(screen.getByRole("button", { name: "Archive" }));
    await selectPlan(plans, "Pull");
    expect(screen.getByText("Discard changes?")).toBeTruthy();
  });

  it("an Archive tapped while a Save is queued survives that Save landing", async () => {
    // Offline: Save is queued, Archive is tapped, then the queued Save lands.
    const race = jest.spyOn(planDraft, "raceSave").mockResolvedValue("pending");
    try {
      let land!: () => void;
      save.mockReturnValueOnce(new Promise<void>((resolve) => (land = resolve)));
      await openPlan([push()], "Push");
      fireEvent.press(screen.getByLabelText(/edit fields$/));
      fireEvent.press(screen.getByLabelText("Set Weight unit to plates"));
      await act(async () => fireEvent.press(saveButton()));
      fireEvent.press(screen.getByRole("button", { name: "Archive" }));

      await act(async () => land());
      expect(screen.getByRole("button", { name: "Unarchive" })).toBeTruthy();
      expect(saveButton()).toBeEnabled();
    } finally {
      race.mockRestore();
    }
  });

  it("the plan sheet groups the open plan by its saved archive state", async () => {
    save.mockResolvedValue(undefined);
    await openPlan([push(), pull()], "Push");
    fireEvent.press(screen.getByRole("button", { name: "Archive" }));
    // A check answering late can still return the plan unarchived (a read that
    // started before the Save); the sheet goes by the saved copy.
    await act(async () => fireEvent.press(saveButton()));
    await openSheet();
    expect(within(screen.getByTestId("plan-sheet")).getByRole("button", { name: "Hide archived" })).toBeTruthy();
  });

  it("offers no Archive for a new plan that was never saved", async () => {
    renderManage([push()]);
    await openSheet();
    fireEvent.press(screen.getByRole("button", { name: "New plan" }));
    fireEvent.changeText(screen.getByLabelText("New plan"), "Legs");
    fireEvent.press(screen.getByRole("button", { name: "Create" }));
    expect(screen.getByLabelText("Plan: Legs")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
  });

  it("the plan sheet hides archived plans until shown, unless the open one is archived", async () => {
    const old: WorkoutPlan = { ...pull(), id: "old", name: "Push v1", archived: true };
    renderManage([push(), old]);
    await openSheet();
    const sheet = () => within(screen.getByTestId("plan-sheet"));
    expect(sheet().queryByText("Push v1")).toBeNull();
    fireEvent.press(sheet().getByRole("button", { name: "Show archived" }));
    fireEvent.press(sheet().getByText("Push v1"));

    // Reopened on the archived plan: shown, so the open plan has its row.
    await openSheet();
    expect(sheet().getByText("Push v1")).toBeTruthy();
    expect(sheet().getByRole("button", { name: "Hide archived" })).toBeTruthy();
  });
});

// TICKET-070 D4: Manage is `singleCopy`, so going back to it is a focus, not a
// mount. It must check the plans again then (PR #48 review).
it("checks the plans again when Manage comes back into view", async () => {
  let navigation!: NavigationProp<ParamListBase>;
  function ManageWithNavigation() {
    navigation = useNavigation<NavigationProp<ParamListBase>>();
    return <AddExerciseScreen />;
  }
  const reads = jest.mocked(getAllWorkoutPlans);
  const changes = jest.mocked(getChangedPlans);
  reads.mockClear().mockResolvedValue([push()]);
  changes.mockClear();
  renderScreen(ManageWithNavigation);
  await waitFor(() => expect(reads).toHaveBeenCalledTimes(1));
  await act(() => jest.advanceTimersByTimeAsync(PLANS_CHECK_SKIP_MS));
  act(() => navigation.navigate(LayoutRoutes.Home));
  await screen.findByText(`route:${LayoutRoutes.Home}`);
  act(() => navigation.goBack());
  await waitFor(() => expect(changes).toHaveBeenCalledTimes(1));
  expect(reads).toHaveBeenCalledTimes(1);
});

// TICKET-070 D4, stage 2: opening a plan runs a change check past the check
// skip; a newer version shows in place unless the draft has edits.
describe("opening a plan checks it is current", () => {
  const pushFromElsewhere = (): WorkoutPlan => ({ ...push(), name: "Push (laptop)", updatedAt: { seconds: 9, nanoseconds: 0 } });

  it("changed elsewhere and nothing typed: the new version replaces the draft", async () => {
    const changes = jest.mocked(getChangedPlans);
    changes.mockClear();
    renderManage([push()]);
    await waitFor(() => expect(getAllWorkoutPlans).toHaveBeenCalled());
    changes.mockResolvedValueOnce([pushFromElsewhere()]);
    await selectPlan([push()], "Push");
    expect(await screen.findByLabelText("Plan: Push (laptop)")).toBeTruthy();
    expect(changes).toHaveBeenCalledTimes(1);
    expect(saveButton()).toBeDisabled();
  });

  it("edited before the check answers: the draft stays", async () => {
    renderManage([push()]);
    await waitFor(() => expect(getAllWorkoutPlans).toHaveBeenCalled());
    let answer!: (plans: WorkoutPlan[]) => void;
    jest.mocked(getChangedPlans).mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    await selectPlan([push()], "Push");
    fireEvent.press(screen.getByLabelText(/edit fields$/));
    fireEvent.changeText(screen.getByDisplayValue("Weight"), "Load");
    await act(async () => answer([pushFromElsewhere()]));
    expect(screen.getByLabelText("Plan: Push")).toBeTruthy();
    expect(screen.getByDisplayValue("Load")).toBeTruthy();
    expect(usePlansStore.getState().plans?.[0].name).toBe("Push (laptop)");
  });
});

// TICKET-073 D7: the server refuses a Save not made on the stored version.
describe("a Save refused because the plan changed on another device", () => {
  const s3 = { rev: 3, id: "s3", base: null };
  const refused = Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" });
  const fromPhoneA = (): WorkoutPlan => ({
    ...push(),
    name: "Push (phone A)",
    version: { rev: 4, id: "a4", base: "s3" },
    updatedAt: { seconds: 9, nanoseconds: 0 },
  });
  // A refused Save always reads the plan from the server (`reloadRefused`).
  beforeEach(() => jest.mocked(getPlanFromServer).mockResolvedValue(fromPhoneA()));
  const editWeightUnit = () => {
    fireEvent.press(screen.getByLabelText(/edit fields$/));
    fireEvent.press(screen.getByLabelText("Set Weight unit to plates"));
  };

  it("online: the notice, the other device's version in place, and the next Save goes out at its rev + 1", async () => {
    await openPlan([{ ...push(), version: s3 }], "Push");
    editWeightUnit();
    save.mockRejectedValueOnce(refused);
    await act(async () => fireEvent.press(saveButton()));

    await waitFor(() =>
      expect(show.alert).toHaveBeenCalledWith("This plan changed on another device", "Your changes were not saved. This is the latest version.")
    );
    expect(screen.getByLabelText("Plan: Push (phone A)")).toBeTruthy();
    expect(saveButton()).toBeDisabled();

    editWeightUnit();
    save.mockResolvedValueOnce(undefined);
    await act(async () => fireEvent.press(saveButton()));
    expect(save).toHaveBeenLastCalledWith(
      TEST_USER_ID,
      expect.objectContaining({ name: "Push (phone A)", version: expect.objectContaining({ rev: 5, base: "a4" }) })
    );
  });

  it("late from the offline queue: logged with no notice, and the plan still reloads", async () => {
    const race = jest.spyOn(planDraft, "raceSave").mockResolvedValue("pending");
    try {
      await openPlan([{ ...push(), version: s3 }], "Push");
      editWeightUnit();
      let land!: (error: unknown) => void;
      save.mockReturnValueOnce(new Promise<void>((_resolve, reject) => (land = reject)));
      await act(async () => fireEvent.press(saveButton()));
      expect(show.warn).toHaveBeenCalledWith("Not saved yet", expect.anything());

        await act(async () => land(refused));

      expect(await screen.findByLabelText("Plan: Push (phone A)")).toBeTruthy();
      expect(show.alert).not.toHaveBeenCalled();
      expect(usePlansStore.getState().readout.log.map((e) => `${e.outcome} ${e.detail ?? ""}`)).toContain(
        "refused plan push at rev 4, late from the queue"
      );
    } finally {
      race.mockRestore();
    }
  });

  // PR #50 review, B1 case 2: edited after the queued Save, the draft stays
  // and is still based on that Save. Its next Save names it as the base, so
  // the rule refuses it, even though its rev (5) is phone A's 4 + 1.
  it("late, with edits since: the edits stay, and the next Save is based on the refused one", async () => {
    const race = jest.spyOn(planDraft, "raceSave").mockResolvedValueOnce("pending");
    jest.mocked(newVersionId).mockReturnValueOnce("b4").mockReturnValueOnce("b5");
    try {
      await openPlan([{ ...push(), version: s3 }], "Push");
      editWeightUnit();
      let land!: (error: unknown) => void;
      save.mockReturnValueOnce(new Promise<void>((_resolve, reject) => (land = reject)));
      await act(async () => fireEvent.press(saveButton()));
      fireEvent.press(screen.getByLabelText("Set Weight unit to lb")); // edited after the queued Save

        await act(async () => land(refused));
      await waitFor(() => expect(usePlansStore.getState().plans?.[0]?.version?.id).toBe("a4"));
      expect(screen.queryByLabelText("Plan: Push (phone A)")).toBeNull();

      save.mockRejectedValueOnce(refused);
      await act(async () => fireEvent.press(saveButton()));
      expect(save).toHaveBeenLastCalledWith(TEST_USER_ID, expect.objectContaining({ version: { rev: 5, id: "b5", base: "b4" } }));
    } finally {
      race.mockRestore();
    }
  });
});
