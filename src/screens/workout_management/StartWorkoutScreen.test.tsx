import { Modal, TextInput } from "react-native";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import StartWorkoutScreen from "./StartWorkoutScreen";
import { renderScreen, TEST_USER_ID } from "../../test/renderScreen";
import { buildExercise, buildStats, buildWorkout } from "../../test/fixtures";
import { getAllWorkoutPlans } from "../../services/db/userDB";
import { getAllExerciseStats, getNewestSessionStamp, getPlanSessionsFromServer } from "../../services/db/workoutSessions";
import { serveRecentWorkouts } from "../../test/recentWorkouts";
import { LayoutRoutes } from "../../constants/routes";
import { WorkoutPlan } from "../../types/workoutType";
import { WorkoutSessionDoc } from "../../types/workoutSession";
import { PendingUpload } from "../../types/zustandWorkoutType";
import { useCatalogStore } from "../../stores/useCatalogStore";
import { loadCatalog } from "../../utils/catalog";
import { CATALOG_ROW } from "../../test/fixtures";

jest.mock("../../services/db/userDB", () => ({
  ...jest.requireActual("../../services/db/userDB"),
  getAllWorkoutPlans: jest.fn(),
}));
jest.mock("../../services/db/workoutSessions", () => ({
  ...jest.requireActual("../../services/db/workoutSessions"),
  getNewestSessionStamp: jest.fn(),
  getPlanSessionsFromServer: jest.fn(),
  getChangedSessions: jest.fn(),
  getAllExerciseStats: jest.fn(),
  getChangedExerciseStats: jest.fn(async () => []),
}));

const mockPlans = getAllWorkoutPlans as jest.Mock;
const mockSessions = getPlanSessionsFromServer as jest.Mock;
const mockStats = getAllExerciseStats as jest.Mock;

const DAY = 24 * 60 * 60 * 1000;

const plan = (id: string, name: string, exerciseNames: string[]): WorkoutPlan => ({
  id,
  name,
  exercises: exerciseNames.map((n) => buildExercise(n)),
});
const PUSH = plan("push", "Push", ["Bench Press", "Squat"]);
const PULL = plan("pull", "Pull", ["Row"]);

const session = (workoutId: string, startedAt: number, value: number): WorkoutSessionDoc => ({
  lifts: [], sessionId: `${workoutId}_${startedAt}`,
  workoutId,
  workoutName: workoutId,
  startedAt,
  endedAt: startedAt + 3600_000,
  exerciseIds: [],
  volume: {
    totals: [{ unit: "kg", value }],
    unavailableReason: null,
    exercisesCounted: 1,
    exercisesWeighted: 1,
    exercisesTotal: 1,
  },
});

/** Renders the screen with plans and recent sessions, and waits for both to land. */
async function renderStart(
  options: Parameters<typeof renderScreen>[1] = {},
  sessions: WorkoutSessionDoc[] = []
) {
  mockPlans.mockResolvedValue([PUSH, PULL]);
  serveRecentWorkouts(sessions);
  const result = renderScreen(StartWorkoutScreen, { route: LayoutRoutes.Home, ...options });
  await screen.findByText("Push");
  await waitFor(() => expect(mockSessions).toHaveBeenCalled());
  return result;
}

const summary = (planId: string) => screen.getByTestId(`plan-summary-${planId}`);
const primaryButton = () => screen.getByRole("button", { name: /^(Start|Resume) / });
const card = () => screen.queryByTestId("plan-card");

beforeEach(() => jest.clearAllMocks());

