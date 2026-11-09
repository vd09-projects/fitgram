// TICKET-027: one save per session. TICKET-028: Finish completes on the phone,
// and the upload queue keeps, retries and reloads what has not reached the server.
//
// Store-only, no React. `saveWorkoutSession` is replaced at its module because
// the actions under test are the ones that call it; renderScreen's
// `workoutActions` would replace `endWorkout` itself and test nothing.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "firebase/auth";
import { getAllExerciseStats, getChangedExerciseStats, saveWorkoutSession } from "../services/db/workoutSessions";
import { useExerciseHistoryStore } from "./useExerciseHistoryStore";
import type { ExerciseStatsDoc } from "../types/workoutSession";
import show from "../utils/toastUtils";
import { drainPendingUploads, useWorkoutStore } from "./useWorkoutStore";
import { useAuthStore } from "./authStore";
import { resetStores } from "../test/renderScreen";
import { buildExercise, buildWorkout, CATALOG_ROW } from "../test/fixtures";
import { useCatalogStore } from "./useCatalogStore";
import { loadCatalog } from "../utils/catalog";
import { buildSessionDocs } from "../utils/exerciseStats";
import { Effort } from "../types/workoutSession";
import { FREESTYLE_ID, freestylePlan } from "../constants/freestyle";
import { UPLOAD_GRACE_MS } from "../config/workout";
import { LOCAL_DATA_VERSION, LOCAL_DATA_VERSION_KEY } from "../config/storageKeys";

