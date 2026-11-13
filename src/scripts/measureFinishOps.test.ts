// TICKET-087 stage 2, updated by TICKET-081 stage 2 (17 writes before it put the verdicts on the
// session in the stats transaction; 10 after TICKET-085 drops exercise_sessions): Firestore operations of one Finish, counted by running
// the real `saveWorkoutSession` with the Firestore calls replaced by counters.
// A measurement that also guards: if a later change adds a write per Finish,
// this goes red and the History tickets' write counts need the new number.
import { runTransaction, writeBatch } from "firebase/firestore";
import { saveWorkoutSession } from "../services/db/workoutSessions";
import { buildExercise, buildWorkout } from "../test/fixtures";

jest.mock("../services/firebase/firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  ...jest.requireActual("firebase/firestore"),
  collection: jest.fn(),
  doc: jest.fn((_ref: unknown, id: string) => id),
  writeBatch: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => "SERVER_STAMP"),
}));

const LIFTS = 8;
const SETS = 5;

it("one Finish of 8 lifts issues 18 writes and 8 reads", async () => {
  const batchSet = jest.fn();
  const commit = jest.fn().mockResolvedValue(undefined);
  (writeBatch as jest.Mock).mockReturnValue({ set: batchSet, commit });
  const txGet = jest.fn().mockResolvedValue({ exists: () => false });
  const txSet = jest.fn();
  (runTransaction as jest.Mock).mockImplementation(async (_db, fn) => fn({ get: txGet, set: txSet }));

  const exercises = Array.from({ length: LIFTS }, (_, i) =>
    buildExercise(`Lift ${i}`, {
      sets: Array.from({ length: SETS }, (_, s) => ({ id: s + 1, segments: [{ Weight: 60, Reps: 5 }] })),
    })
  );
  await saveWorkoutSession("u1", buildWorkout([], { id: "plan-a", startTime: 1_000, exercises }), 2_000);

  const measured = {
    batchCommits: commit.mock.calls.length,
    transactions: (runTransaction as jest.Mock).mock.calls.length,
    writes: batchSet.mock.calls.length + txSet.mock.calls.length,
    reads: txGet.mock.calls.length,
  };
  console.log(`Finish, ${LIFTS} lifts: ${JSON.stringify(measured)}`);
  expect(measured).toEqual({ batchCommits: 1, transactions: 1, writes: 2 * LIFTS + 2, reads: LIFTS });
});
