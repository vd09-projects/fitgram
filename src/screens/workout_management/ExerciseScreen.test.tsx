import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import ExerciseScreen from "./ExerciseScreen";
import { renderScreen, TEST_USER_ID } from "../../test/renderScreen";
import { getSessionsOfExercisePage, getWorkoutById, getWorkoutWindowFromServer } from "../../services/db/workoutSessions";
import { buildSessionId } from "../../utils/exerciseStats";
import { serveRecentWorkouts } from "../../test/recentWorkouts";
import { buildExercise, buildWorkout } from "../../test/fixtures";
import { WorkoutRoutes } from "../../constants/routes";
import { WORKOUTS_ON_PHONE_MIN } from "../../config/sync";
import { EXERCISE_LOG_PAGE_SIZE } from "../../config/display";
import type { LiftRecord, WorkoutSessionDoc } from "../../types/workoutSession";
import type { PendingUpload } from "../../types/zustandWorkoutType";
import { useWorkoutStore } from "../../stores/useWorkoutStore";
import { useRecentWorkoutsStore } from "../../stores/useRecentWorkoutsStore";

let mockParams: { exerciseId: string; exerciseName: string };
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useRoute: () => ({ params: mockParams }),
}));
jest.mock("../../services/db/userDB", () => ({
  ...jest.requireActual("../../services/db/userDB"),
  getAllWorkoutPlans: jest.fn(async () => []),
  getChangedPlans: jest.fn(async () => []),
}));
jest.mock("../../services/db/workoutSessions", () => ({
  ...jest.requireActual("../../services/db/workoutSessions"),
  getNewestSessionStamp: jest.fn(),
  getWorkoutWindowFromServer: jest.fn(),
  getLastWorkoutOfPlan: jest.fn(),
  getChangedSessions: jest.fn(),
  getWorkoutById: jest.fn(),
  getSessionsOfExercisePage: jest.fn(),
}));

const lb = [
  { name: "Weight", role: "weight", unit: "lb" },
  { name: "Reps", role: "reps" },
] as LiftRecord["fields"];

const lift = (name: string, weights: number[], rest: Partial<LiftRecord> = {}): LiftRecord => ({
  id: name.toLowerCase(),
  name,
  fields: buildExercise(name).fields,
  sets: weights.map((weight) => ({ segments: [{ Weight: weight, Reps: 8 }], effort: null })),
  verdict: null,
  reason: "first_time",
  ...rest,
});

const day = (d: number) => new Date(2026, 10, d, 18).getTime();
const session = (sessionId: string, startedAt: number, lifts: LiftRecord[], rest: Partial<WorkoutSessionDoc> = {}): WorkoutSessionDoc => ({
  sessionId,
  workoutId: "push",
  workoutName: "Push",
  startedAt,
  endedAt: startedAt + 3_000_000,
  exerciseIds: lifts.map((l) => l.id),
  lifts,
  ...rest,
});

const open = async (held: WorkoutSessionDoc[], pendingUploads: PendingUpload[] = []) => {
  mockParams = { exerciseId: "bench", exerciseName: "Bench Press" };
  serveRecentWorkouts(held);
  renderScreen(ExerciseScreen, { workoutRoute: WorkoutRoutes.Exercise, workoutActions: { pendingUploads } });
  await waitFor(() => expect(getWorkoutWindowFromServer).toHaveBeenCalled());
};

const queued = (failedAttempts: number, exerciseName: string): PendingUpload => ({
  sessionId: buildSessionId("push", day(12)),
  uid: TEST_USER_ID,
  workout: buildWorkout([], { id: "push", startTime: day(12), exercises: [buildExercise(exerciseName, { sets: [{ id: 1, segments: [{ Weight: 60, Reps: 5 }] }] })] }),
  endedAt: day(12) + 1_000,
  failedAttempts,
  lastError: failedAttempts ? "rejected" : null,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getWorkoutById).mockResolvedValue(null);
});

