import { Timestamp, getDocs, getDocsFromServer, runTransaction, serverTimestamp, writeBatch } from "firebase/firestore";
import { getAllExerciseStats, getWorkoutSessions, saveWorkoutSession } from "./workoutSessions";
import { buildExercise, buildWorkout } from "../../test/fixtures";

jest.mock("../firebase/firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  ...jest.requireActual("firebase/firestore"),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  doc: jest.fn((_ref: unknown, id: string) => id),
  getDocs: jest.fn(),
  getDocsFromServer: jest.fn(),
  writeBatch: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => "SERVER_STAMP"),
}));

const snapshot = (fromCache: boolean) => ({ metadata: { fromCache }, empty: true, docs: [] });

// TICKET-075: the workouts store's change check filters on `updatedAt`, so a
// write of a `sessions` doc without it is invisible to every other phone.
describe("the server stamp on sessions", () => {
  it("a Finish stamps the session in the batch and only summaries in the transaction", async () => {
    const batchSet = jest.fn();
    (writeBatch as jest.Mock).mockReturnValue({ set: batchSet, commit: jest.fn().mockResolvedValue(undefined) });
    const txSet = jest.fn();
    (runTransaction as jest.Mock).mockImplementation(async (_db, fn) =>
      fn({ get: jest.fn().mockResolvedValue({ exists: () => false }), set: txSet })
    );
    const workout = buildWorkout([], {
      id: "plan-a",
      startTime: 1_000,
      exercises: [buildExercise("Bench Press", { sets: [{ id: 1, segments: [{ Weight: 60, Reps: 5 }] }] })],
    });

    await saveWorkoutSession("u1", workout, 2_000);

    const sessionWrite = batchSet.mock.calls.find(([, data]) => data.exerciseIds !== undefined)![1];
    expect(serverTimestamp).toHaveBeenCalled();
    expect(sessionWrite.updatedAt).toBe("SERVER_STAMP");
    // TICKET-076: the summary itself, or the change check never finds it.
    expect(txSet).toHaveBeenCalledTimes(1);
    expect(txSet.mock.calls[0][1].exerciseId).toBeDefined();
    expect(txSet.mock.calls[0][1].updatedAt).toBe("SERVER_STAMP");
  });

  it("a Finish returns what its transaction computed, unstamped (TICKET-076)", async () => {
    (writeBatch as jest.Mock).mockReturnValue({ set: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) });
    const workout = buildWorkout([], {
      id: "plan-a",
      startTime: 1_000,
      exercises: [buildExercise("Bench Press", { sets: [{ id: 1, segments: [{ Weight: 60, Reps: 5 }] }] })],
    });
    const tx = { get: jest.fn().mockResolvedValue({ exists: () => false }), set: jest.fn() };
    // A conflict re-runs the function: the last run is what committed.
    (runTransaction as jest.Mock).mockImplementation(async (_db, fn) => {
      await fn(tx);
      return fn(tx);
    });

    const { summaries } = await saveWorkoutSession("u1", workout, 2_000);
    expect(summaries).toHaveLength(1);
    expect(summaries?.[0].lastPerformedAt).toBe(1_000);
    expect(summaries?.[0].updatedAt).toBeUndefined();
  });

  // TICKET-077: the queue retries both phases, so the transaction's failure must
  // reach it, and a retry after a commit whose answer was lost must not count twice.
  it("a failed transaction rejects after the batch; a retry folds the session once", async () => {
    const commit = jest.fn().mockResolvedValue(undefined);
    (writeBatch as jest.Mock).mockReturnValue({ set: jest.fn(), commit });
    const workout = buildWorkout([], {
      id: "plan-a",
      startTime: 1_000,
      exercises: [buildExercise("Bench Press", { sets: [{ id: 1, segments: [{ Weight: 60, Reps: 5 }] }] })],
    });
    (runTransaction as jest.Mock).mockRejectedValueOnce(new Error("contention"));
    await expect(saveWorkoutSession("u1", workout, 2_000)).rejects.toThrow("contention");
    expect(commit).toHaveBeenCalledTimes(1);

    const held = new Map<string, object>();
    (runTransaction as jest.Mock).mockImplementation(async (_db, fn) =>
      fn({
        get: async (id: string) => ({ exists: () => held.has(id), data: () => held.get(id) }),
        set: (id: string, data: object) => held.set(id, data),
      })
    );
    await saveWorkoutSession("u1", workout, 2_000);
    const { summaries } = await saveWorkoutSession("u1", workout, 2_000);
    expect(summaries[0].recentSessions).toHaveLength(1);
  });

  it("a read gives the stamp as plain numbers, nanoseconds kept, and none for a session written before 075", async () => {
    const docOf = (data: object) => ({ data: () => data });
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [docOf({ sessionId: "new", updatedAt: new Timestamp(5, 400) }), docOf({ sessionId: "old" })],
    });
    const { sessions } = await getWorkoutSessions("u1");
    expect(sessions).toEqual([{ sessionId: "new", updatedAt: { seconds: 5, nanoseconds: 400 } }, { sessionId: "old" }]);
    expect(sessions[0].updatedAt).not.toBeInstanceOf(Timestamp);
  });
});

// TICKET-076: one name, one meaning. A summary written before the server stamp
// holds a phone-clock number under `updatedAt`.
it("a summary read keeps a server stamp as plain numbers and drops a phone-clock number", async () => {
  const docOf = (data: object) => ({ data: () => data });
  (getDocsFromServer as jest.Mock).mockResolvedValue({
    metadata: { hasPendingWrites: false },
    docs: [docOf({ exerciseId: "new", updatedAt: new Timestamp(5, 400) }), docOf({ exerciseId: "old", updatedAt: 1_700_000_000_000 })],
  });
  await expect(getAllExerciseStats("u1")).resolves.toEqual([
    { exerciseId: "new", updatedAt: { seconds: 5, nanoseconds: 400 } },
    { exerciseId: "old" },
  ]);
});
