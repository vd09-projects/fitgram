// TICKET-082 stage 1: the workout window's rules, on the pure functions. Not the store, not a screen.
import type { WorkoutSessionDoc } from "../types/workoutSession";
import { localMonthKey, localMonthStart, utcMonthKey } from "./monthWindow";
import {
  secondQueryStart,
  addToWindow,
  compareSessions,
  lastSeenAfterCheck,
  plansToLookUp,
  sessionsByMonth,
  sessionsWithLastOfEachPlan,
  withPlanLookups,
  planFilterRows,
  readStoredWorkouts,
  serializeStoredWorkouts,
  shardKeysNamedBy,
  windowFromFirstLoad,
  type WorkoutWindow,
} from "./workoutWindow";

// The suite is pinned to Los Angeles (src/test/globalSetup.js). This guard fails loudly if it is not,
// or the boundary tests below would pass for the wrong reason.
beforeAll(() => {
  expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(480);
});

const at = (iso: string) => Date.parse(iso);
const session = (id: string, startedAt: number, extra: Partial<WorkoutSessionDoc> = {}): WorkoutSessionDoc => ({
  sessionId: id,
  workoutId: "push",
  workoutName: "Push",
  startedAt,
  endedAt: startedAt + 60_000,
  exerciseIds: [],
  lifts: [],
  ...extra,
});
const windowOf = (sessions: WorkoutSessionDoc[], windowStart: number | null = null, lastByPlan: WorkoutWindow["lastByPlan"] = {}): WorkoutWindow => ({
  sessions,
  windowStart,
  lastByPlan,
});
const ids = (h: WorkoutWindow) => h.sessions.map((s) => s.sessionId);

describe("the month is the phone's local one; the shard is the UTC one", () => {
  it("a workout just after midnight UTC on the 1st is still last month in Los Angeles", () => {
    const t = at("2026-11-01T03:00:00Z"); // 20:00 on 31 Oct in Los Angeles
    expect(utcMonthKey(t)).toBe("2026-11");
    expect(localMonthKey(t)).toBe("2026-10");
    expect(localMonthStart(t)).toBe(new Date(2026, 9, 1).getTime());
  });

  it("the second query starts at the local month of the oldest of the newest, not its UTC month", () => {
    const newest = [session("b", at("2026-11-20T12:00:00Z")), session("a", at("2026-11-01T03:00:00Z"))];
    expect(secondQueryStart(newest, 2)).toBe(new Date(2026, 9, 1).getTime()); // 1 Oct local; UTC would say 1 Nov
  });

  it("a history shorter than the minimum is all in the window: no second query, no window start", () => {
    expect(secondQueryStart([session("a", 1000)], 2)).toBeNull();
    expect(windowFromFirstLoad([session("a", 1000)], [], 2).windowStart).toBeNull();
  });

  it("after a first load no workout in the window is before its start, and shards are by UTC month", () => {
    const newest = [session("n", at("2026-11-20T12:00:00Z")), session("m", at("2026-11-01T03:00:00Z"))];
    // The second query's answer: October (local), which includes a workout at 08:00 UTC on 1 Oct, 01:00 local.
    const rest = [session("o2", at("2026-10-15T12:00:00Z")), session("o1", at("2026-10-01T08:00:00Z"))];
    const w = windowFromFirstLoad(newest, rest, 2);
    expect(w.sessions.every((s) => s.startedAt >= w.windowStart!)).toBe(true);
    const keys = serializeStoredWorkouts("u", { ...w, lastSeen: null, lastFullAt: null }).map(([k]) => k);
    expect(keys).toEqual(["recentWorkouts", "recentWorkouts.2026-11", "recentWorkouts.2026-10"]);
  });
});