describe("ExerciseScreen: the log", () => {
  it("shows the newest session's average as the figure and every held session newest first, with no read of its own", async () => {
    await open([
      session("s1", day(2), [lift("Bench", [60, 60, 55])]),
      session("s2", day(9), [lift("Bench", [62.5, 60, 55]), lift("Fly", [10])], { workoutId: "freestyle" }),
    ]);
    expect(await screen.findByTestId("exercise-figure")).toHaveTextContent("59.2 kg");
    expect(screen.getByText("9 Nov")).toBeOnTheScreen();
    expect(screen.getByText("2 Nov")).toBeOnTheScreen();
    expect(screen.getByText("Freestyle")).toBeOnTheScreen();
    expect(screen.getByText("Set 3")).toBeOnTheScreen();
    expect(getWorkoutById).not.toHaveBeenCalled();
  });

  it("tells two sessions on one day apart by their time, under the date", async () => {
    await open([
      session("s1", new Date(2026, 10, 9, 9, 5).getTime(), [lift("Bench", [60])]),
      session("s2", new Date(2026, 10, 9, 18, 30).getTime(), [lift("Bench", [62.5])]),
    ]);
    expect(await screen.findByText("18:30")).toBeOnTheScreen();
    expect(screen.getByText("09:05")).toBeOnTheScreen();
    expect(screen.getAllByText("9 Nov")).toHaveLength(2);
  });

  it("opens a row's Session", async () => {
    await open([session("s1", day(9), [lift("Bench", [60])])]);
    fireEvent.press(await screen.findByTestId("exercise-log-date-s1:0"));
    expect(await screen.findByText(`route:Workout/${WorkoutRoutes.Session}`)).toBeOnTheScreen();
  });

  it("puts a line between sessions logged in different units, naming the older unit", async () => {
    await open([
      session("s1", day(9), [lift("Bench", [135], { fields: lb })]),
      session("s2", day(2), [lift("Bench", [60])]),
    ]);
    expect(await screen.findByText("Before this the sets were in kg, so they are not compared")).toBeOnTheScreen();
  });

  it("says there are no sessions when the phone holds the whole history and none has the lift, with no Older sessions row", async () => {
    await open([session("s1", day(9), [lift("Squat", [100])])]);
    expect(await screen.findByText("No sessions of this exercise.")).toBeOnTheScreen();
    expect(screen.queryByTestId("exercise-older")).not.toBeOnTheScreen();
  });
});

describe("ExerciseScreen: uploads", () => {
  it("counts a waiting workout that has this lift, then offers Try again once it was rejected", async () => {
    await open([session("s1", day(2), [lift("Bench", [60])])], [queued(0, "Bench")]);
    expect(await screen.findByText("1 workout waiting to upload")).toBeOnTheScreen();
    act(() => useWorkoutStore.setState({ pendingUploads: [queued(1, "Bench")] }));
    expect(await screen.findByText("1 workout didn’t upload")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
  });

  it("says nothing about a waiting workout that does not have this lift", async () => {
    await open([session("s1", day(2), [lift("Bench", [60])])], [queued(0, "Squat")]);
    await screen.findByTestId("exercise-figure");
    expect(screen.queryByTestId("history-notice")).not.toBeOnTheScreen();
  });
});

describe("ExerciseScreen: the graph", () => {
  const size = () => fireEvent(screen.getByTestId("exercise-graph"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 362, height: 116 } } });
  const six = () => [1, 2, 3, 4, 5, 6].map((d) => session(`s${d}`, day(d), [lift("Bench", [50 + d * 2.5])]));

  it("says how many sessions there are, and draws no graph, below the minimum", async () => {
    await open(six().slice(0, 2));
    await screen.findByTestId("exercise-figure");
    size();
    expect(await screen.findByText("The graph starts after 5 sessions. 2 so far.")).toBeOnTheScreen();
    expect(screen.queryByTestId("graph-dot-s1:0")).not.toBeOnTheScreen();
  });

  it("opens a peek card from a dot, and the card opens that session", async () => {
    await open(six());
    await screen.findByTestId("exercise-figure");
    size();
    fireEvent.press(await screen.findByTestId("graph-dot-s3:0"));
    await screen.findByTestId("graph-peek");
    expect(screen.getByText("Nov 3")).toBeOnTheScreen();
    expect(screen.getAllByText("57.5 kg")).toHaveLength(2); // the card, and the log row of the same day
    fireEvent.press(screen.getByTestId("graph-peek"));
    expect(await screen.findByText(`route:Workout/${WorkoutRoutes.Session}`)).toBeOnTheScreen();
  });

  it("closes the card on a tap anywhere else, and on the same dot again", async () => {
    await open(six());
    await screen.findByTestId("exercise-figure");
    size();
    fireEvent.press(await screen.findByTestId("graph-dot-s3:0"));
    await screen.findByTestId("graph-peek");
    fireEvent.press(screen.getByLabelText("Close the card"));
    expect(screen.queryByTestId("graph-peek")).not.toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("graph-dot-s3:0"));
    fireEvent.press(screen.getByTestId("graph-dot-s3:0"));
    expect(screen.queryByTestId("graph-peek")).not.toBeOnTheScreen();
  });
});

