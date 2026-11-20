import { buildSessionDocs } from "./exerciseStats";
import { previousSessionOf, readLifts, summaryWithout, withVerdicts } from "./liftRecord";
import { STATS_RECENT_SESSION_CAP } from "../config/storedData";
import { FREESTYLE_ID } from "../constants/freestyle";
import { buildExercise, buildStats, buildWorkout } from "../test/fixtures";

const set = (weight: number, reps: number) => ({ id: 1, segments: [{ Weight: weight, Reps: reps }] });
const day = (n: number) => n * 86_400_000;

describe("the record's lifts, from the live workout (buildSessionDocs)", () => {
  const planned = { id: "incline-press", name: "Incline Press", fields: [] };

  it("records a swap and an added slot, derives exerciseIds from lifts, and leaves keys out rather than undefined", () => {
    const workout = buildWorkout([], {
      id: "push",
      exercises: [
        buildExercise("Bench", { sets: [set(60, 5)], planned }),
        buildExercise("Dips", { sets: [set(0, 8)], added: true }),
        buildExercise("Fly", { sets: [set(10, 12)] }),
        buildExercise("Skipped"),
      ],
    });
    const { session } = buildSessionDocs(workout, 9);
    expect(session.lifts.map((l) => l.id)).toEqual(["bench", "dips", "fly"]);
    expect(session.exerciseIds).toEqual(["bench", "dips", "fly"]);
    expect(session.lifts[0].swappedFrom).toEqual({ id: "incline-press", name: "Incline Press" });
    expect(session.lifts[1].added).toBe(true);
    expect(Object.keys(session.lifts[2])).not.toEqual(expect.arrayContaining(["swappedFrom", "added"]));
    expect(session.lifts.every((l) => l.verdict === null && l.reason === "pending")).toBe(true);
    expect(session.lifts[0].sets).toHaveLength(1);
  });

  it("never marks a Freestyle slot added: every added slot is one there", () => {
    const workout = buildWorkout([], { id: FREESTYLE_ID, exercises: [buildExercise("Dips", { sets: [set(0, 8)], added: true })] });
    expect(buildSessionDocs(workout, 9).session.lifts[0]).not.toHaveProperty("added");
  });
});

describe("previousSessionOf", () => {
  const stats = buildStats("Bench", [
    { sets: [{ Weight: 60, Reps: 5 }], performedAt: day(30) },
    { sets: [{ Weight: 55, Reps: 5 }], performedAt: day(20) },
  ]);

  it("takes the newest session before this one by start time, so a late upload finds its true neighbour", () => {
    const found = previousSessionOf(stats, day(25));
    expect(found.kind === "found" && found.session.performedAt).toBe(day(20));
  });

  it("does not find its own entry when a save is replayed", () => {
    const found = previousSessionOf(stats, day(30));
    expect(found.kind === "found" && found.session.performedAt).toBe(day(20));
  });

  it("is First time with a short window and nothing older, and not First time with a full one", () => {
    expect(previousSessionOf(stats, day(1)).kind).toBe("first_time");
    expect(previousSessionOf(null, day(1)).kind).toBe("first_time");
    const full = buildStats(
      "Bench",
      Array.from({ length: STATS_RECENT_SESSION_CAP }, (_, i) => ({ sets: [{ Weight: 60, Reps: 5 }], performedAt: day(100 + i) }))
    );
    expect(previousSessionOf(full, day(1)).kind).toBe("beyond_window");
  });
});

describe("withVerdicts", () => {
  const record = (startedAt: number, weight: number) =>
    buildSessionDocs(buildWorkout([], { id: "push", startTime: startedAt, exercises: [buildExercise("Bench", { sets: [set(weight, 5)] })] }), 9)
      .session;

  it("puts the verdict from the rollup on each lift, and leaves a lift whose previous is out of the window pending", () => {
    const last = buildStats("Bench", [{ sets: [{ Weight: 60, Reps: 5 }], performedAt: day(10) }]);
    expect(withVerdicts(record(day(20), 65), () => last)[0]).toMatchObject({ verdict: "better", reason: null });
    expect(withVerdicts(record(day(20), 65), () => null)[0]).toMatchObject({ verdict: null, reason: "first_time" });
    const full = buildStats(
      "Bench",
      Array.from({ length: STATS_RECENT_SESSION_CAP }, (_, i) => ({ sets: [{ Weight: 60, Reps: 5 }], performedAt: day(100 + i) }))
    );
    expect(withVerdicts(record(day(1), 65), () => full)[0]).toMatchObject({ verdict: null, reason: "pending" });
  });
});

describe("readLifts", () => {
  const lift = { id: "bench", name: "Bench", fields: [{ name: "Weight", role: "weight" }], sets: [], verdict: "better", reason: null };

  it("accepts what the builder writes and refuses the whole array on any doubt", () => {
    const built = buildSessionDocs(buildWorkout([], { exercises: [buildExercise("Bench", { sets: [set(60, 5)] })] }), 9).session.lifts;
    expect(readLifts(built)).toEqual(built);
    expect(readLifts([lift, { ...lift, verdict: "better", reason: "first_time" }])).toBeNull();
    expect(readLifts([{ ...lift, verdict: null, reason: null }])).toBeNull();
    expect(readLifts([{ ...lift, verdict: "best" }])).toBeNull();
    expect(readLifts([{ ...lift, sets: "x" }])).toBeNull();
    expect(readLifts(undefined)).toBeNull();
  });
});

// TICKET-086: what a lift's summary becomes once one of its workouts is gone.
describe("summaryWithout", () => {
  const bench = (startTime: number, weight: number) =>
    buildSessionDocs(buildWorkout([], { id: "push", startTime, exercises: [buildExercise("Bench", { sets: [set(weight, 5)] })] }), startTime + 1).session;
  const typo = bench(2_000, 650);
  const real = bench(1_000, 60);

  it("drops the record the deleted workout set: the typo's 650 is gone, the earlier 60 stands", () => {
    const result = summaryWithout("bench", [real, typo], typo.sessionId);
    expect(result.status === "ready" && result.stats?.bestByReps["5|kg"]?.weight).toBe(60);
  });

  it("is null, not an empty summary, when the deleted workout was the lift's only session", () => {
    expect(summaryWithout("bench", [typo], typo.sessionId)).toEqual({ status: "ready", stats: null });
  });

  it("leaves out a deleted marker as well as the deleted workout, so a query's answer can be passed whole", () => {
    const marker = { ...bench(3_000, 700), deleted: true as const };
    const result = summaryWithout("bench", [real, typo, marker], typo.sessionId);
    expect(result.status === "ready" && result.stats?.bestByReps["5|kg"]?.weight).toBe(60);
  });

  it("refuses, naming the sessions, when one that is left has unreadable lifts: its sets are unknown, not zero", () => {
    const old = { ...bench(500, 100), lifts: [], liftsUnreadable: true as const };
    expect(summaryWithout("bench", [old, real, typo], typo.sessionId)).toEqual({ status: "unreadable", sessionIds: [old.sessionId] });
    // The deleted workout itself being unreadable does not matter: nothing of it is kept.
    expect(summaryWithout("bench", [real, { ...typo, lifts: [], liftsUnreadable: true as const }], typo.sessionId).status).toBe("ready");
  });
});