describe("the window after a Finish", () => {
  const sep = [session("s1", at("2026-09-05T10:00:00Z")), session("s2", at("2026-09-20T10:00:00Z"))];
  const oct = [session("o1", at("2026-10-05T10:00:00Z")), session("o2", at("2026-10-20T10:00:00Z"))];
  const base = (min: number) => addToWindow(windowOf([], null), [...sep, ...oct], min);

  it("a Finish that starts a new month drops the oldest month, whole, and moves the windowStart", () => {
    const before = addToWindow(windowOf([...oct, ...sep].reverse(), new Date(2026, 8, 1).getTime()), [], 3);
    expect(ids(before)).toEqual(["o2", "o1", "s2", "s1"]);
    const after = addToWindow(before, [session("n1", at("2026-11-02T10:00:00Z"))], 3);
    expect(ids(after)).toEqual(["n1", "o2", "o1"]);
    expect(after.windowStart).toBe(new Date(2026, 9, 1).getTime());
  });

  it("does not drop a month the minimum still needs", () => {
    const w = base(5);
    const after = addToWindow(w, [session("o3", at("2026-10-25T10:00:00Z"))], 5);
    expect(ids(after)).toHaveLength(5); // October has 3, September's 2 are needed to reach 5
  });

  it("a late upload from a month that is not in the window is not added (no part-month)", () => {
    const w = windowOf(oct, new Date(2026, 9, 1).getTime());
    // The minimum is above what October holds, so only the windowStart keeps September's one workout out.
    const after = addToWindow(w, [session("late", at("2026-09-28T10:00:00Z"))], 5);
    expect(ids(after)).toEqual(["o2", "o1"]);
  });
});

describe("a deleted marker", () => {
  const a = session("a", 2000, { updatedAt: { seconds: 5, nanoseconds: 0 } });
  const marker = (id: string, seconds: number) => session(id, 2000, { deleted: true, updatedAt: { seconds, nanoseconds: 0 } });

  it("removes the workout and is never kept", () => {
    const after = addToWindow(windowOf([a, session("b", 1000)]), [marker("a", 9)], 10);
    expect(ids(after)).toEqual(["b"]);
  });

  it("for a workout not on the phone changes nothing", () => {
    expect(ids(addToWindow(windowOf([a]), [marker("zzz", 9)], 10))).toEqual(["a"]);
  });

  it("an older marker does not remove a newer copy", () => {
    expect(ids(addToWindow(windowOf([a]), [marker("a", 1)], 10))).toEqual(["a"]);
  });
});

describe("plan filters", () => {
  const sessions = [
    session("1", 3000, { workoutId: "p1", workoutName: "Push Day" }),
    session("2", 2000, { workoutId: "p1", workoutName: "Push" }), // saved before the rename
    session("3", 1000, { workoutId: "gone", workoutName: "Old Plan" }),
  ];

  it("a renamed plan stays one row, labelled with its current name", () => {
    const { rows } = planFilterRows(windowOf(sessions), [{ id: "p1", name: "Push, new" }]);
    expect(rows.map((r) => [r.planId, r.label, r.workoutCount])).toEqual([
      ["p1", "Push, new", 2],
      ["gone", "Old Plan", 1],
    ]);
  });

  it("with no plan loaded, or a deleted one, the label is the newest snapshot, not the oldest", () => {
    expect(planFilterRows(windowOf(sessions), []).rows[0].label).toBe("Push Day");
    expect(planFilterRows(windowOf(sessions), [{ id: "p1", name: "Push, new", deleted: true }]).rows[0].label).toBe("Push Day");
  });

  it("says when the counts are not the whole history", () => {
    expect(planFilterRows(windowOf(sessions, null), []).coversWholeHistory).toBe(true);
    expect(planFilterRows(windowOf(sessions, 500), []).coversWholeHistory).toBe(false);
  });
});

