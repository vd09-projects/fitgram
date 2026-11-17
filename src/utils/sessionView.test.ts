import { buildSessionDocs } from "./exerciseStats";
import {
  compareHeaders,
  liftCards,
  liftCompare,
  liftLabel,
  resolveSession,
  sessionDateLine,
  sessionSummary,
  setViews,
  unitChangeCaption,
} from "./sessionView";
import { FREESTYLE_ID } from "../constants/freestyle";
import { SESSION_COMPARE_COUNT } from "../config/display";
import type { LiftRecord, WorkoutSessionDoc } from "../types/workoutSession";
import type { ExerciseField } from "../types/workoutType";
import { buildExercise, buildStats, buildWorkout } from "../test/fixtures";

const set = (weight: number, reps: number) => ({ id: 1, segments: [{ Weight: weight, Reps: reps }] });
const day = (n: number) => n * 86_400_000;
const lb: ExerciseField[] = [{ name: "Weight", role: "weight", unit: "lb" }, { name: "Reps", role: "reps" }];

const sessionOf = (lifts: Partial<LiftRecord>[], overrides: Partial<WorkoutSessionDoc> = {}): WorkoutSessionDoc => {
  const { session } = buildSessionDocs(
    buildWorkout([], { id: "push", startTime: 1_000, exercises: lifts.map((_, i) => buildExercise(`Lift ${i}`, { sets: [set(60, 5)] })) }),
    2_000
  );
  return { ...session, lifts: session.lifts.map((lift, i) => ({ ...lift, ...lifts[i] })), ...overrides };
};

describe("resolveSession", () => {
  const queued = {
    sessionId: "push_1000",
    uid: "u1",
    workout: buildWorkout([], { id: "push", startTime: 1_000, exercises: [buildExercise("Bench", { sets: [set(60, 5)] })] }),
    endedAt: 2_000,
    failedAttempts: 0,
    lastError: null,
  };
  const none = { held: [], older: [], uid: "u1", summaryOf: null };

  it("finds a queued workout, with no verdict word invented while the summaries are not held", () => {
    const found = resolveSession("push_1000", { ...none, pending: [queued] });
    expect(found.kind === "found" && found.workout.state).toBe("waiting");
    expect(found.kind === "found" && found.workout.session.lifts[0].reason).toBe("pending");
  });

  it("returns the held copy once the upload has landed, though the entry is still queued", () => {
    const held = { ...sessionOf([{ verdict: "better", reason: null }]), sessionId: "push_1000" };
    const found = resolveSession("push_1000", { ...none, held: [held], pending: [queued] });
    expect(found.kind === "found" && found.workout.state).toBe("uploaded");
  });

  it("says notOnPhone for an id it has nowhere, and for another user's queue entry", () => {
    expect(resolveSession("nope", { ...none, pending: [queued] }).kind).toBe("notOnPhone");
    expect(resolveSession("push_1000", { ...none, uid: "u2", pending: [queued] }).kind).toBe("notOnPhone");
  });
});

describe("liftLabel", () => {
  it("gives no word for pending, and none for a first time in Freestyle", () => {
    expect(liftLabel({ verdict: null, reason: "pending" }, "push")).toBeNull();
    expect(liftLabel({ verdict: null, reason: "first_time" }, FREESTYLE_ID)).toBeNull();
    expect(liftLabel({ verdict: null, reason: "first_time" }, "push")).toBe("New lift");
  });

  it("reads an unreadable or empty comparison as Not compared, and a unit change as its own word", () => {
    expect(liftLabel({ verdict: null, reason: "unreadable" }, "push")).toBe("Not compared");
    expect(liftLabel({ verdict: null, reason: "no_volume" }, "push")).toBe("Not compared");
    expect(liftLabel({ verdict: null, reason: "unit_changed" }, "push")).toBe("Unit changed");
  });
});

describe("unitChangeCaption", () => {
  const kg: ExerciseField[] = [{ name: "Weight", role: "weight", unit: "kg" }, { name: "Reps", role: "reps" }];
  it("names the units, by role and not by field name", () => {
    expect(unitChangeCaption(lb, kg)).toBe("Changed from kg to lb");
    expect(unitChangeCaption(lb, [{ name: "Load", role: "weight", unit: "kg" }, kg[1]])).toBe("Changed from kg to lb");
  });
  it("is null with no previous session or with no unit that differs", () => {
    expect(unitChangeCaption(lb, null)).toBeNull();
    expect(unitChangeCaption(kg, kg)).toBeNull();
  });
});

describe("sessionSummary", () => {
  const lift = (name: string, verdict: LiftRecord["verdict"], reason: LiftRecord["reason"]) => ({ name, verdict, reason });

  it("names the lifts that beat last time and counts the rest", () => {
    const session = sessionOf([
      lift("Bench", "better", null),
      lift("Pushdown", "better", null),
      lift("Press", "same", null),
      lift("Incline", "lower", null),
      lift("Fly", null, "unit_changed"),
      lift("Raise", null, "first_time"),
      lift("Pull", null, "first_time"),
    ]);
    expect(sessionSummary(session)).toEqual({
      headline: "Bench and Pushdown beat last time.",
      detail: "1 the same · 1 a bit lower · 1 not compared · 2 new",
    });
  });

  it("has no summary while any lift is pending, or when the lifts could not be read", () => {
    expect(sessionSummary(sessionOf([lift("Bench", "better", null), lift("Fly", null, "pending")]))).toBeNull();
    expect(sessionSummary(sessionOf([], { liftsUnreadable: true }))).toBeNull();
  });

  it("says there is nothing to compare with for an all-new workout, with no counts", () => {
    const all = sessionOf([lift("A", null, "first_time"), lift("B", null, "first_time"), lift("C", null, "first_time")]);
    expect(sessionSummary(all)).toEqual({ headline: "Three lifts, no earlier session to compare with.", detail: null });
  });

  it("says no lift beat last time, with its counts, and leaves detail null when it has none", () => {
    expect(sessionSummary(sessionOf([lift("Press", "same", null)]))).toEqual({ headline: "No lift beat last time.", detail: "1 the same" });
    expect(sessionSummary(sessionOf([lift("Bench", "better", null)]))).toEqual({ headline: "Bench beat last time.", detail: null });
  });
});

