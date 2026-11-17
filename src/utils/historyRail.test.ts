import { buildRail, gapLine, mergePending, monthLabel, type RailInput, type RailRow, type RailWorkout } from "./historyRail";
import { buildExercise, buildStats, buildWorkout } from "../test/fixtures";
import { HISTORY_RAIL_MIN_FULL } from "../config/display";
import type { WorkoutSessionDoc } from "../types/workoutSession";

const NOW = new Date(2026, 10, 17, 12).getTime(); // 17 November 2026, local
const at = (month: number, day: number) => new Date(2026, month - 1, day, 12).getTime();

const workout = (planId: string, startedAt: number, state: RailWorkout["state"] = "uploaded"): RailWorkout => ({
  state,
  session: {
    sessionId: `${planId}_${startedAt}`,
    workoutId: planId,
    workoutName: planId,
    startedAt,
    endedAt: startedAt + 1,
    exerciseIds: [],
    lifts: [],
  },
});

const rail = (input: Partial<RailInput> & Pick<RailInput, "held">) =>
  buildRail({ older: [], now: NOW, openMonths: new Set(), planId: null, reachedStart: true, ...input });

const kinds = (rows: RailRow[]) => rows.map((row) => row.kind);
const monthRows = (rows: RailRow[]) => rows.filter((row) => row.kind === "monthRow");

/** `n` workouts of plan "push", one a day counting back from `start`. */
const run = (n: number, start: number, month: number) => Array.from({ length: n }, (_, i) => workout("push", at(month, start - i)));

describe("buildRail: the full section", () => {
  it("shows a current month that has at least the minimum whole, never split, with the rest under Earlier", () => {
    const held = [...run(HISTORY_RAIL_MIN_FULL + 2, 17, 11), ...run(3, 20, 10)];
    const rows = rail({ held });
    expect(rows.filter((row) => row.kind === "workout")).toHaveLength(HISTORY_RAIL_MIN_FULL + 2);
    expect(monthRows(rows)).toMatchObject([{ month: "2026-10", count: 3, cut: false }]);
  });

  it("runs a short current month back into the month before until it has the minimum, and splits that month", () => {
    const held = [...run(3, 17, 11), ...run(HISTORY_RAIL_MIN_FULL, 28, 10)];
    const rows = rail({ held });
    expect(rows.filter((row) => row.kind === "workout")).toHaveLength(HISTORY_RAIL_MIN_FULL);
    expect(monthRows(rows)).toMatchObject([{ month: "2026-10", count: 3, cut: true }]);
  });

  it("does not split a month the minimum lands on exactly", () => {
    const held = [...run(3, 17, 11), ...run(HISTORY_RAIL_MIN_FULL - 3, 28, 10), ...run(2, 5, 9)];
    expect(monthRows(rail({ held }))).toMatchObject([{ month: "2026-09", count: 2, cut: false }]);
  });

  it("counts Earlier rows within the filtered plan, and runs the minimum within it too", () => {
    const held = [...run(2, 17, 11), ...run(HISTORY_RAIL_MIN_FULL, 28, 10).map((w, i) => ({ ...w, session: { ...w.session, workoutId: i % 2 ? "pull" : "push" } }))];
    const rows = rail({ held, planId: "push" });
    expect(rows.filter((row) => row.kind === "workout").every((row) => row.kind === "workout" && row.workout.session.workoutId === "push")).toBe(true);
    expect(monthRows(rows).every((row) => row.kind === "monthRow" && row.count <= HISTORY_RAIL_MIN_FULL / 2)).toBe(true);
  });

  it("lists a month's workouts right under its row once opened, and not before", () => {
    const held = [...run(HISTORY_RAIL_MIN_FULL, 17, 11), ...run(2, 20, 10)];
    const closed = rail({ held });
    const opened = rail({ held, openMonths: new Set(["2026-10"]) });
    expect(opened.length - closed.length).toBe(2);
    const at = opened.findIndex((row) => row.kind === "monthRow");
    expect(kinds(opened).slice(at + 1, at + 3)).toEqual(["workout", "workout"]);
  });
});

