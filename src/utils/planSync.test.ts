// TICKET-070: the decisions behind the phone's copy of the plans.

import {
  PLANS_CHECK_SKIP_MS,
  PLANS_FORMAT_VERSION,
  PLANS_FULL_RELOAD_INTERVAL_MS,
  changeCheckAfter,
  isFullReloadDue,
  lastSeenAfter,
  mergeChanges,
  mergeFullReload,
  plansView,
  readStoredPlans,
  serializeStoredPlans,
  shouldSkipCheck,
  toPlanStamp,
  withSavedPlan,
  type PlansState,
} from "./planSync";
import type { PlanStamp, WorkoutPlan } from "../types/workoutType";

const plan = (id: string, name = id): WorkoutPlan => ({ id, name, exercises: [] });
const at = (seconds: number, nanoseconds = 0): PlanStamp => ({ seconds, nanoseconds });
const stamped = (id: string, stamp: PlanStamp, name = id): WorkoutPlan => ({ ...plan(id, name), updatedAt: stamp });
const held = (plans: WorkoutPlan[]) => ({ plans, lastSeen: at(5, 1_000), lastFullAt: 123 });
const names = (plans: WorkoutPlan[] | null) => plans?.map((p) => p.name);

describe("readStoredPlans: anything but this user's copy in this format is nothing stored (D11)", () => {
  it("reads back what was stored, stamps exact, including no plans", () => {
    const plans = [stamped("a", at(5, 1_000))];
    expect(readStoredPlans(serializeStoredPlans("u1", held(plans)), "u1")).toEqual({ held: held(plans), error: null });
    expect(readStoredPlans(serializeStoredPlans("u1", held([])), "u1").held?.plans).toEqual([]);
  });

  it.each([
    ["absent", null, null],
    ["unreadable JSON", "{", "unreadable JSON"],
    ["stage 1's format", JSON.stringify({ formatVersion: 1, uid: "u1", plans: [] }), "format version"],
    ["another user's copy", serializeStoredPlans("u2", held([plan("a")])), "another user"],
    ["a plan with no exercises list", JSON.stringify({ ...held([]), formatVersion: PLANS_FORMAT_VERSION, uid: "u1", plans: [{ id: "a", name: "A" }] }), "unknown shape"],
    ["lastSeen in milliseconds", JSON.stringify({ ...held([]), formatVersion: PLANS_FORMAT_VERSION, uid: "u1", lastSeen: 5000 }), "check times"],
  ])("%s → null", (_label, raw, error) => {
    const read = readStoredPlans(raw, "u1");
    expect(read.held).toBeNull();
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

describe("stamps (D3)", () => {
  it("keeps a Timestamp's nanoseconds, and anything else is no stamp", () => {
    expect(toPlanStamp({ seconds: 5, nanoseconds: 123_456_000, toMillis: () => 5123 })).toEqual(at(5, 123_456_000));
    expect(toPlanStamp(undefined)).toBeUndefined();
    expect(toPlanStamp("2026-11-06")).toBeUndefined();
  });

  it("no lastSeen: a change check starts at the epoch, a named floor, not a stray 0", () => {
    expect(changeCheckAfter(null)).toEqual(at(0));
    expect(changeCheckAfter(at(5, 1_000))).toEqual(at(5, 1_000));
  });

  it("lastSeen: the newest stamp, a sub-millisecond one exact, deleted markers counted", () => {
    // Rounded to the millisecond this would be 5.000 s, and `> lastSeen`
    // would return this plan on every check.
    expect(lastSeenAfter(at(5, 300), [stamped("a", at(5, 400)), stamped("b", at(3))])).toEqual(at(5, 400));
    expect(lastSeenAfter(at(4), [{ ...stamped("a", at(6)), deleted: true }])).toEqual(at(6));
  });

  it("lastSeen: an empty answer or no stamps leave it as it was, null included", () => {
    expect(lastSeenAfter(at(4), [])).toEqual(at(4));
    expect(lastSeenAfter(null, [plan("a")])).toBeNull();
  });
});

describe("mergeChanges (D3, D10)", () => {
  const before = [stamped("a", at(5)), stamped("c", at(4))];

  it("an empty answer changes nothing", () => {
    expect(mergeChanges(before, [])).toBe(before);
  });

  it("a newer plan replaces the held one in place; a new one goes in id order", () => {
    expect(names(mergeChanges(before, [stamped("a", at(6), "A2"), stamped("b", at(6))]))).toEqual(["A2", "b", "c"]);
  });

  it("an older incoming plan loses: a slow check cannot undo a Save", () => {
    expect(names(mergeChanges([stamped("a", at(6), "saved")], [stamped("a", at(5), "old")]))).toEqual(["saved"]);
  });

  it("an older plan loses by nanoseconds alone", () => {
    expect(names(mergeChanges([stamped("a", at(5, 2_000), "held")], [stamped("a", at(5, 1_000), "old")]))).toEqual(["held"]);
  });

  it("an unstamped held plan loses to a stamped one", () => {
    expect(names(mergeChanges([plan("a", "pre-070")], [stamped("a", at(1), "saved")]))).toEqual(["saved"]);
  });

  it("deleted removes the plan; an older deleted marker does not", () => {
    expect(names(mergeChanges(before, [{ ...stamped("a", at(6)), deleted: true }]))).toEqual(["c"]);
    expect(names(mergeChanges(before, [{ ...stamped("a", at(1)), deleted: true }]))).toEqual(["a", "c"]);
  });
});

describe("mergeFullReload (D5, D10)", () => {
  it("replaces what is held: a plan removed outside the app goes, deleted ones are left out", () => {
    const result = mergeFullReload([stamped("a", at(5)), stamped("gone", at(4))], [stamped("a", at(5)), { ...stamped("d", at(5)), deleted: true }], at(5));
    expect(names(result)).toEqual(["a"]);
  });

  it("equal stamps take the server's copy: an outside edit that kept the stamp shows", () => {
    expect(names(mergeFullReload([stamped("a", at(5), "held")], [stamped("a", at(5), "console")], at(5)))).toEqual(["console"]);
    expect(names(mergeFullReload([plan("a", "held")], [plan("a", "console")], null))).toEqual(["console"]);
  });

  it("keeps a Save that landed while the read was out: newer than its copy, or new since it started", () => {
    const held = [stamped("a", at(7), "saved"), stamped("n", at(8), "new")];
    expect(names(mergeFullReload(held, [stamped("a", at(5), "old")], at(6)))).toEqual(["saved", "new"]);
  });

  it("a held stamp 'newer' than the server's, but held before the read started: the server wins", () => {
    expect(names(mergeFullReload([stamped("a", at(9_999), "future")], [stamped("a", at(7), "real")], at(9_999)))).toEqual(["real"]);
  });

  it("first load: nothing held, every plan the server has", () => {
    expect(names(mergeFullReload(null, [plan("a"), stamped("b", at(1))], null))).toEqual(["a", "b"]);
  });
});

describe("isFullReloadDue (D5)", () => {
  const due = (over: Partial<Parameters<typeof isFullReloadDue>[0]>) =>
    isFullReloadDue({ requested: false, hasStored: true, lastFullAt: 0, now: 1_000, ...over });

  it("not on a launch with plans stored and a recent full reload", () => {
    expect(due({})).toBe(false);
  });

  it("asked for, nothing stored, never reloaded fully, or once the interval has passed", () => {
    expect(due({ requested: true })).toBe(true);
    expect(due({ hasStored: false })).toBe(true);
    expect(due({ lastFullAt: null })).toBe(true);
    expect(due({ now: PLANS_FULL_RELOAD_INTERVAL_MS - 1 })).toBe(false);
    expect(due({ now: PLANS_FULL_RELOAD_INTERVAL_MS })).toBe(true);
  });

  it("a last full reload in the future (clock moved back): due, not waiting for the clock", () => {
    expect(due({ lastFullAt: 5_000 })).toBe(true);
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
