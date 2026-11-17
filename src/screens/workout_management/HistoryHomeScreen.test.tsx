import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import HistoryHomeScreen from "./HistoryHomeScreen";
import { renderScreen, TEST_USER_ID } from "../../test/renderScreen";
import { getAllWorkoutPlans } from "../../services/db/userDB";
import { getOlderWorkoutsPage, getWorkoutWindowFromServer } from "../../services/db/workoutSessions";
import { WORKOUTS_ON_PHONE_MIN } from "../../config/sync";
import { HISTORY_RAIL_MIN_FULL } from "../../config/display";
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
  getOlderWorkoutsPage: jest.fn(),
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

/**
 * A FlatList renders only the rows near the viewport, and in tests nothing is laid out: give it a viewport and
 * a content height, then scroll to the end, so every row of a short test list exists.
 */
const scrollToEnd = () => {
  const list = screen.getByTestId("history-list");
  fireEvent(list, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } } });
  fireEvent(list, "contentSizeChange", 400, 6000);
  fireEvent.scroll(list, {
    nativeEvent: { contentOffset: { y: 5200 }, contentSize: { width: 400, height: 6000 }, layoutMeasurement: { width: 400, height: 800 } },
  });
};

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

  it("an Earlier month opens in place on tap and lists its workouts under its row", async () => {
    const now = new Date();
    const lastMonth = (day: number) => new Date(now.getFullYear(), now.getMonth() - 1, day, 10).getTime();
    // Three this month, then enough last month that the full section cuts it: three are left under Earlier.
    const recent = [0, 1, 2].map((i) => session("push", "Push", new Date(now.getFullYear(), now.getMonth(), 1, 10 + i).getTime()));
    const prev = Array.from({ length: HISTORY_RAIL_MIN_FULL }, (_, i) => session("pull", "Pull", lastMonth(28 - i)));
    await renderHistory([...recent, ...prev]);
    await screen.findByTestId("history-list");
    scrollToEnd();
    const row = await screen.findByRole("button", { name: /^.*, 3 more workouts$/ });
    const hidden = prev[prev.length - 1];
    expect(screen.queryByTestId(`history-row-${hidden.sessionId}`)).not.toBeOnTheScreen();
    fireEvent.press(row);
    expect(await screen.findByTestId(`history-row-${hidden.sessionId}`)).toBeOnTheScreen();
  });

  it("Older workouts loads a page for the chosen plan into the same list, and is gone once the start is reached", async () => {
    const day = 86_400_000;
    const held = Array.from({ length: WORKOUTS_ON_PHONE_MIN }, (_, i) => session("push", "Push", Date.now() - i * day));
    const olderOne = session("push", "Push", Date.now() - (WORKOUTS_ON_PHONE_MIN + 40) * day);
    jest.mocked(getOlderWorkoutsPage).mockResolvedValue({ sessions: [olderOne], docsRead: 1, reachedStart: true });
    await renderHistory(held);

    fireEvent.press(await screen.findByRole("button", { name: /^Filter workouts/ }));
    fireEvent.press(await screen.findByRole("button", { name: /^Push,/ }));
    await screen.findByTestId("history-list");
    scrollToEnd();
    fireEvent.press(await screen.findByRole("button", { name: /^Older workouts/ }));
    expect(await screen.findByTestId(`history-row-${olderOne.sessionId}`)).toBeOnTheScreen();
    expect(getOlderWorkoutsPage).toHaveBeenCalledWith(TEST_USER_ID, expect.any(Number), "push", expect.any(Number));
    expect(screen.queryByRole("button", { name: /^Older workouts/ })).not.toBeOnTheScreen();
  });

  it("with nothing logged, says so and offers Start a workout", async () => {
    await renderHistory([]);
    expect(await screen.findByText("No workouts yet")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Start a workout" }));
    expect(await screen.findByText(`route:Workout/${WorkoutRoutes.WorkoutHome}`)).toBeOnTheScreen();
  });
});