jest.mock("../services/db/workoutSessions", () => ({
  ...jest.requireActual("../services/db/workoutSessions"),
  saveWorkoutSession: jest.fn(),
  getAllExerciseStats: jest.fn(),
  getChangedExerciseStats: jest.fn(),
}));
jest.mock("../utils/toastUtils", () => ({
  __esModule: true,
  default: { alert: jest.fn(), success: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const save = saveWorkoutSession as jest.MockedFunction<typeof saveWorkoutSession>;
const toast = show as jest.Mocked<typeof show>;
const saved = { sessionId: "s", summaries: [] };

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
    exercises: [buildExercise("Bench Press", { sets: [{ id: 1, segments: [{ Weight: 60, Reps: 5 }] }] })],
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

describe("a Finish and the saved summaries (TICKET-076)", () => {
  const held = () => useExerciseHistoryStore.getState();
  const summary = (exerciseId: string) =>
    ({ exerciseId, exerciseName: exerciseId, lastPerformedAt: 1, fields: [], recentSessions: [], bestByReps: {}, volumeHistory: [] }) as ExerciseStatsDoc;
  beforeEach(() => useExerciseHistoryStore.setState({ uid: "u1", byId: {}, storedRead: true, lastOkAt: 123 }));

  it("the transaction's summaries reach the store, with no summary read at that moment", async () => {
    seedWorkout();
    save.mockResolvedValueOnce({ sessionId: "s", summaries: [summary("bench")] });

    await store().endWorkout("u1");

    expect(held().byId?.bench).toEqual(summary("bench"));
    expect(getAllExerciseStats).not.toHaveBeenCalled();
    expect(getChangedExerciseStats).not.toHaveBeenCalled();
  });

  it("a failed rollup stays queued and counted, and changes nothing in the store (TICKET-077)", async () => {
    seedWorkout();
    const before = held().byId;
    save.mockRejectedValueOnce(new Error("rollup failed"));

    await store().endWorkout("u1");

    expect(queue()).toHaveLength(1);
    expect(queue()[0]).toMatchObject({ failedAttempts: 1, lastError: "rollup failed" });
    expect((await storedQueue())[0].failedAttempts).toBe(1);
    expect(held().byId).toBe(before);
    expect(held().lastOkAt).toBe(123);
  });

  it("the retry's summary reaches the store and the entry leaves the queue (TICKET-077)", async () => {
    seedWorkout();
    signIn("u1");
    save.mockRejectedValueOnce(new Error("rollup failed"));
    await store().endWorkout("u1");

    save.mockResolvedValueOnce({ sessionId: "s", summaries: [summary("bench")] });
    await drainPendingUploads();

    expect(held().byId?.bench).toEqual(summary("bench"));
    expect(queue()).toHaveLength(0);
  });
});

describe("useWorkoutStore.endWorkout", () => {
  it("two calls without awaiting run one save and show one success toast, naming the workout", async () => {
    const workout = seedWorkout();
    const pending = deferredSave();

    const first = store().endWorkout("u1");
    const second = store().endWorkout("u1");
    pending.resolve();
    await Promise.all([first, second]);

    expect(save).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Saved", expect.stringMatching(new RegExp(`^${workout.name}( · |$)`)));
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

  // Tests that call `loadWorkoutFromStorage` stay last: loading installs the
  // sign-in watch for the rest of the run. Each restarts the SAME build, so
  // the data-version marker is current and the one-time clear does not run.
  const sameBuild = () => AsyncStorage.setItem(LOCAL_DATA_VERSION_KEY, LOCAL_DATA_VERSION);

  // TICKET-042 stage 2: a queue from before the version-id reset would write
  // old ids back into the wiped Firestore.
  it("drops an older build's queue and active workout once, before anything uploads", async () => {
    const workout = seedWorkout();
    save.mockRejectedValueOnce(new Error("offline"));
    await store().endWorkout("u1");
    await AsyncStorage.setItem("activeWorkout", JSON.stringify(workout));
    useWorkoutStore.setState({ activeWorkout: null, pendingUploads: [] });

    await store().loadWorkoutFromStorage();
    signIn("u1");
    await jest.advanceTimersByTimeAsync(0);

    expect(queue()).toEqual([]);
    expect(store().activeWorkout).toBeNull();
    expect(save).toHaveBeenCalledTimes(1); // the original offline attempt only
    expect(await AsyncStorage.getItem("pendingUploads")).toBeNull();
    expect(await AsyncStorage.getItem(LOCAL_DATA_VERSION_KEY)).toBe(LOCAL_DATA_VERSION);
  });

  it("a failed clear loads nothing: the older build's queue is not uploaded, and is retried next launch", async () => {
    seedWorkout();
    save.mockRejectedValueOnce(new Error("offline"));
    await store().endWorkout("u1");
    useWorkoutStore.setState({ activeWorkout: null, pendingUploads: [] });
    jest.spyOn(AsyncStorage, "multiRemove").mockRejectedValueOnce(new Error("disk full"));
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    await store().loadWorkoutFromStorage();
    signIn("u1");
    await jest.advanceTimersByTimeAsync(0);

    expect(save).toHaveBeenCalledTimes(1); // the original offline attempt only
    expect(queue()).toEqual([]);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("LOCAL CLEAR FAILED"), expect.any(Error));
    expect(await AsyncStorage.getItem(LOCAL_DATA_VERSION_KEY)).toBeNull();
  });

  it("survives a restart: the queue is reloaded from disk and uploads on sign-in", async () => {
    await sameBuild();
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

  // The crash window in `endWorkout`: queue written, slot not yet cleared. Left
  // active, the user would keep logging into a finished workout whose older copy
  // uploads, and the next Finish would overwrite it under the same session id.
  it("drops an active workout that is already queued (app died between queue write and slot clear)", async () => {
    await sameBuild();
    const workout = seedWorkout();
    save.mockRejectedValueOnce(new Error("offline"));
    await store().endWorkout("u1");
    // The crash: the slot clear never reached disk, and memory is gone.
    await AsyncStorage.setItem("activeWorkout", JSON.stringify(workout));
    useWorkoutStore.setState({ activeWorkout: null, pendingUploads: [] });

    await store().loadWorkoutFromStorage();

    expect(store().activeWorkout).toBeNull();
    expect(await AsyncStorage.getItem("activeWorkout")).toBeNull();
    expect(queue()).toHaveLength(1);
  });

  // Overwritten instead, the next queue write would replace every
  // finished-but-not-uploaded workout with an empty list.
  it("copies an unreadable queue aside intact instead of losing it", async () => {
    await sameBuild();
    await AsyncStorage.setItem("pendingUploads", "{ not json");

    await store().loadWorkoutFromStorage();

    const keys = await AsyncStorage.getAllKeys();
    const sidecar = keys.find((key) => key.startsWith("pendingUploads.corrupt."));
    expect(sidecar).toBeDefined();
    expect(await AsyncStorage.getItem(sidecar!)).toBe("{ not json");
  });
});

// TICKET-019: removing a mistyped set before Finish, and undoing that.
describe("removeSet and restoreSet", () => {
  const sets = (weights: number[]) => weights.map((Weight, i) => ({ id: i + 1, segments: [{ Weight, Reps: 8 }] }));
  const seedSets = (weights: number[]) => {
    const workout = buildWorkout([], { exercises: [buildExercise("Bench Press", { sets: sets(weights) })] });
    useWorkoutStore.setState({ activeWorkout: workout });
  };
  const benchSets = () => store().activeWorkout!.exercises[0].sets;
  const storedSets = async () =>
    JSON.parse((await AsyncStorage.getItem("activeWorkout")) ?? "null").exercises[0].sets;

  it("renumbers the rest, so the next set's id is its position", async () => {
    seedSets([60, 650, 62.5, 62.5]);
    await store().removeSet("bench-press", 2);
    expect(benchSets().map((s) => [s.id, s.segments[0].Weight])).toEqual([[1, 60], [2, 62.5], [3, 62.5]]);

    await store().addSetToExercise("bench-press", { id: 4, segments: [{ Weight: 60, Reps: 8 }] });
    expect(benchSets().map((s) => s.id)).toEqual([1, 2, 3, 4]);
  });

  it("commits the removal to storage at once, not pending the undo", async () => {
    seedSets([60, 650]);
    await store().removeSet("bench-press", 2);
    expect(await storedSets()).toEqual(sets([60]));
  });

  it("undo puts the set back at its position, renumbered, and stores it", async () => {
    seedSets([60, 650, 62.5]);
    const removed = await store().removeSet("bench-press", 2);
    expect(removed).toEqual({ exerciseId: "bench-press", set: sets([60, 650])[1], index: 1 });

    await store().restoreSet("bench-press", removed!);
    expect(benchSets()).toEqual(sets([60, 650, 62.5]));
    expect(await storedSets()).toEqual(sets([60, 650, 62.5]));
  });

  it("refuses to restore a set into an exercise it was not removed from", async () => {
    const workout = buildWorkout([], {
      exercises: [
        buildExercise("Bench Press", { sets: sets([60, 650]) }),
        buildExercise("Squat", { sets: sets([100]) }),
      ],
    });
    useWorkoutStore.setState({ activeWorkout: workout });
    const removed = await store().removeSet("bench-press", 2);

    await store().restoreSet("squat", removed!);
    expect(store().activeWorkout!.exercises[1].sets).toEqual(sets([100]));
    expect(benchSets()).toEqual(sets([60]));
  });

  // TICKET-034: ids are ordinals, so a mark keyed by id would land on the
  // wrong set after a removal. It lives on the set object and must move with it.
  it("a set's effort mark moves with it through remove and undo, and is stored", async () => {
    seedSets([60, 65, 70]);
    await store().setSetEffort("bench-press", 3, Effort.Hard);
    const removed = await store().removeSet("bench-press", 1);
    expect(benchSets().map((s) => [s.segments[0].Weight, s.effort ?? null])).toEqual([[65, null], [70, Effort.Hard]]);

    await store().restoreSet("bench-press", removed!);
    const marks = (list: { segments: { Weight?: unknown }[]; effort?: unknown }[]) =>
      list.map((s) => [s.segments[0].Weight, s.effort ?? null]);
    expect(marks(benchSets())).toEqual([[60, null], [65, null], [70, Effort.Hard]]);
    expect(marks(await storedSets())).toEqual([[60, null], [65, null], [70, Effort.Hard]]);
  });

  it("does not show a mark it failed to store", async () => {
    seedSets([60]);
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disk full"));

    await expect(store().setSetEffort("bench-press", 1, Effort.Hard)).rejects.toThrow("disk full");
    expect(benchSets()[0].effort ?? null).toBeNull();
  });
});

describe("updateSet", () => {
  const seed = () => {
    const workout = buildWorkout([], {
      exercises: [
        buildExercise("Bench Press", {
          sets: [
            { id: 1, segments: [{ Weight: "60", Reps: "8" }] },
            { id: 2, segments: [{ Weight: "56", Reps: "8", Band: "red" }], effort: Effort.Easy },
            { id: 3, segments: [{ Weight: "65", Reps: "8" }] },
          ],
        }),
        buildExercise("Squat"),
      ],
      currentExerciseIndex: 1,
    });
    useWorkoutStore.setState({ activeWorkout: workout, rest: null });
  };
  const benchSets = () => store().activeWorkout!.exercises[0].sets;

  // TICKET-040: before 040 this merged, so a cleared optional field kept its value.
  it("replaces the fields, keeps id, position and mark, and stores the edit", async () => {
    seed();
    await store().updateSet("bench-press", 2, [{ Weight: "65", Reps: "8" }]);

    expect(benchSets()).toEqual([
      { id: 1, segments: [{ Weight: "60", Reps: "8" }] },
      { id: 2, segments: [{ Weight: "65", Reps: "8" }], effort: Effort.Easy },
      { id: 3, segments: [{ Weight: "65", Reps: "8" }] },
    ]);
    const stored = JSON.parse((await AsyncStorage.getItem("activeWorkout")) ?? "null");
    expect(stored.exercises[0].sets[1]).toEqual({ id: 2, segments: [{ Weight: "65", Reps: "8" }], effort: Effort.Easy });
    // Editing is not logging: the session stays on the exercise being viewed.
    expect(store().activeWorkout!.currentExerciseIndex).toBe(1);
  });
});

describe("startWorkout", () => {
  // TICKET-042 stage 2: the session doc's `exerciseName` is the name as it read
  // when logged, so the snapshot is refreshed from the catalog at start.
  it("carries a catalog exercise's snapshot, refreshed from the catalog, into the session doc", async () => {
    const load = loadCatalog([CATALOG_ROW]);
    if (load.kind !== "ok") throw new Error("fixture catalog refused");
    useCatalogStore.setState({ catalog: { version: "h1", movements: load.movements, index: load.index } });
    const fields = CATALOG_ROW.versions[0].fields;

    await store().startWorkout({
      id: "back",
      name: "Back",
      exercises: [{ id: "row__barbell", name: "", nameSnapshot: "Barbell Row (old name)", fields }],
    });
    const logged = store().activeWorkout!.exercises[0];
    expect(logged).toMatchObject({ name: "", nameSnapshot: "Row" });

    const withSet = { ...store().activeWorkout!, exercises: [{ ...logged, sets: [{ id: 1, segments: [{ Weight: 60, Reps: 8 }] }] }] };
    expect(buildSessionDocs(withSet, Date.now()).exerciseSessions[0].exerciseName).toBe("Row");
  });

  it("refuses while a workout is in progress and leaves it untouched", async () => {
    const running = seedWorkout();
    await AsyncStorage.setItem("activeWorkout", JSON.stringify(running));

    const result = await store().startWorkout({
      id: "other",
      name: "Other",
      exercises: [buildExercise("Squat")],
    });

    expect(result.status).toBe("refused");
    expect(store().activeWorkout).toBe(running);
    expect(JSON.parse((await AsyncStorage.getItem("activeWorkout")) ?? "null")).toEqual(running);
  });
});

// TICKET-067: no plan doc exists for a Freestyle; History, the tiles and
// "last time" read the session's workoutId and workoutName.
describe("Freestyle", () => {
  it("starts empty, takes an added exercise, and saves as workoutId freestyle, workoutName Freestyle", async () => {
    expect(await store().startWorkout(freestylePlan())).toEqual({ status: "started" });
    expect(store().activeWorkout).toMatchObject({ id: FREESTYLE_ID, exercises: [], currentExerciseIndex: null });

    const curl = { id: "wrist-curl-cable", name: "", nameSnapshot: "Wrist Curl · Cable", fields: [{ name: "Reps", role: "reps" as const }] };
    await store().addExercise(curl);
    await store().addSetToExercise(curl.id, { id: 1, segments: [{ Reps: 15 }] });
    save.mockResolvedValueOnce(saved);
    expect(await store().endWorkout("u1")).toEqual({ status: "uploaded" });

    const [, workout, endedAt] = save.mock.calls[0];
    const { session, exerciseSessions } = buildSessionDocs(workout, endedAt);
    // Literals, not the constants: this is the stored shape History reads, so
    // renaming a constant must fail here.
    expect(session).toMatchObject({ workoutId: "freestyle", workoutName: "Freestyle", exerciseIds: [curl.id] });
    expect(session.sessionId).toMatch(/^freestyle_\d+$/);
    expect(exerciseSessions[0]).toMatchObject({ workoutId: "freestyle", workoutName: "Freestyle" });
  });
});

// TICKET-021. The logger shows a rest on whichever exercise id it names, so a
// rest left over from a finished or discarded workout would reappear on the
// same exercise in the next one.
describe("rest timer", () => {
  it("is cleared by Finish and by Discard", async () => {
    seedWorkout();
    store().startRest("bench-press", 90_000, 1);
    await finishOffline("u1");
    expect(store().rest).toBeNull();

    seedWorkout();
    store().startRest("bench-press", 90_000, 1);
    await store().cancelWorkout();
    expect(store().rest).toBeNull();
  });
});

// TICKET-064. Every action writes through `saveActiveWorkout` or the key; these
// are the writes no other test reads back. The key is the literal on purpose:
// renaming it would strand a workout stored by an older build.
describe("stored copy", () => {
  const stored = async () => JSON.parse((await AsyncStorage.getItem("activeWorkout")) ?? "null");

  it("start, log a set, mark it and page each reach the phone", async () => {
    await store().startWorkout({ id: "push", name: "Push", exercises: [buildExercise("Bench Press"), buildExercise("Squat")] });
    expect(await stored()).toEqual(store().activeWorkout);

    await store().addSetToExercise("bench-press", { id: 1, segments: [{ Weight: 60, Reps: 8 }] });
    expect((await stored()).exercises[0].sets).toEqual([{ id: 1, segments: [{ Weight: 60, Reps: 8 }] }]);

    await store().setSetEffort("bench-press", 1, Effort.Hard);
    expect((await stored()).exercises[0].sets[0].effort).toBe(Effort.Hard);

    await store().setCurrentExerciseIndex(1);
    expect((await stored()).currentExerciseIndex).toBe(1);
  });

  it("Discard removes it", async () => {
    await store().startWorkout({ id: "push", name: "Push", exercises: [buildExercise("Bench Press")] });
    await store().cancelWorkout();
    expect(await AsyncStorage.getItem("activeWorkout")).toBeNull();
  });
});

// TICKET-047. The slot keeps its place, the plan's exercise is kept for "Back
// to plan", and the two refusals live here, not only in the menu and picker.
describe("swapExercise", () => {
  const cable = { id: "lat-pulldown-cable", name: "", nameSnapshot: "Lat Pulldown · Cable", fields: [{ name: "Reps", role: "reps" as const }] };
  const seedSwappable = () => {
    const workout = buildWorkout(["Lat Pulldown", "Seated Row"], { startTime: ++startTime });
    useWorkoutStore.setState({ activeWorkout: workout });
    return workout;
  };
  const stored = async () => JSON.parse((await AsyncStorage.getItem("activeWorkout")) ?? "null");

  it("replaces the slot in place with the new exercise's fields, keeps the planned one, and stores it", async () => {
    seedSwappable();
    store().startRest("lat-pulldown", 90_000, 1);

    expect(await store().swapExercise("lat-pulldown", cable)).toEqual({ status: "swapped" });

    const exercises = store().activeWorkout!.exercises;
    expect(exercises.map((e) => e.id)).toEqual(["lat-pulldown-cable", "seated-row"]);
    expect(exercises[0]).toMatchObject({ fields: cable.fields, sets: [], planned: { id: "lat-pulldown", name: "Lat Pulldown" } });
    expect(await stored()).toEqual(store().activeWorkout);
    // A rest on the swapped slot would otherwise hide under the old id.
    expect(store().rest).toBeNull();

    // D1: `planned` is live state only; the session doc carries no trace of it.
    const logged = { ...store().activeWorkout!, exercises: [{ ...exercises[0], sets: [{ id: 1, segments: [{ Reps: 10 }] }] }] };
    expect(buildSessionDocs(logged, Date.now()).exerciseSessions[0]).not.toHaveProperty("planned");
  });

  it("is refused once the slot has a set, and changes nothing", async () => {
    const workout = buildWorkout([], {
      startTime: ++startTime,
      exercises: [buildExercise("Lat Pulldown", { sets: [{ id: 1, segments: [{ Weight: 55, Reps: 10 }] }] })],
    });
    useWorkoutStore.setState({ activeWorkout: workout });

    const result = await store().swapExercise("lat-pulldown", cable);

    expect(result.status).toBe("refused");
    expect(store().activeWorkout).toBe(workout);
    expect(await stored()).toBeNull();
  });

  it("is refused for an exercise already in today's workout (one session doc per id)", async () => {
    const workout = seedSwappable();
    const row = workout.exercises[1];

    const result = await store().swapExercise("lat-pulldown", { id: row.id, name: row.name, fields: row.fields });

    expect(result.status).toBe("refused");
    expect(store().activeWorkout).toBe(workout);
  });

  it("swapping again keeps the plan's exercise; swapping to it is back to plan and clears it", async () => {
    seedSwappable();
    await store().swapExercise("lat-pulldown", cable);
    await store().swapExercise("lat-pulldown-cable", { id: "pull-up", name: "Pull-Up", fields: cable.fields });
    expect(store().activeWorkout!.exercises[0]).toMatchObject({ id: "pull-up", planned: { id: "lat-pulldown" } });

    await store().swapExercise("pull-up", store().activeWorkout!.exercises[0].planned!);

    const slot = store().activeWorkout!.exercises[0];
    expect(slot).toMatchObject({ id: "lat-pulldown", name: "Lat Pulldown" });
    expect(slot.planned).toBeUndefined();
    expect((await stored()).exercises[0].planned).toBeUndefined();
  });
});

// TICKET-056: add an exercise at the end, for this workout only.
describe("addExercise", () => {
  const curl = { id: "wrist-curl-cable", name: "", nameSnapshot: "Wrist Curl · Cable", fields: [{ name: "Reps", role: "reps" as const }] };
  const seedAddable = () => {
    const workout = { ...buildWorkout(["Lat Pulldown", "Seated Row"], { startTime: ++startTime }), currentExerciseIndex: 0 };
    useWorkoutStore.setState({ activeWorkout: workout });
    return workout;
  };
  const stored = async () => JSON.parse((await AsyncStorage.getItem("activeWorkout")) ?? "null");

  it("appends the exercise marked added, moves to it from anywhere, and stores it; the session doc has no mark", async () => {
    seedAddable();

    expect(await store().addExercise(curl)).toEqual({ status: "added" });

    const workout = store().activeWorkout!;
    expect(workout.exercises.map((e) => e.id)).toEqual(["lat-pulldown", "seated-row", "wrist-curl-cable"]);
    expect(workout.exercises[2]).toMatchObject({ fields: curl.fields, sets: [], added: true });
    expect(workout.currentExerciseIndex).toBe(2);
    expect(await stored()).toEqual(workout);

    const logged = { ...workout, exercises: [{ ...workout.exercises[2], sets: [{ id: 1, segments: [{ Reps: 15 }] }] }] };
    expect(buildSessionDocs(logged, Date.now()).exerciseSessions[0]).not.toHaveProperty("added");
  });

  it("is refused for an exercise already in today's workout (one session doc per id), and changes nothing", async () => {
    const workout = seedAddable();
    const row = workout.exercises[1];

    const result = await store().addExercise({ id: row.id, name: row.name, fields: row.fields });

    expect(result.status).toBe("refused");
    expect(store().activeWorkout).toBe(workout);
    expect(await stored()).toBeNull();
  });

  it("swapping an added slot keeps it added and records no planned exercise", async () => {
    seedAddable();
    await store().addExercise(curl);

    await store().swapExercise("wrist-curl-cable", { id: "pull-up", name: "Pull-Up", fields: curl.fields });

    const slot = store().activeWorkout!.exercises[2];
    expect(slot).toMatchObject({ id: "pull-up", added: true });
    expect(slot.planned).toBeUndefined();
  });
});

// TICKET-069: take an unlogged exercise out of today's list, with an Undo.
describe("removeExercise and restoreExercise", () => {
  const seedCardioAndBack = () => {
    const workout = {
      ...buildWorkout([], {
        startTime: ++startTime,
        exercises: [
          buildExercise("Treadmill Walk"),
          buildExercise("Stationary Bike"),
          buildExercise("Lat Pulldown", { sets: [{ id: 1, segments: [{ Weight: 55, Reps: 10 }] }] }),
        ],
      }),
      currentExerciseIndex: 0,
    };
    useWorkoutStore.setState({ activeWorkout: workout });
    return workout;
  };
  const stored = async () => JSON.parse((await AsyncStorage.getItem("activeWorkout")) ?? "null");
  const ids = () => store().activeWorkout!.exercises.map((e) => e.id);

  it("drops a 0-set slot, shows the next one, stores it, ends its rest; Finish would save the same docs", async () => {
    const before = seedCardioAndBack();
    store().startRest("treadmill-walk", 90_000, 1);

    const result = await store().removeExercise("treadmill-walk");

    expect(result).toEqual({ status: "removed", removed: { slot: before.exercises[0], index: 0 } });
    expect(ids()).toEqual(["stationary-bike", "lat-pulldown"]);
    expect(store().activeWorkout!.currentExerciseIndex).toBe(0);
    expect(await stored()).toEqual(store().activeWorkout);
    expect(store().rest).toBeNull();
    expect(buildSessionDocs(store().activeWorkout!, 5_000).exerciseSessions).toEqual(
      buildSessionDocs(before, 5_000).exerciseSessions
    );
  });

  it("is refused once the slot has a set, and changes nothing", async () => {
    const workout = seedCardioAndBack();

    const result = await store().removeExercise("lat-pulldown");

    expect(result).toEqual({ status: "refused", reason: "Only before set 1. Delete the logged sets to remove." });
    expect(store().activeWorkout).toBe(workout);
    expect(await stored()).toBeNull();
  });

  it("Undo puts a swapped slot back where it was, Back to plan kept, and shows it", async () => {
    seedCardioAndBack();
    const incline = { id: "treadmill-walk-incline", name: "", nameSnapshot: "Treadmill Walk · Incline", fields: [{ name: "Time", role: "time" as const, unit: "min" as const }] };
    await store().swapExercise("treadmill-walk", incline);
    const result = await store().removeExercise("treadmill-walk-incline");
    if (result.status !== "removed") throw new Error("expected a removal");
    await store().setCurrentExerciseIndex(1);

    expect(await store().restoreExercise(result.removed)).toEqual({ status: "restored" });

    expect(ids()).toEqual(["treadmill-walk-incline", "stationary-bike", "lat-pulldown"]);
    expect(store().activeWorkout!.exercises[0].planned).toMatchObject({ id: "treadmill-walk" });
    expect(store().activeWorkout!.currentExerciseIndex).toBe(0);
    expect(await stored()).toEqual(store().activeWorkout);
  });

  it("Undo is refused once the same exercise was added back (one id per session)", async () => {
    const workout = seedCardioAndBack();
    const result = await store().removeExercise("treadmill-walk");
    if (result.status !== "removed") throw new Error("expected a removal");
    const slot = workout.exercises[0];
    await store().addExercise({ id: slot.id, name: slot.name, fields: slot.fields });

    expect((await store().restoreExercise(result.removed)).status).toBe("refused");
    expect(ids()).toEqual(["stationary-bike", "lat-pulldown", "treadmill-walk"]);
  });
});
