// TICKET-087 stage 2: the real order in which the upload queue reaches the server,
// from the real `drainPendingUploads` with `saveWorkoutSession` replaced by a log.
//
// Why it matters: a stored verdict compares a lift with the session before it by
// start time. If the queue uploads a later workout first, that verdict is computed
// without the earlier one (TICKET-081, known gap a).
import type { User } from "firebase/auth";
import { saveWorkoutSession } from "../services/db/workoutSessions";
import { drainPendingUploads, useWorkoutStore } from "../stores/useWorkoutStore";
import { useAuthStore } from "../stores/authStore";
import { resetStores } from "../test/renderScreen";
import { buildExercise, buildWorkout } from "../test/fixtures";
import { buildSessionId } from "../utils/exerciseStats";

jest.mock("../services/db/workoutSessions", () => ({
  ...jest.requireActual("../services/db/workoutSessions"),
  saveWorkoutSession: jest.fn(),
}));
jest.mock("../utils/toastUtils", () => ({
  __esModule: true,
  default: { alert: jest.fn(), success: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const save = saveWorkoutSession as jest.MockedFunction<typeof saveWorkoutSession>;

const entry = (startTime: number) => {
  const workout = buildWorkout([], {
    id: "plan-a",
    startTime,
    exercises: [buildExercise("Bench Press", { sets: [{ id: 1, segments: [{ Weight: 60, Reps: 5 }] }] })],
  });
  return {
    sessionId: buildSessionId(workout.id, startTime),
    uid: "u1",
    workout,
    endedAt: startTime + 1,
    failedAttempts: 0,
    lastError: null,
  };
};

it("a failed first upload lets the later workout reach the server first", async () => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  resetStores();
  useAuthStore.setState({ user: { uid: "u1" } as User });
  const first = entry(1_000);
  const second = entry(2_000);
  useWorkoutStore.setState({ pendingUploads: [first, second] });

  const arrived: number[] = [];
  save
    .mockRejectedValueOnce(new Error("rollup failed"))
    .mockImplementation(async (_uid, workout) => {
      arrived.push(workout.startTime);
      return { sessionId: "s", summaries: [] };
    });

  await drainPendingUploads(); // first fails and is skipped; second lands
  const afterFirstDrain = [...arrived];
  await drainPendingUploads(); // the next trigger retries the first
  console.log(`Start times in the order saved: ${JSON.stringify(afterFirstDrain)} then ${JSON.stringify(arrived.slice(afterFirstDrain.length))}`);

  expect(afterFirstDrain).toEqual([2_000]);
  expect(arrived).toEqual([2_000, 1_000]);
});
