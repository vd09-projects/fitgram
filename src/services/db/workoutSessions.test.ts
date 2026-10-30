// TICKET-047 (device, 2026-10-31): offline, getDocs resolves from the memory
// cache, empty on a cold start, instead of rejecting. Read as an answer, every
// exercise was "never done" and the logger said "First time".

import { getDocs } from "firebase/firestore";
import { getExerciseStats } from "./workoutSessions";

jest.mock("../firebase/firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  ...jest.requireActual("firebase/firestore"),
  collection: jest.fn(),
  documentId: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
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
