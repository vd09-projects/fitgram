import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { AppState } from "react-native";
import WorkoutHubScreen from "./WorkoutHubScreen";
import { renderScreen, TEST_USER_ID } from "../../test/renderScreen";
import { buildExercise, buildWorkout } from "../../test/fixtures";
import { getAllWorkoutPlans, getChangedPlans } from "../../services/db/userDB";
import { getExerciseStats, getWorkoutSessions } from "../../services/db/workoutSessions";
import { WorkoutRoutes } from "../../constants/routes";
import { WorkoutPlan } from "../../types/workoutType";
import { WorkoutSessionDoc } from "../../types/workoutSession";
import { useWorkoutStore } from "../../stores/useWorkoutStore";
import { FREESTYLE_ID } from "../../constants/freestyle";
import { PLANS_CHECK_SKIP_MS } from "../../config/sync";

jest.mock("../../services/db/userDB", () => ({
  ...jest.requireActual("../../services/db/userDB"),
  getAllWorkoutPlans: jest.fn(),
  getChangedPlans: jest.fn(async () => []),
}));
jest.mock("../../services/db/workoutSessions", () => ({
  ...jest.requireActual("../../services/db/workoutSessions"),
  getWorkoutSessions: jest.fn(),
  getExerciseStats: jest.fn(),
}));

const mockPlans = getAllWorkoutPlans as jest.Mock;
const mockSessions = getWorkoutSessions as jest.Mock;
const mockStats = getExerciseStats as jest.Mock;

const DAY = 24 * 60 * 60 * 1000;

const plan = (id: string, name: string, exerciseCount = 2): WorkoutPlan => ({
  id,
  name,
  exercises: Array.from({ length: exerciseCount }, (_, i) => buildExercise(`${name} ${i}`)),
});
const PUSH = plan("push", "Push");
const PULL = plan("pull", "Pull", 1);
const LEGS = plan("legs", "Legs");

const session = (workoutId: string, startedAt: number): WorkoutSessionDoc => ({
  sessionId: `${workoutId}_${startedAt}`,
  workoutId,
  workoutName: workoutId,
  startedAt,
  endedAt: startedAt + 3600_000,
  exerciseIds: [],
  rollupPending: false,
});

async function renderHub(
  plans: WorkoutPlan[],
  sessions: WorkoutSessionDoc[] = [],
  options: Parameters<typeof renderScreen>[1] = {}
) {
  mockPlans.mockResolvedValue(plans);
  mockSessions.mockResolvedValue({ sessions, lastDoc: null });
  renderScreen(WorkoutHubScreen, { workoutRoute: WorkoutRoutes.WorkoutHome, ...options });
  await waitFor(() => expect(mockPlans).toHaveBeenCalled());
  await waitFor(() => expect(mockSessions).toHaveBeenCalled());
}

const tileIds = () => screen.getAllByTestId(/^hub-tile-/).map((tile) => tile.props.testID.replace("hub-tile-", ""));
const tile = (id: string) => screen.getByTestId(`hub-tile-${id}`);

beforeEach(() => {
  jest.clearAllMocks();
  mockStats.mockResolvedValue({});
});

