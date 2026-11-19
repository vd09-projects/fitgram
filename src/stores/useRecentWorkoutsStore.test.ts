import AsyncStorage from "@react-native-async-storage/async-storage";
import { waitFor } from "@testing-library/react-native";
import { exerciseOlderOf, exercisePaging, olderOf, useRecentWorkoutsStore, workoutsRunFor } from "./useRecentWorkoutsStore";
import { usePlansStore } from "./usePlansStore";
import {
  getChangedSessions,
  getLastWorkoutOfPlan,
  getNewestSessionStamp,
  getOlderWorkoutsPage,
  getSessionsOfExercisePage,
  getWorkoutById,
  getWorkoutWindowFromServer,
} from "../services/db/workoutSessions";
import { getAllWorkoutPlans } from "../services/db/userDB";
import type { WorkoutSessionDoc } from "../types/workoutSession";
import { serializeStoredWorkouts } from "../utils/workoutWindow";
import { WORKOUTS_STORAGE_KEY } from "../config/storageKeys";
import { WORKOUTS_CHECK_WAIT_MS, WORKOUTS_OLDER_RETRY_GAP_MS, WORKOUTS_ON_PHONE_MIN } from "../config/sync";
import { serveRecentWorkouts } from "../test/recentWorkouts";
import { EXERCISE_LOG_PAGE_SIZE, OLDER_WORKOUTS_PAGE_SIZE } from "../config/display";

jest.mock("../services/firebase/firebase", () => ({ db: {} }));
jest.mock("../services/db/workoutSessions", () => ({
  getNewestSessionStamp: jest.fn(),
  getWorkoutWindowFromServer: jest.fn(),
  getLastWorkoutOfPlan: jest.fn(),
  getChangedSessions: jest.fn(),
  getOlderWorkoutsPage: jest.fn(),
  getSessionsOfExercisePage: jest.fn(),
  getWorkoutById: jest.fn(),
}));
jest.mock("../services/db/userDB", () => ({
  getAllWorkoutPlans: jest.fn(),
  getChangedPlans: jest.fn(async () => []),
  getPlanFromServer: jest.fn(),
}));

const UID = "u1";
const DAY = 86_400_000;
const NOW = Date.now();
const session = (id: string, workoutId: string, startedAt: number, extra: Partial<WorkoutSessionDoc> = {}) =>
  ({ sessionId: id, workoutId, workoutName: workoutId, startedAt, endedAt: startedAt + 60, exerciseIds: [], lifts: [], ...extra }) as WorkoutSessionDoc;
const plan = (id: string) => ({ id, name: id, exercises: [] });
const looked = () => jest.mocked(getLastWorkoutOfPlan).mock.calls.map(([, planId]) => planId).sort();
const sessionIds = () => useRecentWorkoutsStore.getState().workoutWindow?.sessions.map((s) => s.sessionId);
const floor = () => useRecentWorkoutsStore.getState().workoutWindow?.lastByPlan;
const savedKeys = async () => (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(WORKOUTS_STORAGE_KEY)).sort();

beforeEach(async () => {
  jest.clearAllMocks();
  serveRecentWorkouts([]);
  jest.mocked(getNewestSessionStamp).mockResolvedValue({ seconds: 10, nanoseconds: 0 });
  usePlansStore.getState().clear();
  useRecentWorkoutsStore.getState().clear();
  await AsyncStorage.clear();
});

it("first launch: the window loads without the plans; the plans' lookups follow when they arrive, with no focus", async () => {
  jest.mocked(getAllWorkoutPlans).mockReturnValue(new Promise(() => {})); // plans still loading
  serveRecentWorkouts([session("s1", "push", NOW - DAY)]);
  await useRecentWorkoutsStore.getState().open(UID);
  usePlansStore.getState().open(UID);
  expect(getWorkoutWindowFromServer).toHaveBeenCalledTimes(1);
  expect(sessionIds()).toEqual(["s1"]);
  expect(looked()).toEqual([]);

  // The plans' answer lands; nothing else triggers the workouts store.
  usePlansStore.setState({ plans: [plan("push"), plan("legs")] });
  await waitFor(() => expect(floor()).toHaveProperty("legs", null));
  expect(looked()).toEqual(["legs"]); // push has a workout in the window: no lookup
});

