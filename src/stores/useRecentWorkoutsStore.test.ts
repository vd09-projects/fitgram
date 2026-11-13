import AsyncStorage from "@react-native-async-storage/async-storage";
import { waitFor } from "@testing-library/react-native";
import { useRecentWorkoutsStore } from "./useRecentWorkoutsStore";
import { usePlansStore } from "./usePlansStore";
import { getChangedSessions, getNewestSessionStamp, getPlanSessionsFromServer } from "../services/db/workoutSessions";
import { getAllWorkoutPlans } from "../services/db/userDB";
import type { WorkoutSessionDoc } from "../types/workoutSession";
import { serializeStoredWorkouts } from "../utils/workoutsSync";
import { WORKOUTS_STORAGE_KEY } from "../config/storageKeys";
import { WORKOUTS_PER_PLAN } from "../config/sync";

jest.mock("../services/firebase/firebase", () => ({ db: {} }));
jest.mock("../services/db/workoutSessions", () => ({
  getNewestSessionStamp: jest.fn(),
  getPlanSessionsFromServer: jest.fn(),
  getChangedSessions: jest.fn(),
}));
jest.mock("../services/db/userDB", () => ({
  getAllWorkoutPlans: jest.fn(),
  getChangedPlans: jest.fn(async () => []),
  getPlanFromServer: jest.fn(),
}));

const UID = "u1";
const session = (id: string, workoutId: string, startedAt: number, extra: Partial<WorkoutSessionDoc> = {}) =>
  ({ sessionId: id, workoutId, workoutName: workoutId, startedAt, endedAt: startedAt + 60, exerciseIds: [], lifts: [], ...extra }) as WorkoutSessionDoc;
const planQueries = () => jest.mocked(getPlanSessionsFromServer).mock.calls.map(([, planId]) => planId).sort();

beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(getNewestSessionStamp).mockResolvedValue({ seconds: 10, nanoseconds: 0 });
  jest.mocked(getPlanSessionsFromServer).mockResolvedValue([]);
  jest.mocked(getChangedSessions).mockResolvedValue([]);
  usePlansStore.getState().clear();
  useRecentWorkoutsStore.getState().clear();
  await AsyncStorage.clear();
});

it("first launch: nothing to load until the plans arrive, then their workouts load with no focus", async () => {
  jest.mocked(getAllWorkoutPlans).mockReturnValue(new Promise(() => {})); // plans still loading
  await useRecentWorkoutsStore.getState().open(UID);
  usePlansStore.getState().open(UID);
  expect(getPlanSessionsFromServer).not.toHaveBeenCalled();
  expect(useRecentWorkoutsStore.getState().byPlan).toBeNull();

  jest.mocked(getPlanSessionsFromServer).mockImplementation(async (_uid, planId) =>
    planId === "push" ? [session("s1", "push", 100)] : []
  );
  // The plans' answer lands; nothing else triggers the workouts store.
  usePlansStore.setState({ plans: [{ id: "push", name: "Push", exercises: [] }] });

  await waitFor(() => expect(useRecentWorkoutsStore.getState().byPlan?.push).toHaveLength(1));
  expect(planQueries()).toEqual(["freestyle", "push"]);
});

it("a copy held with an old lastFullAt gets a change check; nothing held still gets a full read (TICKET-076)", async () => {
  usePlansStore.setState({ uid: UID, plans: [{ id: "push", name: "Push", exercises: [] }], storedRead: true });
  await AsyncStorage.setItem(
    WORKOUTS_STORAGE_KEY,
    serializeStoredWorkouts(UID, WORKOUTS_PER_PLAN, {
      byPlan: { push: [session("s1", "push", 100)], freestyle: [] },
      loaded: ["push", "freestyle"],
      lastSeen: { seconds: 5, nanoseconds: 0 },
      lastFullAt: 0,
    })
  );
  await useRecentWorkoutsStore.getState().open(UID);
  expect(getNewestSessionStamp).not.toHaveBeenCalled();
  expect(getChangedSessions).toHaveBeenCalledTimes(1);

  useRecentWorkoutsStore.getState().clear();
  await AsyncStorage.clear();
  await useRecentWorkoutsStore.getState().open(UID);
  expect(getNewestSessionStamp).toHaveBeenCalled();
});

