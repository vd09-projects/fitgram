// TICKET-051 D4: Save shows "saved" only when this resolves, so a write it
// skips must reject instead of logging and returning.

import { Timestamp, getDocsFromServer, setDoc, where } from "firebase/firestore";
import { getAllWorkoutPlans, getChangedPlans, overrideWorkoutDetails } from "./userDB";

jest.mock("../firebase/firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  ...jest.requireActual("firebase/firestore"),
  collection: jest.fn(),
  doc: jest.fn(() => "ref"),
  getDocsFromServer: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP"),
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
    await overrideWorkoutDetails("uid", { id: "push", name: "Push", exercises: [bench], archived: true, rev: 1 });
    expect((setDoc as jest.Mock).mock.calls.at(-1)?.[1]).toMatchObject({ archived: true });
  });

  it("Save of an unarchived plan writes no flag, which reads as not archived", async () => {
    await overrideWorkoutDetails("uid", { id: "push", name: "Push", exercises: [bench], rev: 1 });
    expect("archived" in (setDoc as jest.Mock).mock.calls.at(-1)?.[1]).toBe(false);
  });
});

// TICKET-070 D3: every Save stamps the plan with the server's time, and the
// change check asks for exactly what came after `lastSeen`.
describe("updatedAt", () => {
  const bench = { id: "bench", name: "", fields: [{ name: "Reps", role: "reps" as const }] };

  it("Save writes the server's stamp, never the one the plan was read with", async () => {
    await overrideWorkoutDetails("uid", { id: "push", name: "Push", exercises: [bench], updatedAt: { seconds: 1, nanoseconds: 0 }, rev: 1 });
    expect((setDoc as jest.Mock).mock.calls.at(-1)?.[1].updatedAt).toBe("SERVER_TIMESTAMP");
  });

  it("the change check asks for updatedAt > lastSeen to the nanosecond, and reads stamps as plain numbers", async () => {
    const doc = { id: "push", data: () => ({ name: "Push", exercises: [], updatedAt: new Timestamp(5, 123_456_000) }) };
    (getDocsFromServer as jest.Mock).mockResolvedValue({ docs: [doc] });
    const plans = await getChangedPlans("uid", { seconds: 5, nanoseconds: 400 });
    expect(where).toHaveBeenLastCalledWith("updatedAt", ">", new Timestamp(5, 400));
    expect(plans).toEqual([{ id: "push", name: "Push", exercises: [], updatedAt: { seconds: 5, nanoseconds: 123_456_000 } }]);
  });
});

// TICKET-073 D6: Save writes the plan's new rev; without one the rules would
// refuse it, and the refusal would read as "changed on another device".
it("Save writes the rev it is given, and refuses a plan with none", async () => {
  const bench = { id: "bench", name: "", fields: [{ name: "Reps", role: "reps" as const }] };
  await overrideWorkoutDetails("uid", { id: "push", name: "Push", exercises: [bench], rev: 4 });
  expect((setDoc as jest.Mock).mock.calls.at(-1)?.[1].rev).toBe(4);
  await expect(overrideWorkoutDetails("uid", { id: "push", name: "Push", exercises: [bench] })).rejects.toThrow("no rev");
});
