// TICKET-082 stage 1: the workout window's rules, on the pure functions. Not the store, not a screen.
import type { WorkoutSessionDoc } from "../types/workoutSession";
import { localMonthKey, localMonthStart, utcMonthKey } from "./monthWindow";
import {
  secondQueryStart,
  addToWindow,
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
const windowOf = (sessions: WorkoutSessionDoc[], windowStart: number | null = null): WorkoutWindow => ({ sessions, windowStart });
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
  const saved = { sessions: [session("b", at("2026-11-03T10:00:00Z")), session("a", at("2026-10-03T10:00:00Z"))], windowStart: new Date(2026, 9, 1).getTime(), lastSeen: { seconds: 7, nanoseconds: 1 }, lastFullAt: 9 };
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