describe("the stored copy", () => {
  const saved = { lastByPlan: {}, sessions: [session("b", at("2026-11-03T10:00:00Z")), session("a", at("2026-10-03T10:00:00Z"))], windowStart: new Date(2026, 9, 1).getTime(), lastSeen: { seconds: 7, nanoseconds: 1 }, lastFullAt: 9 };
  const rowsOf = (pairs: [string, string][], drop?: string) => pairs.filter(([k]) => k !== drop);

  it("round-trips through one head and one shard per UTC month", () => {
    const pairs = serializeStoredWorkouts("u", saved);
    expect(shardKeysNamedBy(pairs[0][1])).toEqual(["recentWorkouts.2026-11", "recentWorkouts.2026-10"]);
    expect(readStoredWorkouts(pairs, "u").saved).toEqual(saved);
  });

  it("is refused whole when a shard is missing, for another user, or in the first format", () => {
    const pairs = serializeStoredWorkouts("u", saved);
    expect(readStoredWorkouts(rowsOf(pairs, "recentWorkouts.2026-10"), "u").saved).toBeNull();
    expect(readStoredWorkouts(pairs, "someone-else").saved).toBeNull();
    const v1 = JSON.stringify({ formatVersion: 1, uid: "u", n: 5, byPlan: {}, loaded: [], lastSeen: null, lastFullAt: null });
    expect(readStoredWorkouts([["recentWorkouts", v1]], "u")).toEqual({ saved: null, error: expect.stringContaining("format version 1") });
  });
});

