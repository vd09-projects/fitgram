import {
  fullReloadPlans,
  mergeIntoPlans,
  mergePlanSessions,
  readStoredWorkouts,
  serializeStoredWorkouts,
  stillOwnFinished,
  workoutsLastSeenAfter,
  type HeldWorkouts,
} from "./workoutsSync";
import type { WorkoutSessionDoc } from "../types/workoutSession";
import type { SyncStamp } from "./syncCore";

const stamp = (seconds: number): SyncStamp => ({ seconds, nanoseconds: 0 });
const session = (id: string, startedAt: number, extra: Partial<WorkoutSessionDoc> = {}): WorkoutSessionDoc => ({
  sessionId: id,
  workoutId: "push",
  workoutName: "Push",
  startedAt,
  endedAt: startedAt + 60,
  exerciseIds: [],
  rollupPending: false,
  ...extra,
});
const ids = (sessions: WorkoutSessionDoc[]) => sessions.map((s) => s.sessionId);

describe("mergePlanSessions", () => {
  it("keeps the newest N by startedAt, so a late upload goes where it started, and drops out past N", () => {
    const held = [session("d", 400), session("c", 300), session("b", 200)];
    // Uploaded late: newest stamp, but started before everything held.
    expect(ids(mergePlanSessions(held, [session("a", 100, { updatedAt: stamp(9) })], 4))).toEqual(["d", "c", "b", "a"]);
    expect(ids(mergePlanSessions(held, [session("a", 100, { updatedAt: stamp(9) })], 3))).toEqual(["d", "c", "b"]);
    expect(ids(mergePlanSessions(held, [session("e", 250)], 3))).toEqual(["d", "c", "e"]);
  });

  it("holds a session once: the stamped copy replaces this phone's unstamped one, never the other way", () => {
    const own = session("a", 100);
    const server = session("a", 100, { updatedAt: stamp(5), volume: undefined, endedAt: 999 });
    expect(mergePlanSessions([own], [server], 5)).toEqual([server]);
    expect(mergePlanSessions([server], [own], 5)).toEqual([server]);
    // Two stamped copies: the newer stamp.
    const newer = { ...server, updatedAt: stamp(6), endedAt: 1000 };
    expect(mergePlanSessions([newer], [server], 5)).toEqual([newer]);
  });

  it("breaks a startedAt tie by sessionId, newest id first, as Firestore orders the plan's query", () => {
    expect(ids(mergePlanSessions([session("a", 100)], [session("b", 100)], 1))).toEqual(["b"]);
    expect(ids(mergePlanSessions([session("b", 100)], [session("a", 100)], 1))).toEqual(["b"]);
  });
});

describe("mergeIntoPlans and fullReloadPlans", () => {
  it("files sessions under their own plan", () => {
    const merged = mergeIntoPlans({ push: [session("p1", 100)] }, [session("l1", 200, { workoutId: "legs" })], 5);
    expect(Object.fromEntries(Object.entries(merged).map(([plan, list]) => [plan, ids(list)]))).toEqual({
      push: ["p1"],
      legs: ["l1"],
    });
  });

  it("a full reload replaces what is held, keeping only own Finishes the answer did not bring yet", () => {
    const held = { push: [session("own", 500), session("wiped", 400), session("p1", 100)] };
    const result = fullReloadPlans({ push: [session("p1", 100, { updatedAt: stamp(1) })] }, held, ["own"], 5);
    expect(ids(result.push)).toEqual(["own", "p1"]);
  });
});

describe("stillOwnFinished", () => {
  it("drops an own Finish once returned stamped, or once no longer held (pushed past N), so the list cannot grow", () => {
    const held = { push: [session("kept", 300), session("back", 200)] };
    const returned = [session("back", 200, { updatedAt: stamp(5) })];
    expect(stillOwnFinished(["kept", "back", "pushedOut"], returned, held)).toEqual(["kept"]);
  });
});

describe("workoutsLastSeenAfter", () => {
  const changed = [session("a", 1, { updatedAt: stamp(30) }), session("b", 2, { updatedAt: stamp(20) })];

  it("change check: forward only, to the newest returned stamp", () => {
    expect(workoutsLastSeenAfter("change", stamp(10), { baseline: null, changed })).toEqual(stamp(30));
    expect(workoutsLastSeenAfter("change", stamp(40), { baseline: null, changed })).toEqual(stamp(40));
  });

  it("full reload: the baseline, even when older than held (S1); a new plan's load: unchanged", () => {
    expect(workoutsLastSeenAfter("full", stamp(99_999), { baseline: stamp(50), changed: [] })).toEqual(stamp(50));
    expect(workoutsLastSeenAfter("full", stamp(10), { baseline: null, changed: [] })).toBeNull();
    expect(workoutsLastSeenAfter("new plans", stamp(10), { baseline: null, changed })).toEqual(stamp(10));
  });
});

describe("the stored copy", () => {
  const held: HeldWorkouts = {
    byPlan: { push: [session("p1", 100, { updatedAt: stamp(1) })] },
    loaded: ["push"],
    ownFinished: [],
    lastSeen: stamp(1),
    lastFullAt: 1000,
  };

  it("reads back what was written with the same N", () => {
    expect(readStoredWorkouts(serializeStoredWorkouts("u1", 5, held), "u1", 5)).toEqual({ held, error: null });
  });

  it("discards a copy built with another N, either way, so the next check refills it", () => {
    for (const builtWith of [3, 8]) {
      const read = readStoredWorkouts(serializeStoredWorkouts("u1", builtWith, held), "u1", 5);
      expect(read.held).toBeNull();
      expect(read.error).toMatch(`built with ${builtWith} per plan`);
    }
  });

  it("refuses a copy with a session in an unknown shape whole, never in part", () => {
    const broken = { ...held, byPlan: { push: [...held.byPlan.push, { sessionId: "x" }] } } as unknown as HeldWorkouts;
    expect(readStoredWorkouts(serializeStoredWorkouts("u1", 5, broken), "u1", 5).held).toBeNull();
  });
});
