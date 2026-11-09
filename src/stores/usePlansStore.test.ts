// TICKET-070: the plans store's I/O, counted as server reads at the
// `getAllWorkoutPlans` (full reload) and `getChangedPlans` (change check)
// boundary. Nothing here reaches Firestore.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAllWorkoutPlans, getChangedPlans, getPlanFromServer } from "../services/db/userDB";
import { usePlansStore } from "./usePlansStore";
import { serializeStoredPlans } from "../utils/planSync";
import type { PlanStamp, WorkoutPlan } from "../types/workoutType";
import type { VersionedPlan } from "../utils/planVersion";
import { PLANS_CHECK_WAIT_MS } from "../config/sync";
import { PLANS_STORAGE_KEY } from "../config/storageKeys";

jest.mock("../services/db/userDB", () => ({ getAllWorkoutPlans: jest.fn(), getChangedPlans: jest.fn(), getPlanFromServer: jest.fn() }));

const reads = getAllWorkoutPlans as jest.Mock;
const changes = getChangedPlans as jest.Mock;
const onePlan = getPlanFromServer as jest.Mock;
const plan = (id: string, name = id): WorkoutPlan => ({ id, name, exercises: [] });
const at = (seconds: number, nanoseconds = 0): PlanStamp => ({ seconds, nanoseconds });
const stamped = (id: string, stamp: PlanStamp, name = id): WorkoutPlan => ({ ...plan(id, name), updatedAt: stamp });
/** A plan (default "a") at version `rev`, as a Save holds it before any check returns it. */
const unstamped = (rev: number, name: string, id = "a"): VersionedPlan => ({
  ...plan(id, name),
  version: { rev, id: `v${rev}`, base: rev > 1 ? `v${rev - 1}` : null },
});
const revved = (rev: number, name: string, stamp = at(5)): WorkoutPlan => ({ ...unstamped(rev, name), updatedAt: stamp });
const store = () => usePlansStore.getState();
// Timers are fake in every file (jest.setup.ts): this lets queued promises settle.
const tick = () => jest.advanceTimersByTimeAsync(0);
const stored = async () => JSON.parse((await AsyncStorage.getItem(PLANS_STORAGE_KEY)) ?? "null");

/** A read that answers only when told to. */
function deferredRead(mock = reads) {
  let answer!: (plans: WorkoutPlan[]) => void;
  mock.mockImplementationOnce(() => new Promise<WorkoutPlan[]>((resolve) => (answer = resolve)));
  return (plans: WorkoutPlan[]) => answer(plans);
}

beforeEach(async () => {
  store().clear();
  await AsyncStorage.clear();
  reads.mockReset();
  changes.mockReset().mockResolvedValue([]);
  onePlan.mockReset();
});

it("hub, Start, Manage within the check skip: one read (D4)", async () => {
  reads.mockResolvedValue([plan("a")]);
  await store().open("u1");
  await store().open("u1");
  await store().open("u1");
  expect(reads).toHaveBeenCalledTimes(1);
  expect(changes).not.toHaveBeenCalled();
  await store().check({ force: true });
  expect(changes).toHaveBeenCalledTimes(1);
});

it("a check that finds nothing changed: one change query from lastSeen, 0 docs, the store as it was (D3)", async () => {
  await AsyncStorage.setItem(
    PLANS_STORAGE_KEY,
    serializeStoredPlans("u1", { plans: [stamped("a", at(5, 400))], lastSeen: at(5, 400), lastFullAt: Date.now() })
  );
  await store().open("u1");
  const before = store().plans;
  await tick();
  const disk = await stored();
  expect(reads).not.toHaveBeenCalled();
  expect(changes).toHaveBeenCalledTimes(1);
  expect(changes).toHaveBeenCalledWith("u1", at(5, 400));
  expect(store().plans).toBe(before);
  expect(store().lastSeen).toEqual(at(5, 400));
  expect(await stored()).toEqual(disk);
});

it("a change check merges what changed and moves lastSeen; the next one starts there", async () => {
  reads.mockResolvedValue([stamped("a", at(5)), plan("old")]);
  await store().open("u1");
  changes.mockResolvedValueOnce([stamped("a", at(7, 300), "A2")]);
  await store().check({ force: true });
  expect(store().plans?.map((p) => p.name)).toEqual(["A2", "old"]);
  await store().check({ force: true });
  expect(changes).toHaveBeenLastCalledWith("u1", at(7, 300));
});

