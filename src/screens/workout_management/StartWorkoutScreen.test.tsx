import { TextInput } from "react-native";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import StartWorkoutScreen from "./StartWorkoutScreen";
import { renderScreen, TEST_USER_ID } from "../../test/renderScreen";
import { buildExercise, buildStats, buildWorkout } from "../../test/fixtures";
import { getAllWorkoutPlans } from "../../services/db/userDB";
import { getExerciseStats, getWorkoutSessions } from "../../services/db/workoutSessions";
import { LayoutRoutes } from "../../constants/routes";
import { WorkoutPlan } from "../../types/workoutType";
import { WorkoutSessionDoc } from "../../types/workoutSession";
import { PendingUpload } from "../../types/zustandWorkoutType";

jest.mock("../../services/db/userDB", () => ({
  ...jest.requireActual("../../services/db/userDB"),
  getAllWorkoutPlans: jest.fn(),
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

const plan = (id: string, name: string, exerciseNames: string[]): WorkoutPlan => ({
  id,
  name,
  exercises: exerciseNames.map((n) => buildExercise(n)),
});
const PUSH = plan("push", "Push", ["Bench Press", "Squat"]);
const PULL = plan("pull", "Pull", ["Row"]);

const session = (workoutId: string, startedAt: number, value: number): WorkoutSessionDoc => ({
  sessionId: `${workoutId}_${startedAt}`,
  workoutId,
  workoutName: workoutId,
  startedAt,
  endedAt: startedAt + 3600_000,
  exerciseIds: [],
  rollupPending: false,
  volume: {
    value,
    unit: "kg",
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
  mockSessions.mockResolvedValue({ sessions, lastDoc: null });
  const result = renderScreen(StartWorkoutScreen, { route: LayoutRoutes.Home, ...options });
  await screen.findByText("Push");
  await waitFor(() => expect(mockSessions).toHaveBeenCalled());
  return result;
}

const summary = (planId: string) => screen.getByTestId(`plan-summary-${planId}`);
const primaryButton = () => screen.getByRole("button", { name: /^(Start|Resume) / });

beforeEach(() => jest.clearAllMocks());

describe("StartWorkoutScreen", () => {
  it("shows each plan's last-done from one recent-sessions query, a pending upload winning", async () => {
    const pending: PendingUpload = {
      sessionId: "pull_pending",
      uid: TEST_USER_ID,
      workout: buildWorkout(["Row"], { id: "pull", startTime: Date.now() - DAY }),
      endedAt: Date.now() - DAY + 3600_000,
      failedAttempts: 0,
      lastError: null,
    };
    pending.workout.exercises[0].sets = [{ id: 1, fields: { Weight: "50", Reps: "10" } }];

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
    expect(mockSessions).toHaveBeenCalledTimes(1);
    expect(mockSessions).toHaveBeenCalledWith(TEST_USER_ID, { pageSize: 20 });
    // Nothing is prefetched on mount.
    expect(mockStats).not.toHaveBeenCalled();
  });

  it("expands a selected plan: names at once, top sets after one batched read", async () => {
    let resolveStats!: (value: unknown) => void;
    mockStats.mockReturnValue(new Promise((resolve) => (resolveStats = resolve)));
    await renderStart();

    fireEvent.press(screen.getByRole("button", { name: "Push" }));

    expect(screen.getByText("Bench Press")).toBeOnTheScreen();
    expect(screen.getByTestId("top-set-bench-press")).toHaveTextContent("…");
    expect(mockStats).toHaveBeenCalledTimes(1);
    expect(mockStats).toHaveBeenCalledWith(TEST_USER_ID, ["bench-press", "squat"]);

    const bench = buildStats("Bench Press", [{ sets: [{ Weight: "65", Reps: "8" }, { Weight: "60", Reps: "10" }] }]);
    await act(async () => resolveStats({ "bench-press": bench, squat: null }));

    expect(screen.getByTestId("top-set-bench-press")).toHaveTextContent("65 kg × 8");
    expect(screen.getByTestId("top-set-squat")).toHaveTextContent("not done yet");
  });

  it("filters plans by search, and a plan hidden by the search is no longer the one to start", async () => {
    mockStats.mockResolvedValue({});
    await renderStart();
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Pull" })));
    expect(primaryButton()).toHaveTextContent("Start Pull");

    // Paper's TextInput shows its placeholder only when focused, so find the
    // native input itself; the screen has exactly one.
    fireEvent.changeText(screen.UNSAFE_getByType(TextInput), "pus");

    expect(screen.getByText("Push")).toBeOnTheScreen();
    expect(screen.queryByText("Pull")).toBeNull();
    expect(screen.queryByRole("button", { name: /^(Start|Resume) / })).toBeNull();
  });

  it("shows the in-progress workout as a banner, not a modal, and Discard confirms first", async () => {
    const cancelWorkout = jest.fn().mockResolvedValue(undefined);
    const workout = buildWorkout(["Bench Press"], { id: "push", name: "Push", startTime: Date.now() - 90_000 });
    workout.exercises[0].sets = [
      { id: 1, fields: { Weight: "60", Reps: "8" } },
      { id: 2, fields: { Weight: "60", Reps: "8" } },
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

  it("starts the selected plan from the bottom bar, and refuses while another workout is running", async () => {
    mockStats.mockResolvedValue({});
    const startWorkout = jest.fn().mockResolvedValue(undefined);
    const first = await renderStart({ workoutActions: { startWorkout } });

    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Push" })));
    expect(primaryButton()).toHaveTextContent("Start Push");
    await act(async () => fireEvent.press(primaryButton()));

    expect(startWorkout).toHaveBeenCalledWith(PUSH);
    expect(await screen.findByText("route:LogWorkout")).toBeOnTheScreen();

    // Another workout in progress: the button says why it will not start one.
    startWorkout.mockClear();
    first.unmount();
    await renderStart({
      workout: buildWorkout(["Row"], { id: "pull", name: "Pull" }),
      workoutActions: { startWorkout },
    });
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Push" })));
    expect(screen.getByText(/Pull is still in progress/)).toBeOnTheScreen();
    expect(primaryButton()).toBeDisabled();
    fireEvent.press(primaryButton());
    expect(startWorkout).not.toHaveBeenCalled();
  });
});