describe("the floor: the newest workout of each plan, apart from the months", () => {
  const OCT = new Date(2026, 9, 1).getTime();
  const push = (id: string, iso: string, extra: Partial<WorkoutSessionDoc> = {}) => session(id, at(iso), { workoutId: "push", ...extra });
  const legs = (id: string, iso: string) => session(id, at(iso), { workoutId: "legs", workoutName: "Legs" });
  const oldLegs = legs("legs-old", "2026-03-10T10:00:00Z"); // a plan idle for longer than the window

  it("a first load gives every plan with a workout in the window its newest, and leaves the others to be looked up", () => {
    const w = windowFromFirstLoad([push("p2", "2026-10-20T10:00:00Z"), push("p1", "2026-10-05T10:00:00Z")], [], 2);
    expect(Object.keys(w.lastByPlan)).toEqual(["push"]);
    expect(w.lastByPlan.push!.sessionId).toBe("p2");
    expect(plansToLookUp(w, ["push", "legs", "arms"])).toEqual(["legs", "arms"]);
  });

  it("a lookup fills a plan idle for longer than the window, never overwrites a newer entry, and null means never done", () => {
    const w0 = windowOf([push("p1", "2026-10-05T10:00:00Z")], OCT, { push: push("p1", "2026-10-05T10:00:00Z") });
    const w = withPlanLookups(w0, { legs: oldLegs, arms: null, push: push("older", "2026-02-01T10:00:00Z") });
    expect(w.lastByPlan.legs).toBe(oldLegs);
    expect(w.lastByPlan.arms).toBeNull();
    expect(w.lastByPlan.push!.sessionId).toBe("p1");
    expect(plansToLookUp(w, ["push", "legs", "arms"])).toEqual([]);
  });

  it("a Finish replaces its plan's entry", () => {
    const w0 = windowOf([push("p1", "2026-10-05T10:00:00Z")], OCT, { push: push("p1", "2026-10-05T10:00:00Z") });
    const w = addToWindow(w0, [push("p2", "2026-10-25T10:00:00Z")], 10);
    expect(w.lastByPlan.push!.sessionId).toBe("p2");
  });

  it("a Finish for a plan never done makes its first entry; for a plan not looked up yet it claims nothing", () => {
    const w0 = windowOf([], null, { arms: null });
    const w = addToWindow(w0, [session("a1", at("2026-10-25T10:00:00Z"), { workoutId: "arms" }), legs("l1", "2026-10-26T10:00:00Z")], 10);
    expect(w.lastByPlan.arms!.sessionId).toBe("a1");
    expect("legs" in w.lastByPlan).toBe(false); // one workout is not known to be the plan's newest
  });

  it("dropping the oldest month keeps every plan's newest, and a plan idle for longer than the window keeps its entry", () => {
    const sep = [legs("l-sep", "2026-09-10T10:00:00Z"), push("p-sep", "2026-09-12T10:00:00Z")];
    const oct = [push("p-oct", "2026-10-10T10:00:00Z")];
    const w0 = addToWindow(windowOf([], null, { push: null, legs: oldLegs }), [...sep, ...oct], 2);
    expect(w0.sessions).toHaveLength(3);
    const w = addToWindow(w0, [push("p-nov", "2026-11-02T10:00:00Z")], 2); // November + October reach the minimum: September goes
    expect(w.sessions.map((s) => s.sessionId)).toEqual(["p-nov", "p-oct"]);
    expect(w.lastByPlan.push!.sessionId).toBe("p-nov");
    expect(w.lastByPlan.legs!.sessionId).toBe("l-sep"); // newest legs, from the dropped month, not the older one looked up before
  });

  it("a late upload from before the window is an entry only if newer than the plan's current one", () => {
    const w0 = windowOf([push("p1", "2026-10-05T10:00:00Z")], OCT, { push: push("p1", "2026-10-05T10:00:00Z"), legs: oldLegs });
    const older = addToWindow(w0, [legs("legs-older", "2026-01-05T10:00:00Z")], 10);
    expect(older.lastByPlan.legs).toBe(oldLegs);
    expect(ids(older)).toEqual(["p1"]); // and it is not in a month either
    const newer = addToWindow(w0, [legs("legs-newer", "2026-08-05T10:00:00Z")], 10);
    expect(newer.lastByPlan.legs!.sessionId).toBe("legs-newer");
    expect(ids(newer)).toEqual(["p1"]);
  });

  it("a deleted marker for an entry's workout removes the entry, so the plan is looked up again", () => {
    const w0 = windowOf([], OCT, { legs: oldLegs });
    const w = addToWindow(w0, [{ ...oldLegs, deleted: true, updatedAt: { seconds: 9, nanoseconds: 0 } }], 10);
    expect(plansToLookUp(w, ["legs"])).toEqual(["legs"]);
  });

  it("a deleted marker for a plan's newest workout makes the plan's next newest in the window its entry, with no lookup", () => {
    const newest = push("p-new", "2026-10-20T10:00:00Z");
    const mid = push("p-mid", "2026-10-10T10:00:00Z");
    const w0 = windowOf([newest, mid, push("p-old", "2026-10-05T10:00:00Z"), legs("l-other", "2026-10-25T10:00:00Z")], OCT, { push: newest });
    const w = addToWindow(w0, [{ ...newest, deleted: true, updatedAt: { seconds: 9, nanoseconds: 0 } }], 10);
    expect(w.lastByPlan.push!.sessionId).toBe("p-mid"); // the second newest of the plan, not the oldest, and not another plan's
    expect(plansToLookUp(w, ["push"])).toEqual([]);
  });

  it("a late upload from before the window, in the same batch as the marker, is not taken for the plan's newest", () => {
    const newest = push("p-new", "2026-10-20T10:00:00Z");
    const w0 = windowOf([newest, legs("l-other", "2026-10-25T10:00:00Z")], OCT, { push: newest });
    const late = push("p-late", "2026-01-05T10:00:00Z"); // older than the window's start; the plan's real newest may be a month the phone does not hold
    const w = addToWindow(w0, [late, { ...newest, deleted: true, updatedAt: { seconds: 9, nanoseconds: 0 } }], 10);
    expect("push" in w.lastByPlan).toBe(false);
    expect(plansToLookUp(w, ["push"])).toEqual(["push"]);
    expect(ids(w)).toEqual(["l-other"]);
  });

  it("a floor doc never appears in a month, a count or a plan filter", () => {
    const w = windowOf([push("p1", "2026-10-05T10:00:00Z")], OCT, { push: push("p1", "2026-10-05T10:00:00Z"), legs: oldLegs });
    expect(sessionsByMonth(w.sessions).flatMap((m) => m.sessions.map((s) => s.sessionId))).toEqual(["p1"]);
    expect(planFilterRows(w, []).rows.map((r) => [r.planId, r.workoutCount])).toEqual([["push", 1]]);
    // The two old readers do get it, once: the plan row and Recent need the doc.
    expect(sessionsWithLastOfEachPlan(w).map((s) => s.sessionId)).toEqual(["p1", "legs-old"]);
  });

  it("is saved in the head and read back; a copy written before the floor reads as no floor, not as an error", () => {
    const withFloor = { sessions: [push("p1", "2026-10-05T10:00:00Z")], windowStart: OCT, lastByPlan: { legs: oldLegs, arms: null }, lastSeen: null, lastFullAt: null };
    const pairs = serializeStoredWorkouts("u", withFloor);
    expect(readStoredWorkouts(pairs, "u").saved).toEqual(withFloor);
    const head = JSON.parse(pairs[0][1]);
    delete head.lastByPlan;
    const beforeTheFloor = [[pairs[0][0], JSON.stringify(head)], ...pairs.slice(1)] as [string, string][];
    expect(readStoredWorkouts(beforeTheFloor, "u").saved).toEqual({ ...withFloor, lastByPlan: {} });
    head.lastByPlan = { legs: { not: "a session" } };
    expect(readStoredWorkouts([[pairs[0][0], JSON.stringify(head)], ...pairs.slice(1)], "u").saved).toBeNull();
  });
});