it("plans that arrive while the first check runs are looked up when it ends (it joined, and did not have them)", async () => {
  let answer: () => void = () => {};
  jest.mocked(getWorkoutWindowFromServer).mockReturnValue(new Promise((resolve) => (answer = () => resolve({ newest: [], rest: null }))));
  void useRecentWorkoutsStore.getState().open(UID);
  await waitFor(() => expect(getWorkoutWindowFromServer).toHaveBeenCalledTimes(1));
  usePlansStore.setState({ uid: UID, plans: [plan("legs")], storedRead: true }); // the plans land mid-check
  answer();
  await waitFor(() => expect(floor()).toHaveProperty("legs", null));
  expect(getWorkoutWindowFromServer).toHaveBeenCalledTimes(1);
  expect(looked()).toEqual(["legs"]);
});

it("a plan idle for longer than the window gets its date from a lookup, and a plan never done is null, not missing", async () => {
  usePlansStore.setState({ uid: UID, plans: [plan("push"), plan("legs"), plan("arms")], storedRead: true });
  const busy = Array.from({ length: WORKOUTS_ON_PHONE_MIN + 5 }, (_, i) => session(`p${i}`, "push", NOW - (i + 1) * DAY));
  serveRecentWorkouts([...busy, session("old-legs", "legs", NOW - 900 * DAY)]);
  await useRecentWorkoutsStore.getState().open(UID);
  await waitFor(() => expect(floor()?.legs?.sessionId).toBe("old-legs"));
  expect(floor()?.arms).toBeNull();
  expect(sessionIds()).not.toContain("old-legs"); // the floor is not a month
  expect(looked()).toEqual(["arms", "legs"]);
});

it("a restart shows the saved copy with 0 reads, then checks for changes only; no lookup for a looked-up plan", async () => {
  usePlansStore.setState({ uid: UID, plans: [plan("push"), plan("legs")], storedRead: true });
  await AsyncStorage.multiSet(
    serializeStoredWorkouts(UID, {
      sessions: [session("s1", "push", 100)],
      windowStart: null,
      lastByPlan: { push: session("s1", "push", 100), legs: null },
      lastSeen: { seconds: 5, nanoseconds: 0 },
      lastFullAt: 0,
    })
  );
  await useRecentWorkoutsStore.getState().open(UID);
  expect(getNewestSessionStamp).not.toHaveBeenCalled();
  expect(getWorkoutWindowFromServer).not.toHaveBeenCalled();
  expect(getLastWorkoutOfPlan).not.toHaveBeenCalled();
  expect(getChangedSessions).toHaveBeenCalledTimes(1);
  expect(sessionIds()).toEqual(["s1"]);

  useRecentWorkoutsStore.getState().clear();
  await AsyncStorage.clear();
  await useRecentWorkoutsStore.getState().open(UID);
  expect(getNewestSessionStamp).toHaveBeenCalled();
});

it("a full reload replaces what is held: a session deleted on the server goes", async () => {
  usePlansStore.setState({ uid: UID, plans: [plan("push")], storedRead: true });
  serveRecentWorkouts([session("kept", "push", 200), session("wiped", "push", 100)]);
  await useRecentWorkoutsStore.getState().open(UID);
  await waitFor(() => expect(sessionIds()).toHaveLength(2));

  serveRecentWorkouts([session("kept", "push", 200)]);
  await useRecentWorkoutsStore.getState().check({ force: true, full: true });
  expect(sessionIds()).toEqual(["kept"]);
});