describe("ExerciseScreen: past the window", () => {
  const DAY = 86_400_000;
  /** A full window of workouts that do not have the lift, so the history reaches back past what the phone holds. */
  const fullWindow = () => Array.from({ length: WORKOUTS_ON_PHONE_MIN }, (_, i) => session(`w${i}`, Date.now() - i * DAY, [lift("Squat", [100])]));
  const old = (id: string, daysAgo: number, weight: number) => session(id, Date.now() - (WORKOUTS_ON_PHONE_MIN + daysAgo) * DAY, [lift("Bench", [weight])]);

  it("says the lift is not in the held workouts, not that it was never done, and offers the older sessions", async () => {
    await open(fullWindow());
    expect(await screen.findByText("No sessions of this exercise in the workouts on this phone.")).toBeOnTheScreen();
    expect(screen.getByLabelText(`Older sessions, Show ${EXERCISE_LOG_PAGE_SIZE}`)).toBeOnTheScreen();
  });

  it("a tap loads the next page into the log and the graph, and the row goes once the start is reached", async () => {
    jest.mocked(getSessionsOfExercisePage).mockResolvedValue({ sessions: [old("a", 10, 60), old("b", 20, 55)], docsRead: 2, reachedStart: true });
    await open(fullWindow());
    fireEvent.press(await screen.findByTestId("exercise-older"));
    expect(await screen.findByTestId("exercise-log-date-a:0")).toBeOnTheScreen();
    expect(screen.getByTestId("exercise-log-date-b:0")).toBeOnTheScreen();
    expect(getSessionsOfExercisePage).toHaveBeenCalledWith(TEST_USER_ID, "bench", expect.any(Number), EXERCISE_LOG_PAGE_SIZE);
    expect(screen.queryByTestId("exercise-older")).not.toBeOnTheScreen();
  });

  it("says it needs a connection when the page is refused, and keeps what was already loaded", async () => {
    jest.mocked(getSessionsOfExercisePage).mockResolvedValueOnce({ sessions: [old("a", 10, 60)], docsRead: 1, reachedStart: false });
    await open(fullWindow());
    fireEvent.press(await screen.findByTestId("exercise-older"));
    await screen.findByTestId("exercise-log-date-a:0");
    jest.mocked(getSessionsOfExercisePage).mockRejectedValue(Object.assign(new Error("client is offline"), { code: "unavailable" }));
    fireEvent.press(screen.getByTestId("exercise-older"));
    expect(await screen.findByLabelText("Older sessions, Needs a connection")).toBeOnTheScreen();
    expect(screen.getByTestId("exercise-log-date-a:0")).toBeOnTheScreen();
  });
});

