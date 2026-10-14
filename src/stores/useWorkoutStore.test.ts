// TICKET-027: one save per session, and a discard cannot race a save.
//
// Store-only, no React. `saveWorkoutSession` is replaced at its module because
// the action under test is the one that calls it; renderScreen's
// `workoutActions` would replace `endWorkout` itself and test nothing.

import { saveWorkoutSession } from "../services/db/workoutSessions";
import show from "../utils/toastUtils";
import { useWorkoutStore } from "./useWorkoutStore";
import { resetStores } from "../test/renderScreen";
import { buildWorkout } from "../test/fixtures";

jest.mock("../services/db/workoutSessions", () => ({
  ...jest.requireActual("../services/db/workoutSessions"),
  saveWorkoutSession: jest.fn(),
}));
jest.mock("../utils/toastUtils", () => ({
  __esModule: true,
  default: { alert: jest.fn(), success: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const save = saveWorkoutSession as jest.MockedFunction<typeof saveWorkoutSession>;
const toast = show as jest.Mocked<typeof show>;

/** A save the test settles by hand, so it can act while the save is in flight. */
function deferredSave() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  save.mockImplementationOnce(
    () =>
      new Promise((res, rej) => {
        resolve = () => res({ sessionId: "s", rollupApplied: true });
        reject = rej;
      })
  );
  return { resolve: () => resolve(), reject: (error: Error) => reject(error) };
}

// Timers are fake, so Date.now() is frozen: give each test its own start time,
// or sessions from different tests would share a session id.
let startTime = 1_000;
const seedWorkout = () => {
  const workout = buildWorkout(["Bench Press"], { startTime: ++startTime });
  useWorkoutStore.setState({ activeWorkout: workout });
  return workout;
};
const store = () => useWorkoutStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  resetStores();
  // The store logs every save and failure; the assertions here use the toasts.
  jest.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("useWorkoutStore.endWorkout", () => {
  it("two calls without awaiting run one save and show one success toast", async () => {
    seedWorkout();
    const pending = deferredSave();

    const first = store().endWorkout("u1");
    const second = store().endWorkout("u1");
    pending.resolve();
    await Promise.all([first, second]);

    expect(save).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(store().activeWorkout).toBeNull();
  });

  // The guard must clear on failure. A guard that never clears passes every
  // other test in this file; only a retry catches it.
  it("a failed save can be retried", async () => {
    seedWorkout();
    save.mockRejectedValueOnce(new Error("offline"));
    await store().endWorkout("u1");

    expect(toast.alert).toHaveBeenCalledWith("Could not save workout", "offline");
    expect(store().activeWorkout).not.toBeNull();

    save.mockResolvedValueOnce({ sessionId: "s", rollupApplied: true });
    await store().endWorkout("u1");

    expect(save).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(store().activeWorkout).toBeNull();
  });
});

describe("useWorkoutStore.cancelWorkout", () => {
  // Chosen semantics: Finish wins. Discard is refused while the save runs, and
  // allowed again once it has settled without saving.
  it("is refused while a save is in flight, and works once the save has failed", async () => {
    const workout = seedWorkout();
    const pending = deferredSave();
    const saving = store().endWorkout("u1");

    await store().cancelWorkout();
    expect(toast.warn).toHaveBeenCalledTimes(1);
    expect(store().activeWorkout).toBe(workout);

    pending.reject(new Error("offline"));
    await saving;
    await store().cancelWorkout();
    expect(store().activeWorkout).toBeNull();
    expect(toast.warn).toHaveBeenCalledTimes(1);
  });
});