it("own Finish: held at once with no read and the plan's floor entry; the next check brings the stamped copy once, in its place", async () => {
  usePlansStore.setState({ uid: UID, plans: [plan("push")], storedRead: true });
  await useRecentWorkoutsStore.getState().open(UID);
  await waitFor(() => expect(useRecentWorkoutsStore.getState().workoutWindow).not.toBeNull());
  jest.clearAllMocks();

  useRecentWorkoutsStore.getState().applyFinished(UID, session("mine", "push", 500));
  expect(sessionIds()).toEqual(["mine"]);
  expect(floor()?.push?.sessionId).toBe("mine");
  expect(getWorkoutWindowFromServer).not.toHaveBeenCalled();
  expect(getLastWorkoutOfPlan).not.toHaveBeenCalled();
  expect(getChangedSessions).not.toHaveBeenCalled();

  const stamped = session("mine", "push", 500, { updatedAt: { seconds: 11, nanoseconds: 0 } });
  jest.mocked(getChangedSessions).mockResolvedValue([stamped]);
  await useRecentWorkoutsStore.getState().check({ force: true });
  expect(getChangedSessions).toHaveBeenCalledWith(UID, { seconds: 10, nanoseconds: 0 });
  expect(useRecentWorkoutsStore.getState().workoutWindow?.sessions).toEqual([stamped]);
  expect(floor()?.push).toEqual(stamped);
  expect(useRecentWorkoutsStore.getState().lastSeen).toEqual({ seconds: 11, nanoseconds: 0 });
  expect(getNewestSessionStamp).not.toHaveBeenCalled();
});

it("a saved note is shown in the window and the plan's floor entry with no read, and removing it leaves no key behind", async () => {
  serveRecentWorkouts([session("a", "push", 500, { updatedAt: { seconds: 5, nanoseconds: 0 } })]);
  usePlansStore.setState({ uid: UID, plans: [plan("push")], storedRead: true });
  await useRecentWorkoutsStore.getState().open(UID);
  await waitFor(() => expect(sessionIds()).toEqual(["a"]));
  jest.clearAllMocks();

  useRecentWorkoutsStore.getState().applyNote(UID, "a", "Slept badly.");
  expect(useRecentWorkoutsStore.getState().workoutWindow?.sessions[0].note).toBe("Slept badly.");
  expect(floor()?.push?.note).toBe("Slept badly.");

  useRecentWorkoutsStore.getState().applyNote(UID, "a", null);
  expect(useRecentWorkoutsStore.getState().workoutWindow?.sessions[0]).not.toHaveProperty("note");
  expect(getChangedSessions).not.toHaveBeenCalled();
  expect(getWorkoutWindowFromServer).not.toHaveBeenCalled();
});

