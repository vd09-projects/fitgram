// TICKET-051 D4: Save shows "saved" only when this resolves, so a write it
// skips must reject instead of logging and returning.

import { getDocsFromServer, setDoc } from "firebase/firestore";
import { getAllWorkoutPlans, overrideWorkoutDetails } from "./userDB";

jest.mock("../firebase/firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  ...jest.requireActual("firebase/firestore"),
  collection: jest.fn(),
  doc: jest.fn(() => "ref"),
  getDocsFromServer: jest.fn(),
  setDoc: jest.fn(async () => {}),
}));

it("rejects a plan with no exercises instead of skipping the write silently", async () => {
  await expect(overrideWorkoutDetails("uid", { id: "push", name: "Push", exercises: [] })).rejects.toThrow(
    "Missing user, plan id or exercises"
  );
});

// TICKET-070 D11: plans come from the server, never Firestore's cache, and a
// failed read rejects, so it is never mistaken for "no plans" or "no change".
describe("getAllWorkoutPlans", () => {
  it("rejects when the server read fails, instead of returning an empty list", async () => {
    (getDocsFromServer as jest.Mock).mockRejectedValue(new Error("unavailable"));
    await expect(getAllWorkoutPlans("uid")).rejects.toThrow("unavailable");
  });

  it("returns the server's plans, and an empty list as no plans", async () => {
    const doc = { id: "push", data: () => ({ name: "Push", exercises: [] }) };
    (getDocsFromServer as jest.Mock).mockResolvedValue({ docs: [doc] });
    expect(await getAllWorkoutPlans("uid")).toEqual([{ id: "push", name: "Push", exercises: [] }]);
    (getDocsFromServer as jest.Mock).mockResolvedValue({ docs: [] });
    expect(await getAllWorkoutPlans("uid")).toEqual([]);
  });
});

// TICKET-061: Archive and Unarchive are stored by Save, a complete overwrite,
// so it must write the archive state it was given.
describe("archive state", () => {
  const bench = { id: "bench", name: "", fields: [{ name: "Reps", role: "reps" as const }] };

  it("Save keeps the archived flag in the overwrite", async () => {
    await overrideWorkoutDetails("uid", { id: "push", name: "Push", exercises: [bench], archived: true });
    expect((setDoc as jest.Mock).mock.calls.at(-1)?.[1]).toMatchObject({ archived: true });
  });

  it("Save of an unarchived plan writes no flag, which reads as not archived", async () => {
    await overrideWorkoutDetails("uid", { id: "push", name: "Push", exercises: [bench] });
    expect("archived" in (setDoc as jest.Mock).mock.calls.at(-1)?.[1]).toBe(false);
  });
});