describe("StartWorkoutScreen", () => {
  it("shows each plan's last-done from the recent workouts' first load, a pending upload winning", async () => {
    const pending: PendingUpload = {
      sessionId: "pull_pending",
      uid: TEST_USER_ID,
      workout: buildWorkout(["Row"], { id: "pull", startTime: Date.now() - DAY }),
      endedAt: Date.now() - DAY + 3600_000,
      failedAttempts: 0,
      lastError: null,
    };
    pending.workout.exercises[0].sets = [{ id: 1, segments: [{ Weight: "50", Reps: "10" }] }];

    await renderStart(
      { workoutActions: { pendingUploads: [pending] } },
      [session("push", Date.now() - 7 * DAY, 4980), session("pull", Date.now() - 9 * DAY, 100)]
    );

    await waitFor(() =>
      expect(summary("push")).toHaveTextContent("2 exercises · last done 7 days ago · 4,980 kg")
    );
    expect(summary("pull")).toHaveTextContent(
      "1 exercise · last done yesterday · 500 kg · not uploaded yet"
    );
    // TICKET-075's first load: the baseline, then one query per plan.
    expect(getNewestSessionStamp).toHaveBeenCalledTimes(1);
    expect(new Set(mockSessions.mock.calls.map(([, planId]) => planId))).toEqual(new Set(["push", "pull", "freestyle"]));
    // Nothing is prefetched on mount.
    expect(mockStats).not.toHaveBeenCalled();
  });

  it("shows the in-progress workout as a banner, not a modal, and Discard confirms first", async () => {
    const cancelWorkout = jest.fn().mockResolvedValue(undefined);
    const workout = buildWorkout(["Bench Press"], { id: "push", name: "Push", startTime: Date.now() - 90_000 });
    workout.exercises[0].sets = [
      { id: 1, segments: [{ Weight: "60", Reps: "8" }] },
      { id: 2, segments: [{ Weight: "60", Reps: "8" }] },
    ];
    await renderStart({ workout, workoutActions: { cancelWorkout } });

    expect(screen.queryByText("Workout In Progress")).toBeNull();
    expect(screen.getByTestId("resume-banner")).toHaveTextContent(/Push in progress1:3\d · 2 sets logged/);

    fireEvent.press(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByText("Discard this workout?")).toBeOnTheScreen();
    expect(cancelWorkout).not.toHaveBeenCalled();

    // The dialog's own Discard, now the last of the two on screen.
    const discards = screen.getAllByText("Discard");
    await act(async () => fireEvent.press(discards[discards.length - 1]));
    expect(cancelWorkout).toHaveBeenCalledTimes(1);
  });

  // TICKET-042 stage 2: a plan row names catalog exercises from the catalog, and
  // an id the catalog lacks shows its snapshot, marked, and asks for one meta check.
  it("names plan exercises from the catalog, an unknown id by its snapshot", async () => {
    const fields = CATALOG_ROW.versions[0].fields;
    const plan: WorkoutPlan = {
      id: "back",
      name: "Pull",
      exercises: [
        { id: "row__barbell", name: "", nameSnapshot: "Barbell Row (old name)", fields },
        { id: "bench_press__pause", name: "", nameSnapshot: "Pause Bench Press", fields },
      ],
    };
    mockPlans.mockResolvedValue([plan]);
    serveRecentWorkouts([]);
    mockStats.mockResolvedValue([]);
    renderScreen(StartWorkoutScreen, { route: LayoutRoutes.Home });
    const load = loadCatalog([CATALOG_ROW]);
    if (load.kind !== "ok") throw new Error("fixture catalog refused");
    const checkUnknownId = jest.fn(async () => {});
    act(() =>
      useCatalogStore.setState({
        catalog: { version: "h1", movements: load.movements, index: load.index },
        cacheLoaded: true,
        checkUnknownId,
      })
    );

    fireEvent.press(await screen.findByRole("button", { name: "Pull" }));

    expect(screen.getByText("Row")).toBeOnTheScreen();
    expect(screen.getByText("Pause Bench Press")).toBeOnTheScreen();
    expect(screen.getByText("No longer in the catalog")).toBeOnTheScreen();
    await waitFor(() => expect(checkUnknownId).toHaveBeenCalled());
    expect(checkUnknownId).toHaveBeenCalledTimes(1);
  });
});

