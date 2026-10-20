import { sessionSets, sheetBest, sheetSession, sheetStatusMessage, sheetTrend } from "./historySheet";
import { setDelta } from "./setDeltas";
import { deriveExerciseHistory } from "./exerciseHistory";
import { resolveNumericFields } from "./exerciseFields";
import { buildStats, StatsSessionSpec } from "../test/fixtures";
import { ExerciseHistoryStatus } from "../types/exerciseHistory";
import { StoredSetFields } from "../types/workoutSession";
import { ExerciseField } from "../types/workoutType";

const KG: ExerciseField = { name: "Weight", role: "weight", unit: "kg" };
const LB: ExerciseField = { name: "Weight", role: "weight", unit: "lb" };
const REPS: ExerciseField = { name: "Reps", role: "reps" };
const BENCH = [KG, REPS];
const PLANK: ExerciseField[] = [
  { name: "Time", role: "time", unit: "s" },
  { name: "Notes", role: "other" },
];

const set = (weight: string, reps: string): StoredSetFields => ({ Weight: weight, Reps: reps });

const historyOf = (
  sessions: StatsSessionSpec[] | null,
  fields: ExerciseField[] = BENCH,
  status: ExerciseHistoryStatus = "ready"
) =>
  deriveExerciseHistory(
    {
      exerciseId: "bench-press",
      status,
      stats: sessions ? buildStats("Bench Press", sessions) : null,
      fetchedAt: 0,
      error: null,
    },
    fields
  );

describe("sheetSession", () => {
  it("gives the last session the Today list's deltas, aligned by set index", () => {
    const history = historyOf([{ sets: [set("60", "8"), set("62.5", "6"), set("60", "8")] }]);
    const today = [set("60", "9"), set("62.5", "6")];
    const view = sheetSession(history, history.sessions[0], today, BENCH);

    // Same function, same inputs: the sheet cannot disagree with the Today list.
    const numeric = resolveNumericFields(BENCH);
    expect(view.rows.map((row) => row.delta).slice(0, 2)).toEqual(
      today.map((fields, i) => setDelta(history, i + 1, fields, numeric))
    );
    expect(view.rows.map((row) => row.delta?.kind === "delta" && row.delta.verdict)).toEqual([
      "improved",
      "matched",
      false,
    ]);
    // Set 3 was done last time, not yet today: values on one side, no delta.
    expect(view.rows[2]).toEqual({ setNumber: 3, past: "60 kg × 8", today: null, isNext: true, delta: null });
  });

  it("compares against the selected session, not the last one, and keeps today's extra sets", () => {
    const history = historyOf([{ sets: [set("60", "8")] }, { sets: [set("55", "8")] }]);
    const view = sheetSession(history, history.sessions[1], [set("60", "8"), set("60", "8")], BENCH);

    expect(view.rows[0].delta).toEqual({ kind: "delta", verdict: "improved", label: "+5 kg" });
    expect(view.rows[1]).toMatchObject({ past: null, today: "60 kg × 8", delta: null });
  });

  it("gates on each session's own unit, not on unitMismatch", () => {
    const history = historyOf([{ sets: [set("60", "8")] }, { fields: [LB, REPS], sets: [set("135", "8")] }]);
    expect(history.unitMismatch).toBe(true);

    const kg = sheetSession(history, history.sessions[0], [set("60", "9")], BENCH);
    expect(kg.rows[0].delta).toMatchObject({ kind: "delta", verdict: "improved" });
    expect(kg.notice).toBeNull();

    // Numbers shown in their own unit, never compared, and the reason given.
    const lb = sheetSession(history, history.sessions[1], [set("60", "9")], BENCH);
    expect(lb.rows[0]).toMatchObject({ past: "135 lb × 8" });
    expect(lb.rows[0].delta).toEqual({ kind: "none", reason: "unitChanged" });
    expect(lb.notice).toBe("Logged in lb, today in kg, so not compared");
    expect(lb.volume).toBe("1,080 lb");
    // Its parsed numbers stay null, as the hook's do: nothing can compare them.
    expect(sessionSets(history.sessions[1])[0]).toMatchObject({ weight: null, reps: null });
  });

  it("reads a past session through its own field names (TICKET-030)", () => {
    const OLD: ExerciseField[] = [{ name: "Weight (kg)", role: "weight", unit: "kg" }, REPS];
    const history = historyOf([{ fields: OLD, sets: [{ "Weight (kg)": "60", Reps: "8" }] }]);

    // The hook parses with today's names and loses the weight...
    expect(history.sessions[0].sets[0].weight).toBeNull();
    // ...the sheet recovers it, so there is a value, a volume and a delta.
    const view = sheetSession(history, history.sessions[0], [set("62.5", "8")], BENCH);
    expect(view.rows[0]).toMatchObject({ past: "60 kg × 8", today: "62.5 kg × 8" });
    expect(view.rows[0].delta).toMatchObject({ kind: "delta", verdict: "improved" });
    expect(view.volume).toBe("480 kg");
    expect(view.notice).toBeNull();
  });

  it("lists a plank's sets with no deltas, no volume and says why", () => {
    const history = historyOf([{ fields: PLANK, sets: [{ Time: "60", Notes: "easy" }] }], PLANK);
    const view = sheetSession(history, history.sessions[0], [{ Time: "75" }], PLANK);

    expect(view.rows[0]).toMatchObject({ past: "60 s · easy", today: "75 s" });
    expect(view.rows[0].delta).toEqual({ kind: "none", reason: "noComparison" });
    expect(view.volume).toBeNull();
    expect(view.notice).toBe("No weight × reps to compare");
  });
});

