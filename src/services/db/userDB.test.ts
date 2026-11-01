// TICKET-051 D4: Save shows "saved" only when this resolves, so a write it
// skips must reject instead of logging and returning.

import { getDocs, setDoc, updateDoc } from "firebase/firestore";
import { getAllWorkoutPlans, overrideWorkoutDetails, setPlanArchived } from "./userDB";

jest.mock("../firebase/firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  ...jest.requireActual("firebase/firestore"),
  collection: jest.fn(),
  doc: jest.fn(() => "ref"),
  getDocs: jest.fn(),
  setDoc: jest.fn(async () => {}),
  updateDoc: jest.fn(async () => {}),
}));

const snapshot = (fromCache: boolean, docs: { id: string; data: () => object }[]) => ({
  metadata: { fromCache },
  empty: docs.length === 0,
  docs,
});

it("rejects a plan with no exercises instead of skipping the write silently", async () => {
  await expect(overrideWorkoutDetails("uid", { id: "push", name: "Push", exercises: [] })).rejects.toThrow(
    "Missing user, plan id or exercises"
  );
});

// TICKET-052 D5: offline, getDocs resolves with the (empty, on a cold start)
// cache instead of rejecting; that must not read as "no plans yet".
describe("getAllWorkoutPlans", () => {
  it("fails on an empty list that came from the cache", async () => {
    (getDocs as jest.Mock).mockResolvedValue(snapshot(true, []));
    await expect(getAllWorkoutPlans("uid")).rejects.toThrow("Plans unavailable offline");
  });

  it("returns cached plans, and an empty list from the server", async () => {
    const doc = { id: "push", data: () => ({ name: "Push", exercises: [] }) };
    (getDocs as jest.Mock).mockResolvedValue(snapshot(true, [doc]));
    expect(await getAllWorkoutPlans("uid")).toEqual([{ id: "push", name: "Push", exercises: [] }]);
    (getDocs as jest.Mock).mockResolvedValue(snapshot(false, []));
    expect(await getAllWorkoutPlans("uid")).toEqual([]);
  });
});

// TICKET-061: Save is a complete overwrite, so it must write the archive state
// it was given; archiving is its own small write.
describe("archive state", () => {
  const bench = { id: "bench", name: "", fields: [{ name: "Reps", role: "reps" as const }] };

  it("Save keeps the archived flag in the overwrite", async () => {
    await overrideWorkoutDetails("uid", { id: "push", name: "Push", exercises: [bench], archived: true });
    expect((setDoc as jest.Mock).mock.calls.at(-1)?.[1]).toMatchObject({ archived: true });
  });

  it("archives with true and unarchives with false", async () => {
    await setPlanArchived("uid", "push", true);
    expect((updateDoc as jest.Mock).mock.calls.at(-1)?.[1]).toEqual({ archived: true });
    await setPlanArchived("uid", "push", false);
    expect((updateDoc as jest.Mock).mock.calls.at(-1)?.[1]).toEqual({ archived: false });
  });
});