// TICKET-061: archived plans are hidden until Show archived, and search follows it.
describe("StartWorkoutScreen, archived plans", () => {
  const OLD_PUSH: WorkoutPlan = { ...plan("old_push", "Push v1", ["Bench Press"]), archived: true };

  async function renderWith(plans: WorkoutPlan[], options: Parameters<typeof renderScreen>[1] = {}) {
    mockStats.mockResolvedValue([]);
    mockPlans.mockResolvedValue(plans);
    serveRecentWorkouts([]);
    renderScreen(StartWorkoutScreen, { route: LayoutRoutes.Home, ...options });
    await waitFor(() => expect(mockSessions).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("YOUR PLANS")).toBeOnTheScreen());
  }

  it("hides archived plans until shown, then starts one like any other", async () => {
    const startWorkout = jest.fn().mockResolvedValue({ status: "started" });
    await renderWith([PUSH, OLD_PUSH], { workoutActions: { startWorkout } });
    await screen.findByText("Push");
    expect(screen.queryByText("Push v1")).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "Show archived" }));
    expect(screen.getByText("ARCHIVED")).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Push v1" })));
    await act(async () => fireEvent.press(primaryButton()));
    expect(startWorkout).toHaveBeenCalledWith(OLD_PUSH);
  });

  it("keeps hidden archived plans out of search, and says when one matches", async () => {
    await renderWith([PUSH, PULL, OLD_PUSH]);
    await screen.findByText("Push");
    fireEvent.changeText(screen.UNSAFE_getByType(TextInput), "v1");

    expect(screen.queryByText("Push v1")).toBeNull();
    expect(screen.getByText("No plans match “v1”")).toBeOnTheScreen();
    expect(screen.getByText("1 archived plan matches. Show archived to see it.")).toBeOnTheScreen();
  });

  it("says every plan is archived instead of No plans yet", async () => {
    await renderWith([OLD_PUSH]);
    expect(await screen.findByText("All your plans are archived")).toBeOnTheScreen();
    expect(screen.queryByText("No plans yet")).toBeNull();
  });

  it("offers no toggle when nothing is archived", async () => {
    await renderWith([PUSH, PULL]);
    await screen.findByText("Push");
    expect(screen.queryByRole("button", { name: "Show archived" })).toBeNull();
  });
});