// TICKET-083: a workout opened by id that the phone does not hold.
describe("a workout read by id", () => {
  const opened = async () => {
    await useRecentWorkoutsStore.getState().open(UID);
    await waitFor(() => expect(useRecentWorkoutsStore.getState().uid).toBe(UID));
  };
  const read = (id: string) => useRecentWorkoutsStore.getState().fetchedSessions[id];

  it("reads it once and keeps the answer, a missing workout as ready with none, and reads nothing signed out", async () => {
    await opened();
    jest.mocked(getWorkoutById).mockResolvedValueOnce(session("a", "push", 500));
    await useRecentWorkoutsStore.getState().loadSession("a");
    await useRecentWorkoutsStore.getState().loadSession("a");
    expect(getWorkoutById).toHaveBeenCalledTimes(1);
    expect(getWorkoutById).toHaveBeenCalledWith(UID, "a");
    expect(read("a")).toMatchObject({ status: "ready", session: { sessionId: "a" } });

    jest.mocked(getWorkoutById).mockResolvedValueOnce(null);
    await useRecentWorkoutsStore.getState().loadSession("gone");
    expect(read("gone")).toEqual({ status: "ready", session: null });

    useRecentWorkoutsStore.getState().clear();
    jest.mocked(getWorkoutById).mockClear();
    await useRecentWorkoutsStore.getState().loadSession("a");
    expect(getWorkoutById).not.toHaveBeenCalled();
  });

  it("says offline for a refused read, holds the next ask off for the gap, then asks again", async () => {
    await opened();
    jest.mocked(getWorkoutById).mockRejectedValue(Object.assign(new Error("client is offline"), { code: "unavailable" }));
    await useRecentWorkoutsStore.getState().loadSession("a");
    expect(read("a")).toEqual({ status: "offline", error: "client is offline" });

    await useRecentWorkoutsStore.getState().loadSession("a");
    expect(getWorkoutById).toHaveBeenCalledTimes(1);

    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now + WORKOUTS_OLDER_RETRY_GAP_MS + 1);
    jest.mocked(getWorkoutById).mockResolvedValue(session("a", "push", 500));
    await useRecentWorkoutsStore.getState().loadSession("a");
    expect(getWorkoutById).toHaveBeenCalledTimes(2);
    expect(read("a")).toMatchObject({ status: "ready" });
    jest.spyOn(Date, "now").mockRestore();
  });

  it("a sign-out while the read runs drops its answer, so the next user does not receive it", async () => {
    await opened();
    let answer!: (value: WorkoutSessionDoc) => void;
    jest.mocked(getWorkoutById).mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const asking = useRecentWorkoutsStore.getState().loadSession("a");
    useRecentWorkoutsStore.getState().clear();
    answer(session("a", "push", 500));
    await asking;
    expect(read("a")).toBeUndefined();
  });
});

it("a Finish on another phone appears on the next check", async () => {
  usePlansStore.setState({ uid: UID, plans: [plan("push")], storedRead: true });
  serveRecentWorkouts([session("a", "push", 100)]);
  await useRecentWorkoutsStore.getState().open(UID);
  await waitFor(() => expect(sessionIds()).toEqual(["a"]));

  jest.mocked(getChangedSessions).mockResolvedValue([session("b", "push", 900, { updatedAt: { seconds: 12, nanoseconds: 0 } })]);
  await useRecentWorkoutsStore.getState().check({ force: true });
  expect(sessionIds()).toEqual(["b", "a"]);
  expect(floor()?.push?.sessionId).toBe("b");
});

it("a plan not looked up yet is looked up inside the check skip; a looked-up one is skipped", () => {
  const window = { sessions: [], windowStart: null, lastByPlan: { push: null } };
  expect(workoutsRunFor({ workoutWindow: window, lastSeen: null }, ["push"], true, false)).toBeNull();
  expect(workoutsRunFor({ workoutWindow: window, lastSeen: null }, ["push", "legs"], true, false)).toMatchObject({
    kind: "change",
    lookUp: ["legs"],
  });
  // Nothing held: a full reload, with or without the plans.
  expect(workoutsRunFor({ workoutWindow: null, lastSeen: null }, null, true, false)).toMatchObject({ kind: "full" });
});

it("offline after a restart: the saved copy is shown and a failed check keeps it; sign-out removes every key", async () => {
  usePlansStore.setState({ uid: UID, plans: [plan("push")], storedRead: true });
  serveRecentWorkouts([session("s1", "push", NOW - 40 * DAY), session("s2", "push", NOW - 2 * DAY)]);
  await useRecentWorkoutsStore.getState().open(UID);
  await waitFor(async () => expect((await savedKeys()).length).toBeGreaterThan(1));

  // Restart: memory gone, disk kept, every read fails.
  useRecentWorkoutsStore.setState({ uid: null, workoutWindow: null, storedRead: false, lastOkAt: null });
  jest.mocked(getChangedSessions).mockRejectedValue(new Error("offline"));
  await useRecentWorkoutsStore.getState().open(UID);
  expect(useRecentWorkoutsStore.getState().lastResult).toBe("failed");
  expect(sessionIds()).toEqual(["s2", "s1"]);
  expect(floor()?.push?.sessionId).toBe("s2");

  useRecentWorkoutsStore.getState().clear();
  await waitFor(async () => expect(await savedKeys()).toEqual([]));
  expect(useRecentWorkoutsStore.getState().workoutWindow).toBeNull();
});