// TICKET-076: was "due after the interval"; no timer now. A full reload is what
// is asked for, and it still replaces the copy whole.
it("a copy held with an old lastFullAt gets a change check, not a full read (TICKET-076)", async () => {
  await AsyncStorage.setItem(
    PLANS_STORAGE_KEY,
    serializeStoredPlans("u1", { plans: [stamped("a", at(5))], lastSeen: at(5), lastFullAt: 0 })
  );
  await store().open("u1");
  expect(reads).not.toHaveBeenCalled();
  expect(changes).toHaveBeenCalledTimes(1);
});

it("a full reload asked for replaces the stored copy whole (D5)", async () => {
  reads.mockResolvedValueOnce([stamped("a", at(5)), stamped("gone", at(4))]);
  await store().open("u1");
  reads.mockResolvedValueOnce([stamped("a", at(5))]);
  await store().check({ force: true, full: true });
  expect(reads).toHaveBeenCalledTimes(2);
  expect(store().plans?.map((p) => p.id)).toEqual(["a"]);
});

it("a trigger while a check runs joins it instead of reading again (D9)", async () => {
  const answer = deferredRead();
  const first = store().open("u1");
  await tick();
  const second = store().check({ force: true });
  answer([plan("a")]);
  await Promise.all([first, second]);
  expect(reads).toHaveBeenCalledTimes(1);
  expect(store().plans).toEqual([plan("a")]);
});

it("offline: the stored copy shows, and a failed check moves none of it, lastSeen, the skip or the full-reload time (D11)", async () => {
  const held = { plans: [stamped("a", at(5))], lastSeen: at(5), lastFullAt: Date.now() };
  await AsyncStorage.setItem(PLANS_STORAGE_KEY, serializeStoredPlans("u1", held));
  changes.mockRejectedValue(new Error("unavailable"));
  await store().open("u1");
  expect(store()).toMatchObject({ ...held, source: "stored", lastResult: "failed", lastOkAt: null });
  await store().open("u1");
  expect(changes).toHaveBeenCalledTimes(2);
  reads.mockRejectedValue(new Error("unavailable"));
  await store().check({ force: true, full: true });
  expect(store()).toMatchObject({ ...held, lastOkAt: null });
});

it("nothing stored: past the wait the screen fails, and a late answer still applies (D9, D12)", async () => {
  const answer = deferredRead();
  const opening = store().open("u1");
  await tick();
  expect(store()).toMatchObject({ plans: null, checking: true, waitOver: false });
  await jest.advanceTimersByTimeAsync(PLANS_CHECK_WAIT_MS);
  expect(store()).toMatchObject({ plans: null, checking: true, waitOver: true });
  answer([plan("a")]);
  await opening;
  expect(store()).toMatchObject({ plans: [plan("a")], checking: false, waitOver: false });
});

it("sign-out: a check or Save landing after the clear does not refill the store (D2)", async () => {
  const answer = deferredRead();
  const opening = store().open("u1");
  await tick();
  expect(reads).toHaveBeenCalledTimes(1);
  const epoch = store().epoch;
  store().clear();
  answer([plan("a")]);
  await opening;
  expect(store()).toMatchObject({ uid: null, plans: null });
  await tick();
  expect(await stored()).toBeNull();
  // Signed back in as the same user: a Save from before sign-out still lands nowhere.
  reads.mockResolvedValue([plan("a")]);
  await store().open("u1");
  store().applySaved("u1", epoch, unstamped(1, "b"));
  expect(store().plans).toEqual([plan("a")]);
});

it("another user opening a plans screen clears the first user's plans", async () => {
  reads.mockResolvedValueOnce([plan("a")]);
  await store().open("u1");
  reads.mockRejectedValueOnce(new Error("unavailable"));
  await store().open("u2");
  expect(store()).toMatchObject({ uid: "u2", plans: null });
});

it("a confirmed Save shows at once for 0 reads; the next check stamps it and moves lastSeen past it (D8)", async () => {
  reads.mockResolvedValue([revved(1, "A1")]);
  await store().open("u1");
  store().applySaved("u1", store().epoch, unstamped(2, "A2"));
  expect(store().plans).toEqual([unstamped(2, "A2")]);
  expect(changes).not.toHaveBeenCalled();
  expect(reads).toHaveBeenCalledTimes(1);
  await tick();
  expect((await stored()).plans).toEqual([unstamped(2, "A2")]);
  changes.mockResolvedValueOnce([revved(2, "A2", at(7))]);
  await store().check({ force: true });
  expect(store().plans).toEqual([revved(2, "A2", at(7))]);
  expect(store().lastSeen).toEqual(at(7));
});

