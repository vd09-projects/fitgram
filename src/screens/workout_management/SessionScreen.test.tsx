import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import SessionScreen from "./SessionScreen";
import { renderScreen, TEST_USER_ID } from "../../test/renderScreen";
import { getWorkoutById, getWorkoutWindowFromServer } from "../../services/db/workoutSessions";
import { serveRecentWorkouts } from "../../test/recentWorkouts";
import { buildExercise, buildWorkout } from "../../test/fixtures";
import { WorkoutRoutes } from "../../constants/routes";
import type { LiftRecord, WorkoutSessionDoc } from "../../types/workoutSession";
import type { PendingUpload } from "../../types/zustandWorkoutType";
import { useWorkoutStore } from "../../stores/useWorkoutStore";

let mockParams: { sessionId: string; workoutName: string; startedAt: number };
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

const lift = (name: string, rest: Partial<LiftRecord> = {}): LiftRecord => ({
  id: name.toLowerCase(),
  name,
  fields: buildExercise(name).fields,
  sets: [{ segments: [{ Weight: 60, Reps: 8 }], effort: null }],
  verdict: null,
  reason: "first_time",
  ...rest,
});

const session = (sessionId: string, lifts: LiftRecord[], rest: Partial<WorkoutSessionDoc> = {}): WorkoutSessionDoc => ({
  sessionId,
  workoutId: "push",
  workoutName: "Push",
  startedAt: new Date(2026, 10, 9, 18).getTime(),
  endedAt: new Date(2026, 10, 9, 18, 58).getTime(),
  exerciseIds: lifts.map((l) => l.id),
  lifts,
  ...rest,
});

const open = async (held: WorkoutSessionDoc[], sessionId: string, pendingUploads: PendingUpload[] = []) => {
  mockParams = { sessionId, workoutName: "Push", startedAt: 1 };
  serveRecentWorkouts(held);
  renderScreen(SessionScreen, { workoutRoute: WorkoutRoutes.Session, workoutActions: { pendingUploads } });
  await waitFor(() => expect(getWorkoutWindowFromServer).toHaveBeenCalled());
};

const offline = () => Object.assign(new Error("offline"), { code: "unavailable" });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getWorkoutById).mockResolvedValue(null);
});
afterEach(() => jest.restoreAllMocks());

describe("SessionScreen", () => {
  it("shows a held workout from the window with no read of its own: headline, words, captions and sets", async () => {
    const held = session("s1", [
      lift("Bench", { verdict: "better", reason: null }),
      lift("Fly", { swappedFrom: { id: "x", name: "Rear Delt Fly" } }),
    ]);
    await open([held], "s1");
    expect(await screen.findByText("Bench beat last time.")).toBeOnTheScreen();
    expect(screen.getByText("Mon 9 Nov · 58 min")).toBeOnTheScreen();
    expect(screen.getByText("Better")).toBeOnTheScreen();
    expect(screen.getByText("Swapped in for Rear Delt Fly")).toBeOnTheScreen();
    expect(screen.getAllByText("60 kg × 8")).toHaveLength(2);
    expect(screen.queryByTestId("session-notice")).not.toBeOnTheScreen();
    expect(getWorkoutById).not.toHaveBeenCalled();
  });

  it("shows a queued workout as waiting, then did-not-upload with Retry once the server rejected it", async () => {
    const entry = (failedAttempts: number): PendingUpload => ({
      sessionId: "queued_5000",
      uid: TEST_USER_ID,
      workout: buildWorkout([], { id: "queued", startTime: 5_000, exercises: [buildExercise("Bench", { sets: [{ id: 1, segments: [{ Weight: 60, Reps: 5 }] }] })] }),
      endedAt: 9_000,
      failedAttempts,
      lastError: failedAttempts ? "rejected" : null,
    });
    await open([session("s1", [lift("Bench")])], "queued_5000", [entry(0)]);
    expect(await screen.findByText("Not uploaded yet")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeOnTheScreen();
    // A queued workout's verdicts are provisional: no headline until they are computed.
    expect(screen.queryByText(/beat last time|no earlier session/)).not.toBeOnTheScreen();

    act(() => useWorkoutStore.setState({ pendingUploads: [entry(1)] }));
    expect(await screen.findByText("Didn't upload")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
    expect(getWorkoutById).not.toHaveBeenCalled();
  });

  it("reads a workout the phone does not hold by id, once, and shows it", async () => {
    jest.mocked(getWorkoutById).mockResolvedValue(session("old", [lift("Bench"), lift("Row")]));
    await open([session("s1", [lift("Bench")])], "old");
    expect(await screen.findByText("Two lifts, no earlier session to compare with.")).toBeOnTheScreen();
    expect(getWorkoutById).toHaveBeenCalledTimes(1);
    expect(getWorkoutById).toHaveBeenCalledWith(TEST_USER_ID, "old");
  });

  it("says it needs a connection when the read is refused, and asks again on Try again", async () => {
    jest.mocked(getWorkoutById).mockRejectedValueOnce(offline());
    await open([session("s1", [lift("Bench")])], "old");
    expect(await screen.findByText("Needs a connection")).toBeOnTheScreen();

    jest.mocked(getWorkoutById).mockResolvedValue(session("old", [lift("Bench")]));
    const later = Date.now() + 60_000; // past the gap a refusal holds the next read off
    jest.spyOn(Date, "now").mockReturnValue(later);
    fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("One lift, no earlier session to compare with.")).toBeOnTheScreen();
    expect(getWorkoutById).toHaveBeenCalledTimes(2);
  });

  it("says a workout that is gone is gone, and one whose lifts cannot be read has no details", async () => {
    jest.mocked(getWorkoutById).mockResolvedValue(null);
    await open([session("s1", [lift("Bench")])], "gone");
    expect(await screen.findByText("This workout is no longer there.")).toBeOnTheScreen();
  });

  it("shows details not available, not an empty workout, when the lifts could not be read", async () => {
    await open([session("s1", [], { liftsUnreadable: true })], "s1");
    expect(await screen.findByText("Details not available")).toBeOnTheScreen();
    expect(screen.queryByText(/beat last time|no earlier session|No lift/)).not.toBeOnTheScreen();
  });
});