it("a month that leaves the window takes its shard off disk, and the plan keeps its floor entry", async () => {
  usePlansStore.setState({ uid: UID, plans: [plan("push")], storedRead: true });
  const inMonth = (month: number, count: number, id: string) =>
    Array.from({ length: count }, (_, i) => session(`${id}${i}`, "push", new Date(2026, month, 3 + (i % 24), 10).getTime() + i));
  // November holds all but one of the minimum, so the first load takes October too, whole.
  serveRecentWorkouts([...inMonth(9, 5, "oct"), ...inMonth(10, WORKOUTS_ON_PHONE_MIN - 1, "nov")]);
  await useRecentWorkoutsStore.getState().open(UID);
  await waitFor(() => expect(sessionIds()?.some((id) => id.startsWith("oct"))).toBe(true));
  await waitFor(async () => expect((await savedKeys()).some((key) => key.endsWith("2026-10"))).toBe(true));

  // A Finish in December: December and November reach the minimum without October, which leaves whole.
  useRecentWorkoutsStore.getState().applyFinished(UID, session("dec", "push", new Date(2026, 11, 2, 10).getTime()));
  expect(sessionIds()?.some((id) => id.startsWith("oct"))).toBe(false);
  expect(floor()?.push?.sessionId).toBe("dec");
  await waitFor(async () => expect((await savedKeys()).some((key) => key.endsWith("2026-10"))).toBe(false));
});

