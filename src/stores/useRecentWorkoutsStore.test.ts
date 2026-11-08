import AsyncStorage from "@react-native-async-storage/async-storage";
import { waitFor } from "@testing-library/react-native";
import { useRecentWorkoutsStore } from "./useRecentWorkoutsStore";
import { usePlansStore } from "./usePlansStore";
import { getChangedSessions, getNewestSessionStamp, getPlanSessionsFromServer } from "../services/db/workoutSessions";
import { getAllWorkoutPlans } from "../services/db/userDB";
import type { WorkoutSessionDoc } from "../types/workoutSession";
import { WORKOUTS_STORAGE_KEY } from "../config/storageKeys";

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
  ({ sessionId: id, workoutId, workoutName: workoutId, startedAt, endedAt: startedAt + 60, exerciseIds: [], rollupPending: false, ...extra }) as WorkoutSessionDoc;
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

it("plan ids that arrive while a follow check runs are still loaded, with no focus", async () => {
  usePlansStore.setState({ uid: UID, plans: null, storedRead: true });
  await useRecentWorkoutsStore.getState().open(UID); // no plans yet: nothing to load
  let answerBaseline: (stamp: { seconds: number; nanoseconds: number }) => void = () => {};
  jest.mocked(getNewestSessionStamp).mockReturnValue(new Promise((resolve) => (answerBaseline = resolve)));

  usePlansStore.setState({ plans: [{ id: "push", name: "Push", exercises: [] }] }); // follow starts
  usePlansStore.setState({
    plans: [
      { id: "push", name: "Push", exercises: [] },
      { id: "pull", name: "Pull", exercises: [] },
    ],
  }); // lands mid-follow
  answerBaseline({ seconds: 10, nanoseconds: 0 });

  await waitFor(() => expect(useRecentWorkoutsStore.getState().loaded).toContain("pull"));
  expect(planQueries()).toEqual(["freestyle", "pull", "push"]);
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