describe("sessionDateLine", () => {
  const start = new Date(2026, 10, 9, 18, 0).getTime();
  it("adds the minutes, and drops them rather than say 0 for an imported workout or a backwards clock", () => {
    expect(sessionDateLine(start, start + 58 * 60_000)).toBe("Mon 9 Nov · 58 min");
    expect(sessionDateLine(start, start)).toBe("Mon 9 Nov");
    expect(sessionDateLine(start, start - 1000)).toBe("Mon 9 Nov");
    expect(sessionDateLine(start, start + 10_000)).toBe("Mon 9 Nov · under 1 min");
  });
});

describe("setViews", () => {
  it("shows an unreadable set as null text, never as an empty row, and keeps a split's later segments", () => {
    const fields = lb;
    const views = setViews(fields, [
      { segments: [{ Weight: 60, Reps: 8 }, { Weight: 50, Reps: 4 }], effort: "hard" },
      { garbage: true } as never,
    ]);
    expect(views[0]).toMatchObject({ number: 1, text: "60 lb × 8", split: ["50 lb × 4"], effort: "hard" });
    expect(views[1]).toMatchObject({ number: 2, text: null, split: [] });
  });
});

describe("compareHeaders", () => {
  const now = new Date(2026, 10, 18).getTime();
  it("adds the time to every session of a day that has two, and leaves a lone day bare", () => {
    const two = new Date(2026, 10, 2, 18, 30).getTime();
    const one = new Date(2026, 9, 26, 7, 5).getTime();
    expect(compareHeaders([two, new Date(2026, 10, 2, 9, 0).getTime(), one], now)).toEqual(["2 Nov 18:30", "2 Nov 09:00", "26 Oct"]);
  });
  it("adds the year when it is not this year", () => {
    expect(compareHeaders([new Date(2025, 2, 1).getTime()], now)).toEqual(["1 Mar 2025"]);
  });
});

describe("liftCompare", () => {
  const now = Date.now();
  const session = { sessionId: "today", startedAt: now };
  const todayLift = { id: "bench", fields: buildExercise("Bench").fields, sets: [{ segments: [{ Weight: 62.5, Reps: 8 }], effort: null }] as LiftRecord["sets"] };
  const stats = buildStats("Bench", [
    { sets: [{ Weight: 60, Reps: 9 }, { Weight: 55, Reps: 10 }], performedAt: now - day(7) },
    { sets: [{ Weight: 5, Reps: 9 }], fields: lb, performedAt: now - day(14) },
  ]);

  it("is unavailable, not empty, when the summaries are not held, and none when held with no earlier session", () => {
    expect(liftCompare(session, todayLift, null, now).kind).toBe("unavailable");
    expect(liftCompare(session, todayLift, () => undefined as never, now).kind).toBe("unavailable");
    expect(liftCompare(session, todayLift, () => null, now).kind).toBe("none");
  });

  it("aligns sets by number across columns, newest earlier session first, each in its own unit", () => {
    const result = liftCompare(session, todayLift, () => stats, now);
    if (result.kind !== "columns") throw new Error("expected columns");
    expect(result.rows).toBe(2);
    expect(result.columns.map((c) => c.cells.map((cell) => cell?.text ?? null))).toEqual([
      ["62.5 kg × 8", null],
      ["60 kg × 9", "55 kg × 10"],
      ["5 lb × 9", null],
    ]);
    expect(result.columns[0].header).toBe("Today");
  });

  it("leaves out a session at or after the workout, and caps the earlier ones", () => {
    const many = buildStats(
      "Bench",
      Array.from({ length: SESSION_COMPARE_COUNT + 2 }, (_, i) => ({ sets: [{ Weight: 50 + i, Reps: 5 }], performedAt: now - day(i + 1) }))
    );
    const late = { ...many.recentSessions[0], sessionId: "later", performedAt: now + day(1) };
    const result = liftCompare(session, todayLift, () => ({ recentSessions: [late, ...many.recentSessions] }), now);
    if (result.kind !== "columns") throw new Error("expected columns");
    expect(result.columns).toHaveLength(SESSION_COMPARE_COUNT + 1);
    expect(result.columns.map((c) => c.sessionId)).not.toContain("later");
  });
});

describe("liftCards", () => {
  it("builds captions in order and a Not compared lift with a label", () => {
    const session = sessionOf([
      { swappedFrom: { id: "x", name: "Rear Delt Fly" }, added: true, verdict: null, reason: "first_time" },
    ]);
    expect(liftCards(session, null)[0]).toMatchObject({ label: "New lift", captions: ["Swapped in for Rear Delt Fly", "Added"] });
  });
});