// The rules of a read the user asks for (join, wait, retry gap, sign-out) are tested once, in onDemandReads.test.ts.
// What is tested here is what the store adds: where a page starts, per-filter lists, and stale lists.
describe("workouts older than the window, by page", () => {
  const older = (planId: string | null = null) => useRecentWorkoutsStore.getState().olderWorkouts[planId ?? "*"];
  const WINDOW_START = new Date(2026, 9, 1).getTime();
  const at = (month: number, day: number) => new Date(2026, month - 1, day, 10).getTime();
  const oldWorkout = (id: string, startedAt: number, planId = "push") => session(id, planId, startedAt);

  /** The window starts on 1 October, so everything before is older. */
  async function openWithWindowFromOctober(windowStart: number | null = WINDOW_START) {
    usePlansStore.setState({ uid: UID, plans: [plan("push")], storedRead: true });
    await AsyncStorage.multiSet(
      serializeStoredWorkouts(UID, {
        sessions: [session("oct", "push", at(10, 5))],
        windowStart,
        lastByPlan: { push: session("oct", "push", at(10, 5)) },
        lastSeen: { seconds: 5, nanoseconds: 0 },
        lastFullAt: 0,
      })
    );
    await useRecentWorkoutsStore.getState().open(UID);
    jest.mocked(getOlderWorkoutsPage).mockReset();
  }

  it("the first page starts at the window's start, the next before the oldest loaded; pages add up, in memory only", async () => {
    await openWithWindowFromOctober();
    jest.mocked(getOlderWorkoutsPage)
      .mockResolvedValueOnce({ sessions: [oldWorkout("a", at(9, 20)), oldWorkout("b", at(9, 10))], docsRead: 2, reachedStart: false })
      .mockResolvedValueOnce({ sessions: [oldWorkout("c", at(8, 30))], docsRead: 1, reachedStart: false });
    const before = useRecentWorkoutsStore.getState().billedReads;

    await useRecentWorkoutsStore.getState().loadOlder(null);
    expect(getOlderWorkoutsPage).toHaveBeenLastCalledWith(UID, WINDOW_START, null, OLDER_WORKOUTS_PAGE_SIZE);
    await useRecentWorkoutsStore.getState().loadOlder(null);
    expect(getOlderWorkoutsPage).toHaveBeenLastCalledWith(UID, at(9, 10), null, OLDER_WORKOUTS_PAGE_SIZE);

    expect(older()?.sessions.map((s) => s.sessionId)).toEqual(["a", "b", "c"]);
    expect(useRecentWorkoutsStore.getState().billedReads - before).toBe(3);
    expect(sessionIds()).toEqual(["oct"]); // not in the window, so not saved
    useRecentWorkoutsStore.getState().clear();
    expect(useRecentWorkoutsStore.getState().olderWorkouts).toEqual({});
  });

  it("a plan filter pages on its own: its own cursor, and the All list is left as it was", async () => {
    await openWithWindowFromOctober();
    jest.mocked(getOlderWorkoutsPage).mockResolvedValue({ sessions: [oldWorkout("p", at(9, 3))], docsRead: 1, reachedStart: false });
    await useRecentWorkoutsStore.getState().loadOlder("push");
    expect(getOlderWorkoutsPage).toHaveBeenLastCalledWith(UID, WINDOW_START, "push", OLDER_WORKOUTS_PAGE_SIZE);
    expect(older("push")?.sessions).toHaveLength(1);
    expect(older()).toBeUndefined();
    await useRecentWorkoutsStore.getState().loadOlder(null);
    expect(getOlderWorkoutsPage).toHaveBeenLastCalledWith(UID, WINDOW_START, null, OLDER_WORKOUTS_PAGE_SIZE);
  });

  it("stops reading once the start is reached, and never reads when the window holds the whole history", async () => {
    await openWithWindowFromOctober();
    jest.mocked(getOlderWorkoutsPage).mockResolvedValue({ sessions: [], docsRead: 0, reachedStart: true });
    await useRecentWorkoutsStore.getState().loadOlder(null);
    await useRecentWorkoutsStore.getState().loadOlder(null);
    expect(getOlderWorkoutsPage).toHaveBeenCalledTimes(1);
    expect(older()?.reachedStart).toBe(true);

    useRecentWorkoutsStore.getState().clear();
    await openWithWindowFromOctober(null);
    await useRecentWorkoutsStore.getState().loadOlder(null);
    expect(getOlderWorkoutsPage).not.toHaveBeenCalled();
  });

  it("a refused page leaves the pages already loaded, says offline and not an empty page, and can be asked again", async () => {
    await openWithWindowFromOctober();
    jest.mocked(getOlderWorkoutsPage).mockResolvedValueOnce({ sessions: [oldWorkout("a", at(9, 20))], docsRead: 1, reachedStart: false });
    await useRecentWorkoutsStore.getState().loadOlder(null);
    jest.mocked(getOlderWorkoutsPage).mockRejectedValue(Object.assign(new Error("client is offline"), { code: "unavailable" }));
    await useRecentWorkoutsStore.getState().loadOlder(null);
    expect(older()?.read).toEqual({ status: "offline", error: "client is offline" });
    expect(older()?.sessions.map((s) => s.sessionId)).toEqual(["a"]);
    expect(older()?.reachedStart).toBe(false);
  });

  it("a list loaded before the window moved is read as not loaded", async () => {
    await openWithWindowFromOctober();
    jest.mocked(getOlderWorkoutsPage).mockResolvedValue({ sessions: [oldWorkout("a", at(9, 20))], docsRead: 1, reachedStart: false });
    await useRecentWorkoutsStore.getState().loadOlder(null);
    const { olderWorkouts, workoutWindow } = useRecentWorkoutsStore.getState();
    expect(olderOf(olderWorkouts, workoutWindow, null)).not.toBeNull();
    expect(olderOf(olderWorkouts, { windowStart: at(11, 1) }, null)).toBeNull();
  });
});