describe("sheetStatusMessage", () => {
  it.each([
    ["idle", null, "History not loaded"],
    ["loading", null, "Loading history…"],
    ["error", null, "Couldn't load history"],
    ["ready", null, "No history yet. Sessions you finish will show here."],
    ["ready", [{ sets: [set("60", "8")] }], null],
  ] as const)("%s, sessions %p", (status, sessions, message) => {
    expect(sheetStatusMessage(historyOf(sessions ? [...sessions] : null, BENCH, status))).toBe(message);
  });
});

describe("sheetBest", () => {
  const history = historyOf([
    { sets: [set("70", "5"), set("65", "8")] },
    { sets: [set("70", "6")] },
  ]);

  it("takes the record at the next set's reps, else the heaviest with most reps", () => {
    expect(sheetBest(history, 8)).toMatchObject({ kind: "atReps", set: { weight: 65, reps: 8 } });
    // No 10-rep record: 70×6 beats 70×5 on the tie.
    expect(sheetBest(history, 10)).toMatchObject({ kind: "heaviest", set: { weight: 70, reps: 6 } });
    expect(sheetBest(historyOf([{ fields: PLANK, sets: [{ Time: "60" }] }], PLANK), null)).toBeNull();
  });
});

describe("sheetTrend", () => {
  it("scales bars to the largest volume and leaves a gap for an unavailable one", () => {
    const history = historyOf([
      { sets: [set("50", "10")] }, // 500, newest
      { sets: [set("60", "eight")] }, // unavailable
      { sets: [set("25", "10")] }, // 250, oldest
    ]);
    const trend = sheetTrend(history);

    expect(trend.kind).toBe("bars");
    if (trend.kind !== "bars") return;
    expect(trend.bars.map((bar) => bar.ratio)).toEqual([0.5, null, 1]);
    expect(trend.newest?.volume).toBe(500);
  });

  it("hides the trend when a session used another unit, since points carry none", () => {
    const history = historyOf([{ sets: [set("60", "8")] }, { fields: [LB, REPS], sets: [set("135", "8")] }]);
    expect(sheetTrend(history)).toEqual({
      kind: "none",
      reason: "Volume trend hidden: a recent session used a different unit",
    });
  });
});