it("a full reload replaces what is held: a session deleted on the server goes", async () => {
  usePlansStore.setState({ uid: UID, plans: [{ id: "push", name: "Push", exercises: [] }], storedRead: true });
  jest.mocked(getPlanSessionsFromServer).mockImplementation(async (_uid, planId) =>
    planId === "push" ? [session("kept", "push", 200), session("wiped", "push", 100)] : []
  );
  await useRecentWorkoutsStore.getState().open(UID);
  await waitFor(() => expect(useRecentWorkoutsStore.getState().byPlan?.push).toHaveLength(2));

  jest.mocked(getPlanSessionsFromServer).mockImplementation(async (_uid, planId) =>
    planId === "push" ? [session("kept", "push", 200)] : []
  );
  await useRecentWorkoutsStore.getState().check({ force: true, full: true });
  expect(useRecentWorkoutsStore.getState().byPlan?.push.map((s) => s.sessionId)).toEqual(["kept"]);
});

it("own Finish: held at once with no read; the next check brings the stamped copy once, in its place", async () => {
  usePlansStore.setState({ uid: UID, plans: [{ id: "push", name: "Push", exercises: [] }], storedRead: true });
  await useRecentWorkoutsStore.getState().open(UID);
  await waitFor(() => expect(useRecentWorkoutsStore.getState().byPlan).not.toBeNull());
  jest.clearAllMocks();

  useRecentWorkoutsStore.getState().applyFinished(UID, session("mine", "push", 500));
  expect(useRecentWorkoutsStore.getState().byPlan?.push.map((s) => s.sessionId)).toEqual(["mine"]);
  expect(getPlanSessionsFromServer).not.toHaveBeenCalled();
  expect(getChangedSessions).not.toHaveBeenCalled();

  const stamped = session("mine", "push", 500, { updatedAt: { seconds: 11, nanoseconds: 0 } });
  jest.mocked(getChangedSessions).mockResolvedValue([stamped]);
  await useRecentWorkoutsStore.getState().check({ force: true });
  expect(getChangedSessions).toHaveBeenCalledWith(UID, { seconds: 10, nanoseconds: 0 });
  expect(useRecentWorkoutsStore.getState().byPlan?.push).toEqual([stamped]);
  expect(useRecentWorkoutsStore.getState().lastSeen).toEqual({ seconds: 11, nanoseconds: 0 });
  expect(getNewestSessionStamp).not.toHaveBeenCalled();
});

it("offline after a restart: the stored copy is shown and a failed check keeps it; sign-out removes it", async () => {
  usePlansStore.setState({ uid: UID, plans: [{ id: "push", name: "Push", exercises: [] }], storedRead: true });
  jest.mocked(getPlanSessionsFromServer).mockImplementation(async (_uid, planId) =>
    planId === "push" ? [session("s1", "push", 100)] : []
  );
  await useRecentWorkoutsStore.getState().open(UID);
  await waitFor(async () => expect(await AsyncStorage.getItem(WORKOUTS_STORAGE_KEY)).not.toBeNull());

  // Restart: memory gone, disk kept, every read fails.
  useRecentWorkoutsStore.setState({ uid: null, byPlan: null, storedRead: false, lastOkAt: null });
  jest.mocked(getChangedSessions).mockRejectedValue(new Error("offline"));
  jest.mocked(getPlanSessionsFromServer).mockRejectedValue(new Error("offline"));
  await useRecentWorkoutsStore.getState().open(UID);
  expect(useRecentWorkoutsStore.getState().lastResult).toBe("failed");
  expect(useRecentWorkoutsStore.getState().byPlan?.push.map((s) => s.sessionId)).toEqual(["s1"]);

  useRecentWorkoutsStore.getState().clear();
  await waitFor(async () => expect(await AsyncStorage.getItem(WORKOUTS_STORAGE_KEY)).toBeNull());
  expect(useRecentWorkoutsStore.getState().byPlan).toBeNull();
});
