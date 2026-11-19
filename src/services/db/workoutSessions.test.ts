import { Timestamp, getDocFromServer, getDocs, getDocsFromServer, limit, runTransaction, serverTimestamp, startAfter, where, writeBatch } from "firebase/firestore";
import { getAllExerciseStats, getLastWorkoutOfPlan, getOlderWorkoutsPage, getSessionsOfExercisePage, getWorkoutById, getWorkoutSessions, saveWorkoutSession, setWorkoutNote } from "./workoutSessions";
import { buildExercise, buildStats, buildWorkout } from "../../test/fixtures";
import * as liftRecord from "../../utils/liftRecord";

jest.mock("../firebase/firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  ...jest.requireActual("firebase/firestore"),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  doc: jest.fn((_ref: unknown, id: string) => id),
  getDocs: jest.fn(),
  getDocFromServer: jest.fn(),
  deleteField: jest.fn(() => "DELETE_FIELD"),
  getDocsFromServer: jest.fn(),
  writeBatch: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => "SERVER_STAMP"),
}));

const snapshot = (fromCache: boolean) => ({ metadata: { fromCache }, empty: true, docs: [] });

// TICKET-075: the workouts store's change check filters on `updatedAt`, so a
// write of a `sessions` doc without it is invisible to every other phone.
describe("the server stamp on sessions", () => {
  it("a Finish stamps the session in the batch and the summaries and verdicts in the transaction", async () => {
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
    const summaryWrite = txSet.mock.calls.find(([, data]) => data.exerciseId !== undefined)![1];
    expect(summaryWrite.updatedAt).toBe("SERVER_STAMP");
    // 081: the transaction also writes the verdicts to the session, stamped, with merge.
    const verdictWrite = txSet.mock.calls.find(([, data]) => data.lifts !== undefined)!;
    expect(verdictWrite[1].updatedAt).toBe("SERVER_STAMP");
    expect(verdictWrite[2]).toEqual({ merge: true });
    expect(txSet).toHaveBeenCalledTimes(2);
  });

  // TICKET-081: phase 1 writes the lifts pending, with merge so a replay keeps a note; phase 2 writes the verdicts.
  it("phase 1 writes the lifts pending with merge and no note; phase 2 writes the verdicts and the returned session has them", async () => {
    const batchSet = jest.fn();
    (writeBatch as jest.Mock).mockReturnValue({ set: batchSet, commit: jest.fn().mockResolvedValue(undefined) });
    const lastTime = {
      exists: () => true,
      data: () => buildStats("Bench Press", [{ sets: [{ Weight: 60, Reps: 5 }], performedAt: 500 }]),
    };
    const tx = { get: jest.fn().mockResolvedValue(lastTime), set: jest.fn() };
    (runTransaction as jest.Mock).mockImplementation(async (_db, fn) => fn(tx));
    const workout = buildWorkout([], {
      id: "plan-a",
      startTime: 1_000,
      exercises: [buildExercise("Bench Press", { sets: [{ id: 1, segments: [{ Weight: 65, Reps: 5 }] }] })],
    });

    const { session } = await saveWorkoutSession("u1", workout, 2_000);

    const [, phase1, options] = batchSet.mock.calls.find(([, data]) => data.exerciseIds !== undefined)!;
    expect(options).toEqual({ merge: true });
    expect(phase1).not.toHaveProperty("note");
    expect(phase1.lifts[0]).toMatchObject({ verdict: null, reason: "pending" });
    const phase2 = tx.set.mock.calls.find(([, data]) => data.lifts !== undefined)![1];
    expect(phase2.lifts[0]).toMatchObject({ verdict: "better", reason: null });
    expect(session.lifts).toEqual(phase2.lifts);
    expect(session.exerciseIds).toEqual(["bench-press"]);
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
    expect(summaries[0].lastPerformedAt).toBe(1_000);
    expect(summaries[0].updatedAt).toBeUndefined();
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
    expect(sessions).toMatchObject([{ sessionId: "new", updatedAt: { seconds: 5, nanoseconds: 400 } }, { sessionId: "old" }]);
    expect(sessions[1]).not.toHaveProperty("updatedAt");
    expect(sessions[0].updatedAt).not.toBeInstanceOf(Timestamp);
  });

  // TICKET-081 review: one session without readable `lifts` must not make the held copy's
  // validator refuse the whole copy; it is read as no lifts, flagged, never as a plain empty list.
  it("a read gives readable lifts as stored, and [] with liftsUnreadable for a missing or bad array", async () => {
    const docOf = (data: object) => ({ data: () => data });
    const lift = { id: "a", name: "A", fields: [], sets: [], verdict: "better", reason: null };
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [
        docOf({ sessionId: "ok", lifts: [lift] }),
        docOf({ sessionId: "old" }),
        docOf({ sessionId: "bad", lifts: [{ ...lift, verdict: "better", reason: "first_time" }] }),
      ],
    });
    const { sessions } = await getWorkoutSessions("u1");
    expect(sessions[0].lifts).toEqual([lift]);
    expect(sessions[0]).not.toHaveProperty("liftsUnreadable");
    for (const unreadable of [sessions[1], sessions[2]]) {
      expect(unreadable.lifts).toEqual([]);
      expect(unreadable.liftsUnreadable).toBe(true);
    }
  });

  // A derived value must not block the rollup: the fold goes on and the lifts stay pending.
  it("if the verdicts cannot be computed the fold still commits and the lifts stay pending", async () => {
    const batchSet = jest.fn();
    (writeBatch as jest.Mock).mockReturnValue({ set: batchSet, commit: jest.fn().mockResolvedValue(undefined) });
    const tx = { get: jest.fn().mockResolvedValue({ exists: () => false }), set: jest.fn() };
    (runTransaction as jest.Mock).mockImplementation(async (_db, fn) => fn(tx));
    const spy = jest.spyOn(liftRecord, "withVerdicts").mockImplementation(() => {
      throw new Error("boom");
    });
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    const workout = buildWorkout([], {
      id: "plan-a",
      startTime: 1_000,
      exercises: [buildExercise("Bench Press", { sets: [{ id: 1, segments: [{ Weight: 60, Reps: 5 }] }] })],
    });

    const { session, summaries } = await saveWorkoutSession("u1", workout, 2_000);

    expect(summaries).toHaveLength(1);
    expect(tx.set.mock.calls.some(([, data]) => data.exerciseId !== undefined)).toBe(true);
    expect(session.lifts[0]).toMatchObject({ verdict: null, reason: "pending" });
    expect(log).toHaveBeenCalledWith("Verdicts not computed, left pending:", expect.any(Error));
    spy.mockRestore();
    log.mockRestore();
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

// TICKET-082 review: a `deleted` marker keeps its `startedAt`, so as the newest of a plan it would
// answer the floor's lookup with no date and be asked again on every check.
describe("a plan's newest workout, for the floor", () => {
  const docOf = (sessionId: string, extra: object = {}) => ({ data: () => ({ sessionId, workoutId: "p", startedAt: 1, ...extra }) });
  const page = (docs: ReturnType<typeof docOf>[]) => ({ metadata: { fromCache: false }, empty: docs.length === 0, size: docs.length, docs });
  const reset = () => {
    (getDocsFromServer as jest.Mock).mockReset();
    (limit as jest.Mock).mockClear();
    (startAfter as jest.Mock).mockClear();
  };

  it("reads one doc, so the usual lookup costs one read", async () => {
    reset();
    (getDocsFromServer as jest.Mock).mockResolvedValue(page([docOf("live")]));
    await expect(getLastWorkoutOfPlan("u1", "p")).resolves.toMatchObject({ sessionId: "live" });
    expect(limit).toHaveBeenCalledWith(1);
    expect(getDocsFromServer).toHaveBeenCalledTimes(1);
    expect(startAfter).not.toHaveBeenCalled();
  });

  it("skips markers: each page continues after the marker before it, and the first workout that is not one is the answer", async () => {
    reset();
    const m1 = docOf("m1", { deleted: true });
    const m2 = docOf("m2", { deleted: true });
    (getDocsFromServer as jest.Mock).mockResolvedValueOnce(page([m1])).mockResolvedValueOnce(page([m2])).mockResolvedValueOnce(page([docOf("live")]));
    await expect(getLastWorkoutOfPlan("u1", "p")).resolves.toMatchObject({ sessionId: "live" });
    expect(getDocsFromServer).toHaveBeenCalledTimes(3);
    expect((startAfter as jest.Mock).mock.calls).toEqual([[m1], [m2]]);
  });

  it("answers never done when only markers exist", async () => {
    reset();
    (getDocsFromServer as jest.Mock).mockResolvedValueOnce(page([docOf("m1", { deleted: true })])).mockResolvedValueOnce(page([]));
    await expect(getLastWorkoutOfPlan("u1", "p")).resolves.toBeNull();
  });
});

describe("a page of workouts older than the phone holds", () => {
  const docOf = (sessionId: string, extra: object = {}) => ({ data: () => ({ sessionId, workoutId: "p", startedAt: 1, ...extra }) });
  const answer = (docs: ReturnType<typeof docOf>[]) => ({ metadata: { fromCache: false }, empty: docs.length === 0, size: docs.length, docs });
  const reset = () => {
    (getDocsFromServer as jest.Mock).mockReset();
    (limit as jest.Mock).mockClear();
    (startAfter as jest.Mock).mockClear();
    (where as jest.Mock).mockClear();
  };

  it("a full page of live workouts is one read of the page size, not yet the start", async () => {
    reset();
    (getDocsFromServer as jest.Mock).mockResolvedValue(answer([docOf("a"), docOf("b")]));
    await expect(getOlderWorkoutsPage("u1", 1_000, null, 2)).resolves.toMatchObject({ docsRead: 2, reachedStart: false });
    expect(limit).toHaveBeenCalledWith(2);
    expect(where).toHaveBeenCalledWith("startedAt", "<", 1_000);
    expect(where).not.toHaveBeenCalledWith("workoutId", "==", expect.anything());
  });

  it("asks again, for only what is missing, when markers shortened the page, and counts the markers read", async () => {
    reset();
    const marker = docOf("m", { deleted: true });
    (getDocsFromServer as jest.Mock).mockResolvedValueOnce(answer([docOf("a"), marker])).mockResolvedValueOnce(answer([docOf("b")]));
    const page = await getOlderWorkoutsPage("u1", 1_000, null, 2);
    expect(page.sessions.map((s) => s.sessionId)).toEqual(["a", "b"]);
    expect(page.docsRead).toBe(3);
    expect((limit as jest.Mock).mock.calls).toEqual([[2], [1]]);
    expect((startAfter as jest.Mock).mock.calls).toEqual([[marker]]);
  });

  it("a short answer is the start, and a plan filter adds only the plan to the query", async () => {
    reset();
    (getDocsFromServer as jest.Mock).mockResolvedValue(answer([docOf("a")]));
    await expect(getOlderWorkoutsPage("u1", 1_000, "push", 2)).resolves.toMatchObject({ reachedStart: true });
    expect(where).toHaveBeenCalledWith("workoutId", "==", "push");
  });
});

describe("a page of one lift's sessions older than the phone holds", () => {
  const docOf = (sessionId: string) => ({ data: () => ({ sessionId, workoutId: "p", startedAt: 1 }) });
  const answer = (docs: ReturnType<typeof docOf>[]) => ({ metadata: { fromCache: false }, empty: docs.length === 0, size: docs.length, docs });

  it("asks for the workouts that list the lift, before the edge, and says the start when the answer is short", async () => {
    (getDocsFromServer as jest.Mock).mockReset();
    (where as jest.Mock).mockClear();
    (getDocsFromServer as jest.Mock).mockResolvedValue(answer([docOf("a")]));
    await expect(getSessionsOfExercisePage("u1", "bench", 1_000, 2)).resolves.toMatchObject({ docsRead: 1, reachedStart: true });
    expect(where).toHaveBeenCalledWith("exerciseIds", "array-contains", "bench");
    expect(where).toHaveBeenCalledWith("startedAt", "<", 1_000);
    await expect(getSessionsOfExercisePage("u1", "", 1_000, 2)).rejects.toThrow("Missing exercise");
  });
});

// TICKET-083: a workout opened by id that the phone does not hold.
describe("one workout by id", () => {
  const live = { sessionId: "s1", workoutId: "push", workoutName: "Push", startedAt: 1, endedAt: 2, exerciseIds: [], lifts: [] };
  const answer = (data: object | null, hasPendingWrites = false) => ({
    metadata: { hasPendingWrites },
    exists: () => data !== null,
    data: () => data,
  });

  it("reads the one doc from the server, with its stamp as plain numbers and its lifts through the validator", async () => {
    (getDocFromServer as jest.Mock).mockResolvedValue(answer({ ...live, updatedAt: new Timestamp(5, 7) }));

    const session = await getWorkoutById("u1", "s1");

    expect(getDocFromServer).toHaveBeenCalledTimes(1);
    expect(getDocFromServer).toHaveBeenCalledWith("s1");
    expect(session).toMatchObject({ sessionId: "s1", updatedAt: { seconds: 5, nanoseconds: 7 }, lifts: [] });
    expect(session).not.toHaveProperty("liftsUnreadable");
  });

  it("is null for a missing doc and for a deleted marker, never a workout", async () => {
    (getDocFromServer as jest.Mock).mockResolvedValueOnce(answer(null));
    await expect(getWorkoutById("u1", "gone")).resolves.toBeNull();
    (getDocFromServer as jest.Mock).mockResolvedValueOnce(answer({ ...live, deleted: true }));
    await expect(getWorkoutById("u1", "s1")).resolves.toBeNull();
  });

  it("rejects, not answers, when the server cannot be reached or the doc holds this phone's unconfirmed write", async () => {
    (getDocFromServer as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("offline"), { code: "unavailable" }));
    await expect(getWorkoutById("u1", "s1")).rejects.toMatchObject({ code: "unavailable" });
    (getDocFromServer as jest.Mock).mockResolvedValueOnce(answer(live, true));
    await expect(getWorkoutById("u1", "s1")).rejects.toThrow("still queued");
  });
});

describe("a workout's note", () => {
  const txWith = (exists: boolean) => {
    const update = jest.fn();
    (runTransaction as jest.Mock).mockImplementation(async (_db, fn) => fn({ get: jest.fn().mockResolvedValue({ exists: () => exists }), update }));
    return update;
  };

  it("sets the note and moves the stamp, in a transaction so offline rejects instead of queueing", async () => {
    const update = txWith(true);
    await setWorkoutNote("u1", "s1", "Slept badly.");
    expect(runTransaction).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith("s1", { note: "Slept badly.", updatedAt: "SERVER_STAMP" });
  });

  it("removes the field for null, never stores an empty note", async () => {
    const update = txWith(true);
    await setWorkoutNote("u1", "s1", null);
    expect(update).toHaveBeenCalledWith("s1", { note: "DELETE_FIELD", updatedAt: "SERVER_STAMP" });
  });

  it("rejects with a not-found code, and writes nothing, for a workout that is not on the server", async () => {
    const update = txWith(false);
    await expect(setWorkoutNote("u1", "s1", "x")).rejects.toMatchObject({ code: "not-found" });
    expect(update).not.toHaveBeenCalled();
  });
});