describe("buildRail: older workouts loaded by page", () => {
  it("adds plain month labels with no count, a quiet line for an empty month, and an Older workouts row until the start", () => {
    const held = run(HISTORY_RAIL_MIN_FULL, 17, 11);
    const older = [workout("push", at(8, 29)), workout("push", at(8, 27))]; // September and October empty
    const rows = rail({ held, older, reachedStart: false });
    expect(rows.filter((row) => row.kind === "gap")).toMatchObject([{ text: "No workouts from September to October" }]);
    expect(rows.filter((row) => row.kind === "monthLabel").map((row) => row.kind === "monthLabel" && row.month)).toEqual(["2026-11", "2026-08"]);
    expect(rows[rows.length - 1].kind).toBe("olderMore");
  });

  it("ends with the first workout's date once the start is reached, and says so for a history of one", () => {
    const rows = rail({ held: run(HISTORY_RAIL_MIN_FULL, 17, 11), older: [workout("push", new Date(2025, 2, 10, 9).getTime())] });
    expect(rows[rows.length - 1]).toMatchObject({ kind: "end", text: "Your first workout, 10 March 2025", onlyOne: false });
    expect(rail({ held: [workout("push", at(11, 11))] }).pop()).toMatchObject({ kind: "end", onlyOne: true });
  });

  it("is empty for no workouts at all, with no first-workout line", () => {
    expect(rail({ held: [] })).toEqual([]);
  });
});

describe("gapLine and monthLabel", () => {
  it("is null for neighbouring months, one month by name, a break as one range, years when not this year", () => {
    expect(gapLine("2026-10", "2026-09", "2026-11")).toBeNull();
    expect(gapLine("2026-10", "2026-08", "2026-11")).toBe("No workouts in September");
    expect(gapLine("2026-08", "2026-02", "2026-11")).toBe("No workouts from March to July");
    expect(gapLine("2026-02", "2025-11", "2026-11")).toBe("No workouts from December 2025 to January");
    expect(monthLabel("2025-03", "2026-11")).toBe("March 2025");
  });
});

describe("mergePending", () => {
  const exercise = (sets = 1) =>
    buildExercise("Bench Press", { sets: Array.from({ length: sets }, (_, i) => ({ id: i + 1, segments: [{ Weight: 60, Reps: 5 }] })) });
  const entry = (uid: string, failedAttempts: number, startTime = at(11, 16)) => {
    const w = buildWorkout([], { id: "push", name: "Push", startTime, exercises: [exercise()] });
    return { sessionId: `push_${startTime}`, uid, workout: w, endedAt: startTime + 1, failedAttempts, lastError: null };
  };
  const held = (): WorkoutSessionDoc[] => [workout("pull", at(11, 10)).session];

  it("adds this user's queued workouts only, as waiting or failed, newest first", () => {
    const merged = mergePending(held(), [entry("u1", 0), entry("u1", 2, at(11, 12)), entry("u2", 0, at(11, 14))], "u1", () => null);
    expect(merged.map((w) => w.state)).toEqual(["waiting", "failed", "uploaded"]);
  });

  it("shows an uploaded workout once, from the held copy, when the queue has not drained", () => {
    const e = entry("u1", 0, at(11, 10));
    const heldCopy = { ...workout("push", at(11, 10)).session, sessionId: e.sessionId };
    expect(mergePending([heldCopy], [e], "u1", () => null)).toHaveLength(1);
  });

  it("gives a provisional verdict from a held summary, first time when held and absent, and none when summaries are not held", () => {
    const stats = buildStats("Bench Press", [{ sets: [{ Weight: "50", Reps: "5" }] }]);
    expect(mergePending([], [entry("u1", 0)], "u1", () => stats)[0].session.lifts[0]).toMatchObject({ verdict: "better" });
    expect(mergePending([], [entry("u1", 0)], "u1", () => null)[0].session.lifts[0]).toMatchObject({ verdict: null, reason: "first_time" });
    expect(mergePending([], [entry("u1", 0)], "u1", null)[0].session.lifts[0]).toMatchObject({ verdict: null, reason: "pending" });
  });
});
