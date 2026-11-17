import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import HistoryHomeScreen from "./HistoryHomeScreen";
import { renderScreen, TEST_USER_ID } from "../../test/renderScreen";
import { getAllWorkoutPlans } from "../../services/db/userDB";
import { getWorkoutWindowFromServer } from "../../services/db/workoutSessions";
import { serveRecentWorkouts } from "../../test/recentWorkouts";
import { buildWorkout } from "../../test/fixtures";
import { WorkoutRoutes } from "../../constants/routes";
import { WorkoutSessionDoc } from "../../types/workoutSession";
import { useWorkoutStore } from "../../stores/useWorkoutStore";

jest.mock("../../services/db/userDB", () => ({
  ...jest.requireActual("../../services/db/userDB"),
  getAllWorkoutPlans: jest.fn(),
  getChangedPlans: jest.fn(async () => []),
}));
jest.mock("../../services/db/workoutSessions", () => ({
  ...jest.requireActual("../../services/db/workoutSessions"),
  getNewestSessionStamp: jest.fn(),
  getWorkoutWindowFromServer: jest.fn(),
  getLastWorkoutOfPlan: jest.fn(),
  getChangedSessions: jest.fn(),
}));

const DAY = 24 * 60 * 60 * 1000;
const session = (workoutId: string, workoutName: string, startedAt: number): WorkoutSessionDoc => ({
  sessionId: `${workoutId}_${startedAt}`,
  workoutId,
  workoutName,
  startedAt,
  endedAt: startedAt + 3600_000,
  exerciseIds: [],
  lifts: [],
});

async function renderHistory(sessions: WorkoutSessionDoc[]) {
  jest.mocked(getAllWorkoutPlans).mockResolvedValue([]);
  serveRecentWorkouts(sessions);
  renderScreen(HistoryHomeScreen, { workoutRoute: WorkoutRoutes.HistoryHome });
  await waitFor(() => expect(getWorkoutWindowFromServer).toHaveBeenCalled());
}

beforeEach(() => jest.clearAllMocks());

describe("HistoryHomeScreen", () => {
  it("opens on Workouts with All selected, Exercises switched off", async () => {
    await renderHistory([session("push", "Push", Date.now())]);
    expect(await screen.findByRole("button", { name: "Filter workouts, All workouts" })).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "Workouts", selected: true })).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "Exercises", disabled: true })).toBeOnTheScreen();
  });

  it("a plan chosen in the filter narrows the list, and All brings the rest back", async () => {
    const push = session("push", "Push", Date.now());
    const pull = session("pull", "Pull", Date.now() - DAY);
    await renderHistory([push, pull]);
    expect(await screen.findByTestId(`history-row-${pull.sessionId}`)).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: /^Filter workouts/ }));
    fireEvent.press(await screen.findByRole("button", { name: /^Pull,/ }));
    expect(screen.queryByTestId(`history-row-${push.sessionId}`)).not.toBeOnTheScreen();
    expect(screen.getByTestId(`history-row-${pull.sessionId}`)).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: /^Filter workouts/ }));
    fireEvent.press(await screen.findByRole("button", { name: "All workouts" }));
    expect(await screen.findByTestId(`history-row-${push.sessionId}`)).toBeOnTheScreen();
  });

  it("a workout opens the Session route", async () => {
    await renderHistory([session("push", "Push", Date.now())]);
    fireEvent.press(await screen.findByText("Push"));
    expect(await screen.findByText(`route:Workout/${WorkoutRoutes.Session}`)).toBeOnTheScreen();
  });

  it("says a rejected upload did not upload and offers Try again; another account's entry shows nothing", async () => {
    const entry = (uid: string, failedAttempts: number) => ({
      sessionId: `${uid}_s`,
      uid,
      workout: buildWorkout(["Bench Press"]),
      endedAt: 1,
      failedAttempts,
      lastError: failedAttempts ? "rejected" : null,
    });
    useWorkoutStore.setState({ pendingUploads: [entry("someone-else", 2)] });
    await renderHistory([session("push", "Push", Date.now())]);
    await screen.findByText("Push");
    expect(screen.queryByTestId("history-notice")).not.toBeOnTheScreen();

    act(() => useWorkoutStore.setState({ pendingUploads: [entry(TEST_USER_ID, 1)] }));
    expect(await screen.findByText("1 workout didn’t upload")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
  });
});
