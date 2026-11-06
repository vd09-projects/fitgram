// TICKET-070: the plans store's I/O, counted as server reads at the
// `getAllWorkoutPlans` (full reload) and `getChangedPlans` (change check)
// boundary. Nothing here reaches Firestore.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAllWorkoutPlans, getChangedPlans } from "../services/db/userDB";
import { PLANS_STORAGE_KEY, usePlansStore } from "./usePlansStore";
import {
  PLANS_CHECK_SKIP_MS,
  PLANS_CHECK_WAIT_MS,
  PLANS_FULL_RELOAD_INTERVAL_MS,
  serializeStoredPlans,
} from "../utils/planSync";
import type { PlanStamp, WorkoutPlan } from "../types/workoutType";

jest.mock("../services/db/userDB", () => ({ getAllWorkoutPlans: jest.fn(), getChangedPlans: jest.fn() }));

const reads = getAllWorkoutPlans as jest.Mock;
const changes = getChangedPlans as jest.Mock;
const plan = (id: string, name = id): WorkoutPlan => ({ id, name, exercises: [] });
const at = (seconds: number, nanoseconds = 0): PlanStamp => ({ seconds, nanoseconds });
const stamped = (id: string, stamp: PlanStamp, name = id): WorkoutPlan => ({ ...plan(id, name), updatedAt: stamp });
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
});

it("hub, Start, Manage within 2 minutes: one read (D4)", async () => {
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

it("a full reload is due after the interval, and replaces the stored copy whole (D5)", async () => {
  reads.mockResolvedValueOnce([stamped("a", at(5)), stamped("gone", at(4))]);
  await store().open("u1");
  await jest.advanceTimersByTimeAsync(PLANS_FULL_RELOAD_INTERVAL_MS - 1);
  await store().open("u1");
  expect(reads).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(PLANS_CHECK_SKIP_MS);
  reads.mockResolvedValueOnce([stamped("a", at(5))]);
  await store().open("u1");
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
  await store().applySaved("u1", epoch, plan("b"));
  expect(store().plans).toEqual([plan("a")]);
});

it("another user opening a plans screen clears the first user's plans", async () => {
  reads.mockResolvedValueOnce([plan("a")]);
  await store().open("u1");
  reads.mockRejectedValueOnce(new Error("unavailable"));
  await store().open("u2");
  expect(store()).toMatchObject({ uid: "u2", plans: null });
});

it("a confirmed Save goes into the store stamped, read back by one change query; the next check gets 0 docs (D8)", async () => {
  reads.mockResolvedValue([stamped("a", at(5))]);
  await store().open("u1");
  changes.mockResolvedValueOnce([stamped("b", at(6))]);
  await store().applySaved("u1", store().epoch, plan("b"));
  expect(store().plans).toEqual([stamped("a", at(5)), stamped("b", at(6))]);
  expect(store().lastSeen).toEqual(at(6));
  await tick();
  expect((await stored()).plans).toEqual([stamped("a", at(5)), stamped("b", at(6))]);
  expect(reads).toHaveBeenCalledTimes(1);
  await store().check({ force: true });
  expect(changes).toHaveBeenLastCalledWith("u1", at(6));
});

it("a Save whose read-back fails still shows, unstamped, and lifts the skip so the next screen checks", async () => {
  reads.mockResolvedValue([stamped("a", at(5))]);
  await store().open("u1");
  changes.mockRejectedValueOnce(new Error("unavailable"));
  await store().applySaved("u1", store().epoch, plan("a", "A2"));
  expect(store()).toMatchObject({ plans: [plan("a", "A2")], lastSeen: at(5), lastOkAt: null });
});

it("a check that started before a Save cannot undo it when it answers (D10)", async () => {
  reads.mockResolvedValueOnce([stamped("a", at(5))]);
  await store().open("u1");
  const answer = deferredRead(changes);
  const checking = store().check({ force: true });
  await tick();
  changes.mockResolvedValueOnce([stamped("a", at(7), "A2")]);
  await store().applySaved("u1", store().epoch, plan("a", "A2"));
  answer([stamped("a", at(6), "from another phone, before the Save")]);
  await checking;
  expect(store().plans).toEqual([stamped("a", at(7), "A2")]);
  expect(store().lastSeen).toEqual(at(7));
});

it("stored writes land in order: a slow older write cannot land last", async () => {
  reads.mockResolvedValue([plan("a")]);
  await store().open("u1");
  await tick();
  const realSetItem = AsyncStorage.setItem.bind(AsyncStorage);
  let release!: () => void;
  const setItem = jest.spyOn(AsyncStorage, "setItem").mockImplementationOnce(async (key, value) => {
    await new Promise<void>((resolve) => (release = resolve));
    return realSetItem(key, value);
  });
  try {
    const epoch = store().epoch;
    await store().applySaved("u1", epoch, plan("b"));
    await tick(); // the first write has read [a, b] and is stuck
    await store().applySaved("u1", epoch, plan("c"));
    await tick();
    release();
    await tick();
    expect((await stored()).plans.map((p: WorkoutPlan) => p.id)).toEqual(["a", "b", "c"]);
  } finally {
    setItem.mockRestore();
  }
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