// Rules carried over from the per-plan copy (TICKET-075), now on the window.
describe("carried over: stamps, ties, last seen, a bad copy", () => {
  const stamp = (seconds: number) => ({ seconds, nanoseconds: 0 });

  it("a workout is on the phone once: the stamped copy replaces this phone's unstamped one, never the other way", () => {
    const own = session("a", 100);
    const server = session("a", 100, { updatedAt: stamp(5), endedAt: 999 });
    expect(addToWindow(windowOf([own]), [server], 10).sessions).toEqual([server]);
    expect(addToWindow(windowOf([server]), [own], 10).sessions).toEqual([server]);
    const newer = { ...server, updatedAt: stamp(6), endedAt: 1000 };
    expect(addToWindow(windowOf([newer]), [server], 10).sessions).toEqual([newer]);
  });

  it("a startedAt tie goes by sessionId, newest id first, as Firestore orders the query", () => {
    expect([session("a", 100), session("b", 100)].sort(compareSessions).map((s) => s.sessionId)).toEqual(["b", "a"]);
  });

  it("lastSeen: a change check moves forward only; a full reload takes the baseline, even an older one (S1)", () => {
    const changed = [session("a", 1, { updatedAt: stamp(30) }), session("b", 2, { updatedAt: stamp(20) })];
    expect(lastSeenAfterCheck("change", stamp(10), { baseline: null, changed })).toEqual(stamp(30));
    expect(lastSeenAfterCheck("change", stamp(40), { baseline: null, changed })).toEqual(stamp(40));
    expect(lastSeenAfterCheck("full", stamp(99_999), { baseline: stamp(50), changed: [] })).toEqual(stamp(50));
    expect(lastSeenAfterCheck("full", stamp(10), { baseline: null, changed: [] })).toBeNull();
  });

  it("a saved copy with a workout in an unknown shape, or bad lifts, is refused whole", () => {
    const good = session("p1", at("2026-10-05T10:00:00Z"));
    // The shard's text is replaced after serializing: what is on disk is what may be wrong.
    const save = (docs: unknown[]) => {
      const pairs = serializeStoredWorkouts("u", { sessions: [good], windowStart: null, lastByPlan: {}, lastSeen: null, lastFullAt: null });
      pairs[1] = [pairs[1][0], JSON.stringify(docs)];
      return readStoredWorkouts(pairs, "u").saved;
    };
    expect(save([good])).not.toBeNull();
    expect(save([good, { sessionId: "x" }])).toBeNull();
    expect(save([{ ...good, lifts: undefined }])).toBeNull();
    expect(save([{ ...good, lifts: [{ id: "a", name: "A", fields: [], sets: [], verdict: "better", reason: "first_time" }] }])).toBeNull();
  });
});

