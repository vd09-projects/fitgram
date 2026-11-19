import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import ExerciseScreen from "./ExerciseScreen";
import { renderScreen, TEST_USER_ID } from "../../test/renderScreen";
import { getWorkoutById, getWorkoutWindowFromServer } from "../../services/db/workoutSessions";
import { buildSessionId } from "../../utils/exerciseStats";
import { serveRecentWorkouts } from "../../test/recentWorkouts";
import { buildExercise, buildWorkout } from "../../test/fixtures";
import { WorkoutRoutes } from "../../constants/routes";
import type { LiftRecord, WorkoutSessionDoc } from "../../types/workoutSession";
import type { PendingUpload } from "../../types/zustandWorkoutType";
import { useWorkoutStore } from "../../stores/useWorkoutStore";

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

  it("says no session is on the phone, not that the lift was never done, when none of the held workouts has it", async () => {
    await open([session("s1", day(9), [lift("Squat", [100])])]);
    expect(await screen.findByText("No sessions of this exercise in the workouts on this phone.")).toBeOnTheScreen();
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