// TICKET-065: tapping a plan opens its card over the list.
describe("StartWorkoutScreen, plan card", () => {
  /** The card's Modal, for Android back (`onRequestClose`). */
  const cardModal = () =>
    screen.UNSAFE_getAllByType(Modal).find((modal) => modal.props.visible && within(modal).queryByTestId("plan-card"))!;

  it("opens with the days since, the minutes and each exercise's last time, then starts the plan", async () => {
    let resolveStats!: (value: unknown) => void;
    mockStats.mockReturnValue(new Promise((resolve) => (resolveStats = resolve)));
    const startWorkout = jest.fn().mockResolvedValue({ status: "started" });
    const started = Date.now() - 9 * DAY;
    await renderStart({ workoutActions: { startWorkout } }, [
      { ...session("push", started, 4980), endedAt: started + 50 * 60_000 },
    ]);
    await waitFor(() => expect(summary("push")).toHaveTextContent(/last done 9 days ago/));

    fireEvent.press(screen.getByRole("button", { name: "Push" }));

    expect(screen.getByTestId("plan-card-since")).toHaveTextContent("9days since last");
    expect(screen.getByTestId("plan-card-meta")).toHaveTextContent("2 exercises · about 50 min last time");
    expect(screen.getByTestId("last-time-bench-press")).toHaveTextContent("…");
    // After the stored copy is read: there is none, so a first load.
    await waitFor(() => expect(mockStats).toHaveBeenCalledWith(TEST_USER_ID));

    const bench = buildStats("Bench Press", [{ sets: [{ Weight: "65", Reps: "8" }, { Weight: "60", Reps: "10" }] }]);
    await act(async () => resolveStats([bench]));
    expect(screen.getByTestId("last-time-bench-press")).toHaveTextContent("2 sets · top 65 kg × 8");
    expect(screen.getByTestId("last-time-squat")).toHaveTextContent("new");

    await act(async () => fireEvent.press(primaryButton()));
    expect(startWorkout).toHaveBeenCalledWith(PUSH);
    expect(await screen.findByText("route:LogWorkout")).toBeOnTheScreen();
  });

  it("closes from the X, the dim area and Android back without starting anything", async () => {
    mockStats.mockResolvedValue([]);
    const startWorkout = jest.fn();
    await renderStart({ workoutActions: { startWorkout } });

    fireEvent.press(screen.getByRole("button", { name: "Push" }));
    // The drag area must claim the touch on start: on Android, moves inside the
    // Modal never asked it, so a drag did nothing (device, 2026-11-03). The
    // gesture itself is device-only.
    expect(screen.getByTestId("plan-card-drag").props.onStartShouldSetResponder({})).toBe(true);
    fireEvent.press(screen.getByRole("button", { name: "Close" }));
    expect(card()).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "Push" }));
    // Not an accessibility element (the X is the labelled way out), so hidden to default queries.
    fireEvent.press(screen.getByTestId("plan-card-backdrop", { includeHiddenElements: true }));
    expect(card()).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "Pull" }));
    act(() => cardModal().props.onRequestClose());
    expect(card()).toBeNull();

    expect(startWorkout).not.toHaveBeenCalled();
    expect(screen.getByText("Push")).toBeOnTheScreen();
  });

  // PR #44 review: the card stays mounted with the screen, so its clock must be
  // read on each open, not once at mount, or a later open counts from the past.
  it("counts days since from the moment it opens, not from when the screen mounted", async () => {
    mockStats.mockResolvedValue([]);
    const mounted = Date.now();
    const clock = jest.spyOn(Date, "now").mockReturnValue(mounted);
    try {
      await renderStart({}, [session("push", mounted - DAY, 100)]);
      await waitFor(() => expect(summary("push")).toHaveTextContent(/last done yesterday/));
      fireEvent.press(screen.getByRole("button", { name: "Push" }));
      expect(screen.getByTestId("plan-card-since")).toHaveTextContent("1day since last");
      fireEvent.press(screen.getByRole("button", { name: "Close" }));

      clock.mockReturnValue(mounted + DAY);
      fireEvent.press(screen.getByRole("button", { name: "Push" }));
      expect(screen.getByTestId("plan-card-since")).toHaveTextContent("2days since last");
    } finally {
      clock.mockRestore();
    }
  });

  it("collapses the header to one line while the list is scrolled, keeping Start", async () => {
    mockStats.mockResolvedValue([]);
    await renderStart({}, [session("push", Date.now() - 9 * DAY, 100)]);
    await waitFor(() => expect(summary("push")).toHaveTextContent(/last done 9 days ago/));
    fireEvent.press(screen.getByRole("button", { name: "Push" }));

    fireEvent.scroll(screen.getByTestId("plan-card-list"), { nativeEvent: { contentOffset: { y: 120 } } });

    expect(screen.queryByTestId("plan-card-since")).toBeNull();
    expect(screen.getByText("9 days since last · 2 exercises")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Start Push" })).toBeOnTheScreen();
  });

  it("offers Resume, with the live timer, for the plan that is running", async () => {
    mockStats.mockResolvedValue([]);
    const startWorkout = jest.fn();
    const workout = buildWorkout(["Bench Press"], { id: "push", name: "Push", startTime: Date.now() - 90_000 });
    await renderStart({ workout, workoutActions: { startWorkout } });

    fireEvent.press(screen.getByRole("button", { name: "Push" }));

    expect(screen.getByTestId("plan-card-since")).toHaveTextContent(/^1:3\din progress$/);
    expect(screen.queryByRole("button", { name: "Start Push" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Resume Push" }));
    expect(await screen.findByText("route:LogWorkout")).toBeOnTheScreen();
    expect(startWorkout).not.toHaveBeenCalled();
  });

  // The running workout is no plan on this screen: its name and timer must come
  // from activeWorkout itself, as a Freestyle will in TICKET-067.
  it("blocks Start while another workout runs, naming it from the active workout", async () => {
    mockStats.mockResolvedValue([]);
    const startWorkout = jest.fn();
    const workout = buildWorkout(["Row"], { id: "not-a-plan", name: "Legs", startTime: Date.now() - 90_000 });
    await renderStart({ workout, workoutActions: { startWorkout } });

    fireEvent.press(screen.getByRole("button", { name: "Push" }));

    expect(screen.getByText("Legs is in progress. Finish or discard it to start this one.")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /^(Start|Resume) / })).toBeNull();
    const back = screen.getByRole("button", { name: "Back to Legs" });
    expect(back).toHaveTextContent(/^Back to Legs · 1:3\d$/);
    fireEvent.press(back);
    expect(await screen.findByText("route:LogWorkout")).toBeOnTheScreen();
    expect(startWorkout).not.toHaveBeenCalled();
  });
});
