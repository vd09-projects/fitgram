// TICKET-027: one save per session. TICKET-028: Finish completes on the phone,
// and the upload queue keeps, retries and reloads what has not reached the server.
//
// Store-only, no React. `saveWorkoutSession` is replaced at its module because
// the actions under test are the ones that call it; renderScreen's
// `workoutActions` would replace `endWorkout` itself and test nothing.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "firebase/auth";
import { saveWorkoutSession } from "../services/db/workoutSessions";
import show from "../utils/toastUtils";
import { drainPendingUploads, UPLOAD_GRACE_MS, useWorkoutStore } from "./useWorkoutStore";
import { useAuthStore } from "./authStore";
import { resetStores } from "../test/renderScreen";
import { buildExercise, buildWorkout } from "../test/fixtures";

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
const saved = { sessionId: "s", rollupApplied: true };

/** A save the test settles by hand, so it can act while the save is in flight. */
function deferredSave() {
  // Created now, not when the save is called: the save starts only after the
  // queue write, and a test may settle it before that.
  let resolve!: () => void;
  const settled = new Promise<typeof saved>((res) => (resolve = () => res(saved)));
  save.mockImplementationOnce(() => settled);
  return { resolve: () => resolve() };
}

/** Offline: `batch.commit()` neither resolves nor rejects (TICKET-028 step 0). */
const offlineSave = () => save.mockImplementationOnce(() => new Promise(() => {}));

// Timers are fake, so Date.now() is frozen: give each test its own start time,
// or sessions from different tests would share a session id.
let startTime = 1_000;
const seedWorkout = () => {
  const workout = buildWorkout([], {
    startTime: ++startTime,
    exercises: [buildExercise("Bench Press", { sets: [{ id: 1, fields: { Weight: 60, Reps: 5 } }] })],
  });
  useWorkoutStore.setState({ activeWorkout: workout });
  return workout;
};
const store = () => useWorkoutStore.getState();
const queue = () => store().pendingUploads;
const storedQueue = async () => JSON.parse((await AsyncStorage.getItem("pendingUploads")) ?? "[]");
const signIn = (uid: string) => useAuthStore.setState({ user: { uid } as User });

/** Finish while offline: wait out the grace period so Finish returns. */
async function finishOffline(uid: string) {
  offlineSave();
  const finishing = store().endWorkout(uid);
  await jest.advanceTimersByTimeAsync(UPLOAD_GRACE_MS);
  return finishing;
}

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

  it("offline, completes: the workout leaves the active slot and waits in the queue, on disk", async () => {
    const workout = seedWorkout();

    const result = await finishOffline("u1");

    expect(result).toEqual({ status: "queued" });
    expect(store().activeWorkout).toBeNull();
    expect(await AsyncStorage.getItem("activeWorkout")).toBeNull();
    expect(queue()).toHaveLength(1);
    expect((await storedQueue())[0].workout).toEqual(workout);
    expect(toast.info).toHaveBeenCalledWith("Saved on this phone", expect.any(String));
  });

  it("a successful upload removes the entry, in memory and on disk", async () => {
    seedWorkout();
    save.mockResolvedValueOnce(saved);

    expect(await store().endWorkout("u1")).toEqual({ status: "uploaded" });

    expect(queue()).toEqual([]);
    expect(await storedQueue()).toEqual([]);
  });

  it("a failed upload stays queued with the failure recorded, and the next drain retries it", async () => {
    seedWorkout();
    save.mockRejectedValueOnce(new Error("permission-denied"));

    expect(await store().endWorkout("u1")).toEqual({ status: "queued" });
    expect(store().activeWorkout).toBeNull();
    expect(queue()).toMatchObject([{ failedAttempts: 1, lastError: "permission-denied" }]);
    expect(toast.alert).toHaveBeenCalledWith("Saved on this phone, upload failed", expect.any(String));

    signIn("u1");
    save.mockResolvedValueOnce(saved);
    await drainPendingUploads();

    expect(save).toHaveBeenCalledTimes(2);
    expect(queue()).toEqual([]);
  });
});

describe("upload queue", () => {
  // TICKET-027's guard, now across Finish and the queue: a drain that reaches a
  // session Finish is still uploading joins it.
  it("a drain during Finish's upload of the same entry does not save it again", async () => {
    seedWorkout();
    signIn("u1");
    const pending = deferredSave();

    const finishing = store().endWorkout("u1");
    await jest.advanceTimersByTimeAsync(0);
    const draining = drainPendingUploads();
    pending.resolve();
    await Promise.all([finishing, draining]);

    expect(save).toHaveBeenCalledTimes(1);
    expect(queue()).toEqual([]);
  });

  // Pins the gate, not the argument: the drain attempts only entries whose uid
  // is signed in, so the uid passed to the save cannot differ from the signed-in
  // one. Breaking the gate turns this red; swapping the argument alone cannot.
  it("another user's entry is not attempted, and uploads once its own user signs in", async () => {
    seedWorkout();
    save.mockRejectedValueOnce(new Error("offline"));
    await store().endWorkout("u1");
    save.mockClear();
    save.mockResolvedValue(saved);

    signIn("u2");
    await drainPendingUploads();
    expect(save).not.toHaveBeenCalled();

    signIn("u1");
    await drainPendingUploads();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toBe("u1");
  });

  // Last in the file: loading installs the sign-in watch for the rest of the run.
  it("survives a restart: the queue is reloaded from disk and uploads on sign-in", async () => {
    seedWorkout();
    save.mockRejectedValueOnce(new Error("offline"));
    await store().endWorkout("u1");
    // App killed: memory is gone, disk is not.
    useWorkoutStore.setState({ activeWorkout: null, pendingUploads: [] });

    await store().loadWorkoutFromStorage();
    expect(queue()).toHaveLength(1);

    save.mockResolvedValueOnce(saved);
    signIn("u1");
    await jest.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    expect(queue()).toEqual([]);
  });
});