describe("WorkoutHubScreen", () => {
  it("shows the chosen tiles from one recent-sessions read, All plans counting archived plans", async () => {
    const archived = { ...plan("old", "Old Push"), archived: true };
    await renderHub(
      [PUSH, PULL, LEGS, archived],
      [session("pull", Date.now()), session("push", Date.now() - 9 * DAY), session("old", Date.now() - DAY)]
    );

    await waitFor(() => expect(tile("push")).toHaveTextContent("Push9dsince last · 2 exercises"));
    expect(tileIds()).toEqual(["push", "pull", "legs"]);
    expect(tile("pull")).toHaveTextContent("PullTodaydone · 1 exercise");
    expect(tile("legs")).toHaveTextContent("Legs—not in recent workouts · 2 exercises");
    expect(screen.getByRole("button", { name: "All plans, 4" })).toBeOnTheScreen();

    expect(mockSessions).toHaveBeenCalledTimes(1);
    expect(mockSessions).toHaveBeenCalledWith(TEST_USER_ID, { pageSize: 20 });
    expect(mockPlans).toHaveBeenCalledTimes(1);
    // Nothing is prefetched until a card opens.
    expect(mockStats).not.toHaveBeenCalled();
  });

  // useRecentSessions stays null after a failed read: no tile may claim the
  // plan is "not in recent workouts" when the sessions were never read.
  it("says the last session is unknown, not 'not in recent workouts', when sessions did not load", async () => {
    mockPlans.mockResolvedValue([PUSH]);
    mockSessions.mockRejectedValue(new Error("offline"));
    renderScreen(WorkoutHubScreen, { workoutRoute: WorkoutRoutes.WorkoutHome });

    expect(await screen.findByTestId("hub-tile-push")).toHaveTextContent("Push—last session unknown · 2 exercises");
    await waitFor(() => expect(mockSessions).toHaveBeenCalled());
    expect(tile("push")).toHaveTextContent("Push—last session unknown · 2 exercises");
  });

  // The hub is the tab's root and is often left open overnight: focus events
  // fire on navigation only, so the clock must also be read on foregrounding.
  it("re-reads the clock when the app comes back to the foreground", async () => {
    const realNow = Date.now();
    await renderHub([PUSH], [session("push", realNow)]);
    await waitFor(() => expect(tile("push")).toHaveTextContent("PushTodaydone · 2 exercises"));

    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(realNow + DAY);
    try {
      const handlers = (AppState.addEventListener as jest.Mock).mock.calls
        .filter(([type]) => type === "change")
        .map(([, handler]) => handler);
      act(() => handlers.forEach((handler) => handler("active")));
      expect(tile("push")).toHaveTextContent("Push1dsince last · 2 exercises");
    } finally {
      nowSpy.mockRestore();
    }
  });

  // TICKET-070 D4: left open on the hub, coming back from the background is
  // not a focus, so the plans hook checks on foregrounding (PR #48 review).
  it("checks the plans when the app comes back to the foreground", async () => {
    await renderHub([PUSH]);
    await waitFor(() => expect(tile("push")).toBeTruthy());
    expect(mockPlans).toHaveBeenCalledTimes(1);
    // TICKET-070 stage 2: a check after the first load asks only for what changed.
    jest.mocked(getChangedPlans).mockResolvedValueOnce([PULL]);
    await act(() => jest.advanceTimersByTimeAsync(PLANS_CHECK_SKIP_MS));
    const handlers = (AppState.addEventListener as jest.Mock).mock.calls
      .filter(([type]) => type === "change")
      .map(([, handler]) => handler);
    await act(async () => handlers.forEach((handler) => handler("active")));
    await waitFor(() => expect(tile("pull")).toBeTruthy());
    expect(mockPlans).toHaveBeenCalledTimes(1);
    expect(getChangedPlans).toHaveBeenCalledTimes(1);
  });

  // The six tiles reorder when sessions land; an open card must not close
  // because its plan left the six.
  it("keeps a card open when its plan drops out of the tiles as sessions land", async () => {
    const plans = ["a", "b", "c", "d", "e", "f", "g"].map((id) => plan(id, `Plan ${id.toUpperCase()}`));
    let resolveSessions: (value: { sessions: WorkoutSessionDoc[]; lastDoc: null }) => void = () => {};
    mockPlans.mockResolvedValue(plans);
    mockSessions.mockReturnValue(new Promise((resolve) => (resolveSessions = resolve)));
    renderScreen(WorkoutHubScreen, { workoutRoute: WorkoutRoutes.WorkoutHome });

    fireEvent.press(await screen.findByTestId("hub-tile-a"));
    expect(within(screen.getByTestId("plan-card")).getByRole("header", { name: "Plan A" })).toBeOnTheScreen();

    // Plan A is the most recent of seven, so it is the one left out of the six.
    await act(async () =>
      resolveSessions({ sessions: plans.map((p, i) => session(p.id, Date.now() - (i + 1) * DAY)), lastDoc: null })
    );
    await waitFor(() => expect(screen.queryByTestId("hub-tile-a")).toBeNull());
    expect(within(screen.getByTestId("plan-card")).getByRole("header", { name: "Plan A" })).toBeOnTheScreen();
  });

  it.each([
    ["Plans", WorkoutRoutes.AddExercise],
    ["History", WorkoutRoutes.WorkoutLogs],
    ["All plans, 2", WorkoutRoutes.StartWorkout],
  ])("%s navigates to %s", async (button, route) => {
    await renderHub([PUSH, PULL]);
    fireEvent.press(await screen.findByRole("button", { name: button }));
    expect(await screen.findByText(`route:Workout/${route}`)).toBeOnTheScreen();
  });

  it("while a workout runs: a Resume bar, the live tile, and the others' cards blocked", async () => {
    const workout = buildWorkout(["Bench Press"], { id: "push", name: "Push", startTime: Date.now() - 90_000 });
    workout.exercises[0].sets = [{ id: 1, segments: [{ Weight: "60", Reps: "8" }] }];
    await renderHub([PUSH, PULL], [], { workout });

    const bar = await screen.findByTestId("hub-resume-bar");
    expect(bar).toHaveTextContent(/^Push in progress1:3\d · 1 set logged/);
    expect(await screen.findByTestId("hub-tile-push")).toHaveTextContent(/^Push1:3\din progress · 1 set$/);

    fireEvent.press(tile("pull"));
    expect(screen.getByText("Push is in progress. Finish or discard it to start this one.")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Start Pull" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Close" }));

    fireEvent.press(screen.getByTestId("hub-resume-bar"));
    expect(await screen.findByText("route:Workout/LogWorkout")).toBeOnTheScreen();
  });

  it("offers a first plan when there are none, but not when the plans failed to load", async () => {
    await renderHub([]);
    expect(await screen.findByText("Ready when you are")).toBeOnTheScreen();
    expect(screen.queryByText(/All plans/)).toBeNull();
    // The card's Start Freestyle is the row; no second one under it.
    expect(screen.queryByTestId("hub-freestyle")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Create a plan" }));
    expect(await screen.findByText("route:Workout/AddExercise")).toBeOnTheScreen();

    jest.clearAllMocks();
    mockPlans.mockRejectedValue(new Error("offline"));
    mockSessions.mockResolvedValue({ sessions: [], lastDoc: null });
    screen.unmount();
    renderScreen(WorkoutHubScreen, { workoutRoute: WorkoutRoutes.WorkoutHome });
    expect(await screen.findByText("Your plans did not load")).toBeOnTheScreen();
    expect(screen.queryByText("Ready when you are")).toBeNull();
    // A Freestyle needs no plan, so failed plans do not block it.
    expect(screen.getByTestId("hub-freestyle")).toBeOnTheScreen();

    mockPlans.mockResolvedValue([plan("p1", "Push")]);
    fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("hub-tile-p1")).toBeOnTheScreen();
  });

  describe("Freestyle (TICKET-067)", () => {
    const active = () => useWorkoutStore.getState().activeWorkout;

    it("the row starts an empty Freestyle at once, with no card and no history read", async () => {
      await renderHub([PUSH]);
      fireEvent.press(await screen.findByRole("button", { name: "Start Freestyle" }));

      expect(await screen.findByText("route:Workout/LogWorkout")).toBeOnTheScreen();
      expect(active()).toMatchObject({ id: FREESTYLE_ID, name: "Freestyle", exercises: [], currentExerciseIndex: null });
      expect(screen.queryByTestId("plan-card")).toBeNull();
      expect(mockStats).not.toHaveBeenCalled();
    });

    it("starts from the first-run card's Start Freestyle", async () => {
      await renderHub([]);
      fireEvent.press(await screen.findByRole("button", { name: "Start Freestyle" }));

      expect(await screen.findByText("route:Workout/LogWorkout")).toBeOnTheScreen();
      expect(active()?.id).toBe(FREESTYLE_ID);
      // Back on the hub, the card's button resumes it, and says so.
      const card = screen.getByTestId("hub-first-run", { includeHiddenElements: true });
      expect(within(card).getByText("Resume Freestyle", { includeHiddenElements: true })).toBeTruthy();
      expect(within(card).queryByText("Start Freestyle", { includeHiddenElements: true })).toBeNull();
    });

    it("while a plan runs: a blocked card naming it, Back to it, and the plan left running", async () => {
      const workout = buildWorkout(["Squat"], { id: "legs", name: "Legs", startTime: Date.now() - 90_000 });
      await renderHub([LEGS, PUSH], [], { workout });

      fireEvent.press(await screen.findByRole("button", { name: "Start Freestyle" }));
      const card = screen.getByTestId("freestyle-blocked");
      expect(within(card).getByText("Legs is in progress. Finish or discard it to start a Freestyle.")).toBeOnTheScreen();
      expect(within(card).getByRole("button", { name: "Back to Legs" })).toHaveTextContent(/^Back to Legs · 1:3\d$/);
      expect(active()).toBe(workout);

      fireEvent.press(within(card).getByRole("button", { name: "Back to Legs" }));
      expect(await screen.findByText("route:Workout/LogWorkout")).toBeOnTheScreen();
      expect(active()).toBe(workout);
    });

    it("while it runs: the Resume bar and row name it, the row resumes, and plan cards are blocked by it", async () => {
      const workout = buildWorkout(["Bench Press", "Row"], {
        id: FREESTYLE_ID,
        name: "Freestyle",
        startTime: Date.now() - 90_000,
      });
      await renderHub([PUSH], [session("push", Date.now() - 9 * DAY)], { workout });

      expect(await screen.findByTestId("hub-resume-bar")).toHaveTextContent(/^Freestyle in progress/);
      expect(await screen.findByTestId("hub-freestyle")).toHaveTextContent(/^Freestyle1:3\d · in progress · 2 exercises$/);
      // No plan tile goes live for it.
      await waitFor(() => expect(tile("push")).toHaveTextContent("Push9dsince last · 2 exercises"));

      fireEvent.press(tile("push"));
      expect(screen.getByText("Freestyle is in progress. Finish or discard it to start this one.")).toBeOnTheScreen();
      fireEvent.press(screen.getByRole("button", { name: "Close" }));

      fireEvent.press(screen.getByTestId("hub-freestyle"));
      expect(await screen.findByText("route:Workout/LogWorkout")).toBeOnTheScreen();
      expect(active()).toBe(workout);
    });
  });
});
