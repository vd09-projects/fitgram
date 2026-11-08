// TICKET-047 (device, 2026-10-31): offline, getDocs resolves from the memory
// cache, empty on a cold start, instead of rejecting. Read as an answer, every
// exercise was "never done" and the logger said "First time".

import { Timestamp, getDocs, runTransaction, serverTimestamp, writeBatch } from "firebase/firestore";
import { getExerciseStats, getWorkoutSessions, saveWorkoutSession } from "./workoutSessions";
import { buildExercise, buildWorkout } from "../../test/fixtures";

jest.mock("../firebase/firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  ...jest.requireActual("firebase/firestore"),
  collection: jest.fn(),
  documentId: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  doc: jest.fn((_ref: unknown, id: string) => id),
  getDocs: jest.fn(),
  writeBatch: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => "SERVER_STAMP"),
}));

const snapshot = (fromCache: boolean) => ({ metadata: { fromCache }, empty: true, docs: [] });

describe("getExerciseStats", () => {
  it("rejects an answer from the cache, and reads a server answer with no doc as never done", async () => {
    (getDocs as jest.Mock).mockResolvedValue(snapshot(true));
    await expect(getExerciseStats("u1", ["bench"])).rejects.toThrow();

    (getDocs as jest.Mock).mockResolvedValue(snapshot(false));
    await expect(getExerciseStats("u1", ["bench"])).resolves.toEqual({ bench: null });
  });
});

// TICKET-075: the workouts store's change check filters on `updatedAt`, so a
// write of a `sessions` doc without it is invisible to every other phone.
describe("the server stamp on sessions", () => {
  it("both writes of a Finish carry updatedAt = serverTimestamp(): the batch and the summary merge", async () => {
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
    const summaryMerge = txSet.mock.calls.find(([, data]) => data.rollupPending === false)![1];
    expect(serverTimestamp).toHaveBeenCalled();
    expect(sessionWrite.updatedAt).toBe("SERVER_STAMP");
    expect(summaryMerge.updatedAt).toBe("SERVER_STAMP");
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
