// TICKET-070 stage 1: the plans store's I/O, counted as server reads at the
// `getAllWorkoutPlans` boundary. Nothing here reaches Firestore.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAllWorkoutPlans } from "../services/db/userDB";
import { PLANS_STORAGE_KEY, usePlansStore } from "./usePlansStore";
import { PLANS_CHECK_WAIT_MS, serializeStoredPlans } from "../utils/planSync";
import type { WorkoutPlan } from "../types/workoutType";

jest.mock("../services/db/userDB", () => ({ getAllWorkoutPlans: jest.fn() }));

const reads = getAllWorkoutPlans as jest.Mock;
const plan = (id: string, name = id): WorkoutPlan => ({ id, name, exercises: [] });
const store = () => usePlansStore.getState();
// Timers are fake in every file (jest.setup.ts): this lets queued promises settle.
const tick = () => jest.advanceTimersByTimeAsync(0);
const stored = async () => JSON.parse((await AsyncStorage.getItem(PLANS_STORAGE_KEY)) ?? "null");

/** A read that answers only when told to. */
function deferredRead() {
  let answer!: (plans: WorkoutPlan[]) => void;
  reads.mockImplementationOnce(() => new Promise<WorkoutPlan[]>((resolve) => (answer = resolve)));
  return (plans: WorkoutPlan[]) => answer(plans);
}

beforeEach(async () => {
  store().clear();
  await AsyncStorage.clear();
  reads.mockReset();
});

it("hub, Start, Manage within 2 minutes: one read (D4)", async () => {
  reads.mockResolvedValue([plan("a")]);
  await store().open("u1");
  await store().open("u1");
  await store().open("u1");
  expect(reads).toHaveBeenCalledTimes(1);
  await store().check({ force: true });
  expect(reads).toHaveBeenCalledTimes(2);
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

it("offline: the stored copy shows, and a failed check moves neither it nor the skip (D11)", async () => {
  await AsyncStorage.setItem(PLANS_STORAGE_KEY, serializeStoredPlans("u1", [plan("a")]));
  reads.mockRejectedValue(new Error("unavailable"));
  await store().open("u1");
  expect(store()).toMatchObject({ plans: [plan("a")], source: "stored", lastResult: "failed", lastOkAt: null });
  await store().open("u1");
  expect(reads).toHaveBeenCalledTimes(2);
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
  store().applySaved("u1", epoch, plan("b"));
  expect(store().plans).toEqual([plan("a")]);
});

it("another user opening a plans screen clears the first user's plans", async () => {
  reads.mockResolvedValueOnce([plan("a")]);
  await store().open("u1");
  reads.mockRejectedValueOnce(new Error("unavailable"));
  await store().open("u2");
  expect(store()).toMatchObject({ uid: "u2", plans: null });
});

it("a confirmed Save updates the store and the stored copy with no read (D8)", async () => {
  reads.mockResolvedValue([plan("a")]);
  await store().open("u1");
  store().applySaved("u1", store().epoch, plan("b"));
  expect(store().plans).toEqual([plan("a"), plan("b")]);
  await tick();
  expect((await stored()).plans).toEqual([plan("a"), plan("b")]);
  expect(reads).toHaveBeenCalledTimes(1);
});

it("a check that started before a Save cannot undo it when it answers", async () => {
  reads.mockResolvedValueOnce([plan("a")]);
  await store().open("u1");
  const answer = deferredRead();
  const checking = store().check({ force: true });
  await tick();
  store().applySaved("u1", store().epoch, plan("a", "A2"));
  answer([plan("a")]);
  await checking;
  expect(store().plans).toEqual([plan("a", "A2")]);
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
    store().applySaved("u1", epoch, plan("b"));
    await tick(); // the first write has read [a, b] and is stuck
    store().applySaved("u1", epoch, plan("c"));
    await tick();
    release();
    await tick();
    expect((await stored()).plans.map((p: WorkoutPlan) => p.id)).toEqual(["a", "b", "c"]);
  } finally {
    setItem.mockRestore();
  }
});
