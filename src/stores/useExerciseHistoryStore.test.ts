import AsyncStorage from "@react-native-async-storage/async-storage";
import { waitFor } from "@testing-library/react-native";
import { useExerciseHistoryStore } from "./useExerciseHistoryStore";
import { getAllExerciseStats, getChangedExerciseStats } from "../services/db/workoutSessions";
import type { ExerciseStatsDoc } from "../types/workoutSession";
import { storedSummariesKeys } from "../utils/exerciseSummariesSync";
import { EXERCISE_SUMMARIES_STORAGE_KEY } from "../config/storageKeys";
import { EXERCISE_SUMMARIES_SHARDS } from "../config/sync";

jest.mock("../services/firebase/firebase", () => ({ db: {} }));
jest.mock("../services/db/workoutSessions", () => ({
  getAllExerciseStats: jest.fn(),
  getChangedExerciseStats: jest.fn(),
}));

const UID = "u1";
const store = () => useExerciseHistoryStore.getState();
const summary = (exerciseId: string, seconds: number) =>
  ({ exerciseId, exerciseName: exerciseId, lastPerformedAt: 1, fields: [], recentSessions: [], bestByReps: {}, volumeHistory: [], updatedAt: { seconds, nanoseconds: 0 } }) as ExerciseStatsDoc;
const unstamped = (doc: ExerciseStatsDoc, lastPerformedAt: number): ExerciseStatsDoc => {
  const { updatedAt: _stamp, ...rest } = doc;
  return { ...rest, lastPerformedAt };
};
const stored = () => AsyncStorage.multiGet(storedSummariesKeys(EXERCISE_SUMMARIES_SHARDS));

beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(getAllExerciseStats).mockResolvedValue([summary("bench", 5)]);
  jest.mocked(getChangedExerciseStats).mockResolvedValue([]);
  store().clear();
  await AsyncStorage.clear();
});

it("first load reads the collection; a recent check skips; past the skip it asks only for what changed", async () => {
  await store().open(UID);
  await store().open(UID);
  expect(getAllExerciseStats).toHaveBeenCalledTimes(1);
  expect(getChangedExerciseStats).not.toHaveBeenCalled();

  jest.mocked(getChangedExerciseStats).mockResolvedValue([summary("squat", 8)]);
  useExerciseHistoryStore.setState({ lastOkAt: null });
  await store().open(UID);
  expect(getChangedExerciseStats).toHaveBeenCalledWith(UID, { seconds: 5, nanoseconds: 0 });
  expect(getAllExerciseStats).toHaveBeenCalledTimes(1);
  expect(Object.keys(store().byId ?? {}).sort()).toEqual(["bench", "squat"]);
  expect(store().lastSeen).toEqual({ seconds: 8, nanoseconds: 0 });
});

it("offline after a restart keeps the stored copy, and sign-out removes every key", async () => {
  await store().open(UID);
  await waitFor(async () => expect(await AsyncStorage.getItem(EXERCISE_SUMMARIES_STORAGE_KEY)).not.toBeNull());

  // Restart: memory gone, disk kept, every read fails.
  useExerciseHistoryStore.setState({ uid: null, byId: null, lastSeen: null, storedRead: false, lastOkAt: null, lastResult: null });
  jest.mocked(getChangedExerciseStats).mockRejectedValue(new Error("offline"));
  jest.mocked(getAllExerciseStats).mockRejectedValue(new Error("offline"));
  await store().open(UID);
  expect(store().lastResult).toBe("failed");
  expect(store().byId?.bench.updatedAt).toEqual({ seconds: 5, nanoseconds: 0 });
  expect(getChangedExerciseStats).toHaveBeenCalledTimes(1); // a stored copy is checked, not read again whole

  store().clear();
  await waitFor(async () => expect((await stored()).every(([, value]) => value === null)).toBe(true));
  expect(store().byId).toBeNull();
});

it("own Finish: held at once with no read, lastSeen unmoved; the next check's stamped copy wins", async () => {
  await store().open(UID);
  const before = jest.mocked(getChangedExerciseStats).mock.calls.length + jest.mocked(getAllExerciseStats).mock.calls.length;

  store().applyFinished(UID, [unstamped(summary("bench", 0), 2), unstamped(summary("squat", 0), 2)]);

  expect(jest.mocked(getChangedExerciseStats).mock.calls.length + jest.mocked(getAllExerciseStats).mock.calls.length).toBe(before);
  expect(store().byId?.bench).toMatchObject({ lastPerformedAt: 2 });
  expect(store().byId?.bench.updatedAt).toBeUndefined();
  expect(store().byId?.squat).toBeDefined(); // never done before: no longer "First time"
  expect(store().lastSeen).toEqual({ seconds: 5, nanoseconds: 0 });

  jest.mocked(getChangedExerciseStats).mockResolvedValue([{ ...summary("bench", 9), lastPerformedAt: 2 }]);
  await store().open(UID); // past the skip with no force
  expect(getChangedExerciseStats).toHaveBeenCalledWith(UID, { seconds: 5, nanoseconds: 0 });
  expect(store().byId?.bench.updatedAt).toEqual({ seconds: 9, nanoseconds: 0 });
  expect(store().lastSeen).toEqual({ seconds: 9, nanoseconds: 0 });
});

it("a check running as the upload finishes does not start a skip that hides the Finish", async () => {
  await store().open(UID);
  useExerciseHistoryStore.setState({ lastOkAt: null });
  let answer!: (docs: ExerciseStatsDoc[]) => void;
  jest.mocked(getChangedExerciseStats).mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
  const running = store().check();

  store().applyFinished(UID, [unstamped(summary("bench", 0), 2)]);
  answer([]);
  await running;

  await store().open(UID);
  expect(getChangedExerciseStats).toHaveBeenCalledTimes(2);
});