it("a Save a check already brought stays stamped, and one older than what is held does not go in (D10)", async () => {
  reads.mockResolvedValue([revved(2, "A2", at(7))]);
  await store().open("u1");
  store().applySaved("u1", store().epoch, unstamped(2, "A2"));
  expect(store().plans).toEqual([revved(2, "A2", at(7))]);
  store().applySaved("u1", store().epoch, unstamped(1, "A1"));
  expect(store().plans).toEqual([revved(2, "A2", at(7))]);
});

it("a Save with nothing stored leaves nothing stored, not a list of one (D11)", async () => {
  reads.mockRejectedValueOnce(new Error("unavailable"));
  await store().open("u1");
  store().applySaved("u1", store().epoch, unstamped(1, "A1"));
  expect(store().plans).toBeNull();
});

it("a full reload resets lastSeen from what it holds: a stamp in the future cannot pin it (PR #49, S1)", async () => {
  // A hand edit in the console set `updatedAt` a year ahead; that plan was
  // saved again since, with a real stamp.
  const held = { plans: [stamped("a", at(9_999))], lastSeen: at(9_999), lastFullAt: Date.now() };
  await AsyncStorage.setItem(PLANS_STORAGE_KEY, serializeStoredPlans("u1", held));
  reads.mockResolvedValueOnce([stamped("a", at(7)), stamped("b", at(6))]);
  await store().open("u1", { check: false });
  await store().check({ force: true, full: true });
  expect(store().lastSeen).toEqual(at(7));
  await store().check({ force: true });
  expect(changes).toHaveBeenLastCalledWith("u1", at(7));
});

it("a check that started before a Save cannot undo it when it answers (D10)", async () => {
  reads.mockResolvedValueOnce([revved(1, "A1")]);
  await store().open("u1");
  const answer = deferredRead(changes);
  const checking = store().check({ force: true });
  await tick();
  store().applySaved("u1", store().epoch, unstamped(2, "A2"));
  answer([revved(1, "from before the Save", at(6))]);
  await checking;
  expect(store().plans).toEqual([unstamped(2, "A2")]);
  expect(store().lastSeen).toEqual(at(6));
});

it("Try again on a check past its wait reads afresh; the stalled read, landing late, is dropped", async () => {
  const stalled = deferredRead();
  const opening = store().open("u1");
  await jest.advanceTimersByTimeAsync(PLANS_CHECK_WAIT_MS);
  expect(store().waitOver).toBe(true);
  reads.mockResolvedValueOnce([plan("b")]);
  await store().check({ force: true, full: true });
  expect(reads).toHaveBeenCalledTimes(2);
  expect(store().plans).toEqual([plan("b")]);
  stalled([plan("a")]);
  await opening;
  expect(store().plans).toEqual([plan("b")]);
});

// TICKET-073 D7: a refused Save reloads its plan by reading that one plan
// from the server (user, 2026-11-07: no change check first).
describe("reloadRefused", () => {
  // Device run, 2026-11-07: a Save chained on a refused offline Save is made
  // on a version this phone never held (b5); the guess "the plan came back"
  // kept the stale copy. Now the plan is always read, and nothing else.
  it("reads that one plan from the server and takes it, with no change check", async () => {
    reads.mockResolvedValue([revved(4, "stale")]);
    await store().open("u1");
    changes.mockClear();
    onePlan.mockResolvedValueOnce(revved(5, "other device", at(9)));
    const chained = { rev: 6, id: "b6", base: "b5" };
    const result = await store().reloadRefused("u1", store().epoch, "a", chained, true);
    expect(onePlan).toHaveBeenCalledTimes(1);
    expect(changes).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: "reloaded", plan: revved(5, "other device", at(9)) });
    expect(store().plans).toEqual([revved(5, "other device", at(9))]);
    await tick();
    expect((await stored()).plans).toEqual([revved(5, "other device", at(9))]);
  });

  it("the server's copy wins even at a lower rev (a rev lowered by hand), where D10 would keep the held one", async () => {
    reads.mockResolvedValue([revved(3, "mine")]);
    await store().open("u1");
    onePlan.mockResolvedValueOnce(revved(1, "reset by hand", at(9)));
    const result = await store().reloadRefused("u1", store().epoch, "a", { rev: 4, id: "b4", base: "v3" }, false);
    expect(result).toEqual({ kind: "reloaded", plan: revved(1, "reset by hand", at(9)) });
    expect(store().plans).toEqual([revved(1, "reset by hand", at(9))]);
  });
});
