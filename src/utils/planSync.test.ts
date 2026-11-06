// TICKET-070 stage 1: the decisions behind the phone's copy of the plans.

import {
  PLANS_CHECK_SKIP_MS,
  PLANS_FORMAT_VERSION,
  plansView,
  readStoredPlans,
  serializeStoredPlans,
  shouldSkipCheck,
  withSavedPlan,
  type PlansState,
} from "./planSync";
import type { WorkoutPlan } from "../types/workoutType";

const plan = (id: string, name = id): WorkoutPlan => ({ id, name, exercises: [] });

describe("readStoredPlans: anything but this user's copy in this format is nothing stored (D11)", () => {
  it("reads back what was stored, including no plans", () => {
    expect(readStoredPlans(serializeStoredPlans("u1", [plan("a")]), "u1")).toEqual({ plans: [plan("a")], error: null });
    expect(readStoredPlans(serializeStoredPlans("u1", []), "u1").plans).toEqual([]);
  });

  it.each([
    ["absent", null, null],
    ["unreadable JSON", "{", "unreadable JSON"],
    ["another format version", JSON.stringify({ formatVersion: PLANS_FORMAT_VERSION + 1, uid: "u1", plans: [] }), "format version"],
    ["another user's copy", serializeStoredPlans("u2", [plan("a")]), "another user"],
    ["a plan with no exercises list", JSON.stringify({ formatVersion: PLANS_FORMAT_VERSION, uid: "u1", plans: [{ id: "a", name: "A" }] }), "unknown shape"],
  ])("%s → null", (_label, raw, error) => {
    const read = readStoredPlans(raw, "u1");
    expect(read.plans).toBeNull();
    if (error === null) expect(read.error).toBeNull();
    else expect(read.error).toContain(error);
  });
});

describe("shouldSkipCheck (D4)", () => {
  it("skips only within 2 minutes of a success, and never when forced", () => {
    expect(shouldSkipCheck(null, 1_000)).toBe(false);
    expect(shouldSkipCheck(0, PLANS_CHECK_SKIP_MS - 1)).toBe(true);
    expect(shouldSkipCheck(0, PLANS_CHECK_SKIP_MS)).toBe(false);
    expect(shouldSkipCheck(0, 1, true)).toBe(false);
  });
});

describe("withSavedPlan (D8, D13)", () => {
  it("replaces a saved plan where it stands", () => {
    expect(withSavedPlan([plan("a"), plan("b"), plan("c")], plan("b", "B2")).map((p) => p.name)).toEqual(["a", "B2", "c"]);
  });

  it("puts a new plan where a full read would: in id order", () => {
    expect(withSavedPlan([plan("Ab"), plan("x")], plan("b")).map((p) => p.id)).toEqual(["Ab", "b", "x"]);
    expect(withSavedPlan([plan("a")], plan("z")).map((p) => p.id)).toEqual(["a", "z"]);
  });

  it("leaves nothing stored as nothing stored, not a list of one", () => {
    expect(withSavedPlan(null, plan("a"))).toBeNull();
  });
});

describe("plansView (D11, D12)", () => {
  const state = (over: Partial<PlansState>): PlansState => ({
    plans: null,
    storedRead: true,
    checking: false,
    waitOver: false,
    lastResult: null,
    ...over,
  });

  it("stored, no plans, and a failed check: no plans, not failed", () => {
    expect(plansView(state({ plans: [], lastResult: "failed" }))).toMatchObject({ loadingWorkoutPlans: false, failedToLoad: false });
  });

  it("nothing stored: loading while a check runs within its wait, failed past it or after a failure", () => {
    expect(plansView(state({ checking: true }))).toMatchObject({ loadingWorkoutPlans: true, failedToLoad: false });
    expect(plansView(state({ checking: true, waitOver: true }))).toMatchObject({ loadingWorkoutPlans: false, failedToLoad: true });
    expect(plansView(state({ lastResult: "failed" }))).toMatchObject({ loadingWorkoutPlans: false, failedToLoad: true });
  });
});