describe("ExerciseScreen: the view options", () => {
  const sessionsOf = (n: number) => Array.from({ length: n }, (_, i) => session(`v${i}`, day(1 + i), [lift("Bench", [50 + i * 2.5, 50, 45])]));
  const options = () => fireEvent.press(screen.getByTestId("exercise-options"));
  const rows = () => screen.queryAllByTestId(/^exercise-log-date-/);

  it("the measure label opens its choices, and Total lifted changes the figure, the label and the row to weight × reps added up", async () => {
    await open([session("s1", day(9), [lift("Bench", [60, 50])])]);
    expect(await screen.findByTestId("exercise-figure")).toHaveTextContent("55.0 kg");
    fireEvent.press(screen.getByTestId("exercise-measure"));
    fireEvent.press(await screen.findByLabelText(/^Total lifted, Weight × reps/));
    expect(screen.getByTestId("exercise-figure")).toHaveTextContent("880 kg");
    expect(screen.getByText("Total lifted")).toBeOnTheScreen();
    expect(screen.getAllByText("880 kg")).toHaveLength(2); // the figure, and the row under its date
  });

  it("Show: List has no graph, Graph has no log, and the options icon wears a dot only while a setting is not the default", async () => {
    await open(sessionsOf(6));
    await screen.findByTestId("exercise-figure");
    expect(screen.queryByTestId("exercise-options-dot")).not.toBeOnTheScreen();
    options();
    fireEvent.press(await screen.findByLabelText("List"));
    expect(screen.queryByTestId("exercise-graph")).not.toBeOnTheScreen();
    expect(screen.getByTestId("exercise-log")).toBeOnTheScreen();
    expect(screen.getByTestId("exercise-options-dot")).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("Graph"));
    expect(screen.getByTestId("exercise-graph")).toBeOnTheScreen();
    expect(screen.queryByTestId("exercise-log")).not.toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("Graph and list"));
    expect(screen.queryByTestId("exercise-options-dot")).not.toBeOnTheScreen();
  });

  it("Sessions shown limits the log to the newest, and All lists every one the phone has", async () => {
    await open(sessionsOf(8));
    await screen.findByTestId("exercise-figure");
    expect(rows()).toHaveLength(8); // the default shows up to ten
    options();
    fireEvent.press(await screen.findByLabelText("Last 5"));
    expect(rows()).toHaveLength(5);
    expect(screen.getByTestId("exercise-log-date-v7:0")).toBeOnTheScreen(); // the newest stays
    expect(screen.queryByTestId("exercise-log-date-v0:0")).not.toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("All"));
    expect(rows()).toHaveLength(8);
  });

  it("the Details switches take the H and E badges, and the better and lower marks, off the sets", async () => {
    await open([
      session("a", day(2), [lift("Bench", [50, 50], { sets: [{ segments: [{ Weight: 60, Reps: 8 }], effort: "hard" }, { segments: [{ Weight: 50, Reps: 8 }], effort: null }] })]),
      session("b", day(1), [lift("Bench", [50, 50])]),
    ]);
    await screen.findByTestId("exercise-figure");
    expect(screen.getAllByText("H")).toHaveLength(1);
    expect(screen.getAllByLabelText("better than last time").length).toBeGreaterThan(0);
    options();
    fireEvent(await screen.findByLabelText("Effort badges"), "valueChange", false);
    expect(screen.getAllByText("H")).toHaveLength(1); // only the sheet's own legend remains
    fireEvent(screen.getByLabelText("Better and lower marks"), "valueChange", false);
    expect(screen.queryAllByLabelText("better than last time")).toHaveLength(1); // only the sheet's own legend remains
  });
});

describe("ExerciseScreen: review of PR #77", () => {
  it("does not give the two rows of one workout a time as if two sessions fell on the day", async () => {
    await open([
      session("a", new Date(2026, 10, 9, 18).getTime(), [lift("Bench", [60]), lift("Fly", [10]), lift("Bench", [50])]),
      session("b", new Date(2026, 10, 2, 18).getTime(), [lift("Bench", [55])]),
    ]);
    await screen.findByTestId("exercise-figure");
    expect(screen.getAllByText("9 Nov")).toHaveLength(2);
    expect(screen.queryByText("18:00")).not.toBeOnTheScreen();
  });

  it("says a row's numbers aloud, not only its date and workout", async () => {
    await open([session("a", day(9), [lift("Bench", [60, 50], { sets: [{ segments: [{ Weight: 60, Reps: 8 }], effort: "hard" }, { segments: [{ Weight: 50, Reps: 8 }], effort: null }] })])]);
    await screen.findByTestId("exercise-figure");
    expect(screen.getByLabelText(/^9 Nov, Push, average weight 55\.0 kg/)).toBeOnTheScreen();
    // The sets row is a separate stack from the dates, so it must say which row it is.
    expect(screen.getByLabelText(/^9 Nov, Push, set 1: 60 × 8, felt hard.*set 2: 50 × 8/)).toBeOnTheScreen();
  });

  it("ignores an older list loaded before the window moved", async () => {
    await open([session("a", day(9), [lift("Bench", [60])])]);
    await screen.findByTestId("exercise-figure");
    const stale = session("gone", day(1), [lift("Bench", [40])]);
    act(() => useRecentWorkoutsStore.setState({ olderWorkouts: { "*": { windowStart: 123, sessions: [stale], reachedStart: false, read: null } } }));
    expect(screen.queryByTestId("exercise-log-date-gone:0")).not.toBeOnTheScreen();
  });
});