describe("a lift's sessions past the window", () => {
  const at = (month: number, day: number) => new Date(2026, month - 1, day, 10).getTime();
  const WINDOW_START = at(10, 1);
  const bench = (id: string, startedAt: number) => session(id, "push", startedAt, { exerciseIds: ["bench"] });
  const own = (id = "bench") => exerciseOlderOf(useRecentWorkoutsStore.getState().exerciseOlder, useRecentWorkoutsStore.getState().workoutWindow, id);

  async function openWithWindowFromOctober(windowStart: number | null = WINDOW_START) {
    usePlansStore.setState({ uid: UID, plans: [plan("push")], storedRead: true });
    await AsyncStorage.multiSet(
      serializeStoredWorkouts(UID, {
        sessions: [session("oct", "push", at(10, 5))],
        windowStart,
        lastByPlan: { push: session("oct", "push", at(10, 5)) },
        lastSeen: { seconds: 5, nanoseconds: 0 },
        lastFullAt: 0,
      })
    );
    await useRecentWorkoutsStore.getState().open(UID);
    jest.mocked(getSessionsOfExercisePage).mockReset();
  }

  it("the first page starts at the window's start, the next below the oldest loaded; pages add up, bill what they read, and go with the sign-out", async () => {
    await openWithWindowFromOctober();
    jest.mocked(getSessionsOfExercisePage)
      .mockResolvedValueOnce({ sessions: [bench("a", at(9, 20)), bench("b", at(9, 10))], docsRead: 2, reachedStart: false })
      .mockResolvedValueOnce({ sessions: [bench("c", at(8, 30))], docsRead: 1, reachedStart: false });
    const before = useRecentWorkoutsStore.getState().billedReads;

    await useRecentWorkoutsStore.getState().loadOlderOfExercise("bench");
    expect(getSessionsOfExercisePage).toHaveBeenLastCalledWith(UID, "bench", WINDOW_START, EXERCISE_LOG_PAGE_SIZE);
    await useRecentWorkoutsStore.getState().loadOlderOfExercise("bench");
    expect(getSessionsOfExercisePage).toHaveBeenLastCalledWith(UID, "bench", at(9, 10), EXERCISE_LOG_PAGE_SIZE);

    expect(own()?.sessions.map((s) => s.sessionId)).toEqual(["a", "b", "c"]);
    expect(useRecentWorkoutsStore.getState().billedReads - before).toBe(3);
    useRecentWorkoutsStore.getState().clear();
    expect(useRecentWorkoutsStore.getState().exerciseOlder).toEqual({});
  });

  it("each lift pages on its own, and a lift's pages are not the History home's", async () => {
    await openWithWindowFromOctober();
    jest.mocked(getSessionsOfExercisePage).mockResolvedValue({ sessions: [bench("a", at(9, 20))], docsRead: 1, reachedStart: false });
    await useRecentWorkoutsStore.getState().loadOlderOfExercise("bench");
    await useRecentWorkoutsStore.getState().loadOlderOfExercise("squat");
    expect(getSessionsOfExercisePage).toHaveBeenLastCalledWith(UID, "squat", WINDOW_START, EXERCISE_LOG_PAGE_SIZE);
    expect(useRecentWorkoutsStore.getState().olderWorkouts).toEqual({});
  });

  it("two lifts asked for at once each keep their answer: one lift's late answer is not dropped because another lift asked meanwhile", async () => {
    await openWithWindowFromOctober();
    let answerBench: (page: { sessions: WorkoutSessionDoc[]; docsRead: number; reachedStart: boolean }) => void = () => {};
    jest.mocked(getSessionsOfExercisePage).mockImplementationOnce(() => new Promise((resolve) => (answerBench = resolve)));
    const benchRead = useRecentWorkoutsStore.getState().loadOlderOfExercise("bench");
    jest.mocked(getSessionsOfExercisePage).mockResolvedValue({ sessions: [bench("s", at(9, 20))], docsRead: 1, reachedStart: false });
    await useRecentWorkoutsStore.getState().loadOlderOfExercise("squat");
    answerBench({ sessions: [bench("b", at(9, 25))], docsRead: 1, reachedStart: false });
    await benchRead;
    expect(own("squat")?.sessions.map((s) => s.sessionId)).toEqual(["s"]);
    expect(own("bench")?.sessions.map((s) => s.sessionId)).toEqual(["b"]);
  });

  it("starts below what the History home already loaded, and reads nothing once that list reached the first workout or the window holds everything", async () => {
    await openWithWindowFromOctober();
    jest.mocked(getOlderWorkoutsPage).mockResolvedValueOnce({ sessions: [session("x", "push", at(9, 1)), session("y", "push", at(8, 15))], docsRead: 2, reachedStart: false });
    await useRecentWorkoutsStore.getState().loadOlder(null);
    jest.mocked(getSessionsOfExercisePage).mockResolvedValue({ sessions: [], docsRead: 0, reachedStart: false });
    await useRecentWorkoutsStore.getState().loadOlderOfExercise("bench");
    expect(getSessionsOfExercisePage).toHaveBeenLastCalledWith(UID, "bench", at(8, 15), EXERCISE_LOG_PAGE_SIZE);

    jest.mocked(getOlderWorkoutsPage).mockResolvedValueOnce({ sessions: [], docsRead: 0, reachedStart: true });
    await useRecentWorkoutsStore.getState().loadOlder(null);
    jest.mocked(getSessionsOfExercisePage).mockClear();
    await useRecentWorkoutsStore.getState().loadOlderOfExercise("bench");
    expect(getSessionsOfExercisePage).not.toHaveBeenCalled();

    useRecentWorkoutsStore.getState().clear();
    await openWithWindowFromOctober(null);
    await useRecentWorkoutsStore.getState().loadOlderOfExercise("bench");
    expect(getSessionsOfExercisePage).not.toHaveBeenCalled();
  });

  it("a refused page leaves the pages already loaded, says offline, and is not the start; a failure says failed", async () => {
    await openWithWindowFromOctober();
    jest.mocked(getSessionsOfExercisePage).mockResolvedValueOnce({ sessions: [bench("a", at(9, 20))], docsRead: 1, reachedStart: false });
    await useRecentWorkoutsStore.getState().loadOlderOfExercise("bench");
    jest.mocked(getSessionsOfExercisePage).mockRejectedValue(Object.assign(new Error("client is offline"), { code: "unavailable" }));
    await useRecentWorkoutsStore.getState().loadOlderOfExercise("bench");
    expect(own()?.read).toEqual({ status: "offline", error: "client is offline" });
    expect(own()?.sessions.map((s) => s.sessionId)).toEqual(["a"]);
    expect(own()?.reachedStart).toBe(false);

    jest.useFakeTimers().setSystemTime(Date.now() + WORKOUTS_OLDER_RETRY_GAP_MS + 1_000);
    jest.mocked(getSessionsOfExercisePage).mockRejectedValue(Object.assign(new Error("needs an index"), { code: "failed-precondition" }));
    await useRecentWorkoutsStore.getState().loadOlderOfExercise("bench");
    jest.useRealTimers();
    expect(own()?.read).toEqual({ status: "failed", error: "needs an index" });
  });

  it("exercisePaging: no start without a window start, the lowest edge of the lists, and the start once either list reached it", () => {
    const list = (...days: number[]) => ({ sessions: days.map((d) => bench(`s${d}`, at(9, d))), reachedStart: false });
    expect(exercisePaging(null, null, null)).toEqual({ reachedStart: true, before: null });
    expect(exercisePaging(WINDOW_START, null, null)).toEqual({ reachedStart: false, before: WINDOW_START });
    expect(exercisePaging(WINDOW_START, list(20, 10), list(25))).toEqual({ reachedStart: false, before: at(9, 10) });
    expect(exercisePaging(WINDOW_START, list(20), { ...list(), reachedStart: true }).reachedStart).toBe(true);
    expect(exercisePaging(WINDOW_START, { ...list(), reachedStart: true }, null).reachedStart).toBe(true);
  });
});
