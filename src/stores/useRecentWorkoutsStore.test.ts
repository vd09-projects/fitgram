import AsyncStorage from "@react-native-async-storage/async-storage";
import { waitFor } from "@testing-library/react-native";
import { useRecentWorkoutsStore, workoutsRunFor } from "./useRecentWorkoutsStore";
import { usePlansStore } from "./usePlansStore";
import {
  getChangedSessions,
  getLastWorkoutOfPlan,
  getNewestSessionStamp,
  getWorkoutsOfMonth,
  getWorkoutWindowFromServer,
} from "../services/db/workoutSessions";
import { getAllWorkoutPlans } from "../services/db/userDB";
import type { WorkoutSessionDoc } from "../types/workoutSession";
import { serializeStoredWorkouts } from "../utils/workoutWindow";
import { WORKOUTS_STORAGE_KEY } from "../config/storageKeys";
import { WORKOUTS_CHECK_WAIT_MS, WORKOUTS_ON_PHONE_MIN } from "../config/sync";
import { serveRecentWorkouts } from "../test/recentWorkouts";

jest.mock("../services/firebase/firebase", () => ({ db: {} }));
jest.mock("../services/db/workoutSessions", () => ({
  getNewestSessionStamp: jest.fn(),
  getWorkoutWindowFromServer: jest.fn(),
  getLastWorkoutOfPlan: jest.fn(),
  getChangedSessions: jest.fn(),
  getWorkoutsOfMonth: jest.fn(),
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

describe("a month older than the window, on tap", () => {
  const olderMonths = () => useRecentWorkoutsStore.getState().olderMonths;
  const SEP = "2026-09";
  const sep = (id: string) => session(id, "push", new Date(2026, 8, 10, 10).getTime());

  /** The window starts on 1 October, with plans looked up, so September is older. */
  async function openWithWindowFromOctober() {
    usePlansStore.setState({ uid: UID, plans: [plan("push")], storedRead: true });
    await AsyncStorage.multiSet(
      serializeStoredWorkouts(UID, {
        sessions: [session("oct", "push", new Date(2026, 9, 5, 10).getTime())],
        windowStart: new Date(2026, 9, 1).getTime(),
        lastByPlan: { push: session("oct", "push", new Date(2026, 9, 5, 10).getTime()) },
        lastSeen: { seconds: 5, nanoseconds: 0 },
        lastFullAt: 0,
      })
    );
    await useRecentWorkoutsStore.getState().open(UID);
    jest.mocked(getWorkoutsOfMonth).mockReset();
  }

  it("is read once, kept in memory only, and not read again", async () => {
    await openWithWindowFromOctober();
    jest.mocked(getWorkoutsOfMonth).mockResolvedValue({ sessions: [sep("a"), sep("b")], docsRead: 2 });
    const before = useRecentWorkoutsStore.getState().billedReads;
    await useRecentWorkoutsStore.getState().loadMonth(SEP);
    await useRecentWorkoutsStore.getState().loadMonth(SEP);
    expect(getWorkoutsOfMonth).toHaveBeenCalledTimes(1);
    expect(getWorkoutsOfMonth).toHaveBeenCalledWith(UID, SEP);
    expect(olderMonths()[SEP]).toEqual({ status: "ready", sessions: [sep("a"), sep("b")] });
    expect(useRecentWorkoutsStore.getState().billedReads - before).toBe(2);
    // Not part of the window and not saved: the copy on disk still names only October's shard.
    expect(sessionIds()).toEqual(["oct"]);
    await waitFor(async () => expect((await savedKeys()).length).toBeGreaterThan(0));
    const saved = (await AsyncStorage.multiGet(await savedKeys())).map(([, value]) => value).join("");
    expect(saved).not.toContain("2026-09");
    expect(saved).not.toContain('"a"');
  });

  it("is refused offline with a state, retried on the next ask, and never read as an empty month", async () => {
    await openWithWindowFromOctober();
    jest.mocked(getWorkoutsOfMonth).mockRejectedValue(Object.assign(new Error("client is offline"), { code: "unavailable" }));
    await useRecentWorkoutsStore.getState().loadMonth(SEP);
    expect(olderMonths()[SEP]).toEqual({ status: "offline", error: "client is offline" });

    jest.mocked(getWorkoutsOfMonth).mockRejectedValue(new Error("permission-denied"));
    await useRecentWorkoutsStore.getState().loadMonth(SEP);
    expect(olderMonths()[SEP]).toMatchObject({ status: "failed" });

    jest.mocked(getWorkoutsOfMonth).mockResolvedValue({ sessions: [sep("a")], docsRead: 1 });
    await useRecentWorkoutsStore.getState().loadMonth(SEP);
    expect(olderMonths()[SEP]).toEqual({ status: "ready", sessions: [sep("a")] });
  });

  it("reads nothing for a month the phone already holds, or before it knows its window", async () => {
    await openWithWindowFromOctober();
    await useRecentWorkoutsStore.getState().loadMonth("2026-10");
    await useRecentWorkoutsStore.getState().loadMonth("2026-12");
    expect(getWorkoutsOfMonth).not.toHaveBeenCalled();
    useRecentWorkoutsStore.getState().clear();
    await useRecentWorkoutsStore.getState().loadMonth(SEP);
    expect(getWorkoutsOfMonth).not.toHaveBeenCalled();
  });

  it("says the wait is over when the read outlasts it, and still takes the answer when it lands", async () => {
    await openWithWindowFromOctober();
    let answer: (value: { sessions: WorkoutSessionDoc[]; docsRead: number }) => void = () => {};
    jest.mocked(getWorkoutsOfMonth).mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const loading = useRecentWorkoutsStore.getState().loadMonth(SEP);
    jest.advanceTimersByTime(WORKOUTS_CHECK_WAIT_MS);
    expect(olderMonths()[SEP]).toEqual({ status: "loading", waitOver: true });
    answer({ sessions: [sep("a")], docsRead: 1 });
    await loading;
    expect(olderMonths()[SEP]).toEqual({ status: "ready", sessions: [sep("a")] });
  });

  it("is gone at sign-out, and a read that lands after it is dropped", async () => {
    await openWithWindowFromOctober();
    let answer: (value: { sessions: WorkoutSessionDoc[]; docsRead: number }) => void = () => {};
    jest.mocked(getWorkoutsOfMonth).mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const loading = useRecentWorkoutsStore.getState().loadMonth(SEP);
    expect(olderMonths()[SEP]).toEqual({ status: "loading", waitOver: false });
    useRecentWorkoutsStore.getState().clear();
    expect(olderMonths()).toEqual({});
    answer({ sessions: [sep("a")], docsRead: 1 });
    await loading;
    expect(olderMonths()).toEqual({});
  });
});
