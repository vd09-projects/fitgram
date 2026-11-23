// TICKET-102 stage 1: a past workout as an edit draft in the logger, and the history it is compared with.

import { draftChanged, draftDiff, draftLifts, editSaveError, toEditableWorkout } from "./editSession";
import { buildSessionDocs } from "./exerciseStats";
import { deriveExerciseHistory } from "./exerciseHistory";
import { resolveGhostTarget } from "./setLogger";
import { buildExercise, buildStats, buildWorkout } from "../test/fixtures";
import { Effort, type WorkoutSessionDoc } from "../types/workoutSession";
import type { ActiveWorkout } from "../types/zustandWorkoutType";
import { STATS_RECENT_SESSION_CAP } from "../config/storedData";

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 10, 9, 18);

/** A stored workout as a Finish writes it: a split set with marks, a swapped-in lift and an added one. */
function storedWorkout(): WorkoutSessionDoc {
  const workout = buildWorkout([], {
    id: "push",
    name: "Push",
    startTime: START,
    exercises: [
      buildExercise("Bench Press", {
        nameSnapshot: "Bench Press",
        sets: [
          { id: 1, segments: [{ Weight: 62.5, Reps: 8 }], effort: Effort.Hard },
          { id: 2, segments: [{ Weight: 650, Reps: 9 }] },
          { id: 3, segments: [{ Weight: 55, Reps: 6 }, { Weight: 45, Reps: 4 }], effort: null },
        ],
      }),
      buildExercise("Lateral Raise", {
        planned: { id: "rear-delt-fly", name: "Rear Delt Fly", fields: [] },
        sets: [{ id: 1, segments: [{ Weight: 10, Reps: 15 }] }],
      }),
      buildExercise("Face Pull", { added: true, sets: [{ id: 1, segments: [{ Weight: 25, Reps: 15 }], effort: Effort.Easy }] }),
    ],
  });
  return buildSessionDocs(workout, START + 58 * 60 * 1000).session;
}

const draftOf = (session: WorkoutSessionDoc): ActiveWorkout => {
  const result = toEditableWorkout(session);
  if (result.status !== "ready") throw new Error(result.reason);
  return result.workout;
};

describe("toEditableWorkout", () => {
  it("round-trips: an untouched draft stands for exactly the stored lifts", () => {
    const session = storedWorkout();
    const draft = draftOf(session);
    // What Save will write (verdicts aside, which Save computes) is what is stored: sets, splits, marks, captions.
    expect(draftLifts(draft)).toEqual(session.lifts);
    expect(draft.editOf).toEqual({ sessionId: session.sessionId, endedAt: session.endedAt, original: session.lifts });
    expect(draft.startTime).toBe(session.startedAt);
    expect(draft.exercises[1].swappedFrom).toEqual({ id: "rear-delt-fly", name: "Rear Delt Fly" });
    expect(draftChanged(draft)).toBe(false);
  });

  it("refuses a set it cannot read whole, rather than drop part of it on Save", () => {
    const session = storedWorkout();
    const broken = { ...session, lifts: [{ ...session.lifts[0], sets: [{ segments: [{ Weight: 60, Reps: 5 }, "?"], effort: null }] }] };
    expect(toEditableWorkout(broken as unknown as WorkoutSessionDoc)).toEqual({
      status: "refused",
      reason: "A set of Bench Press could not be read, so it cannot be edited.",
    });
  });
});

describe("draftChanged", () => {
  it("is true once a set's value changes, and false again when it is put back", () => {
    const draft = draftOf(storedWorkout());
    const withSet2 = (weight: number): ActiveWorkout => ({
      ...draft,
      exercises: draft.exercises.map((exercise, index) =>
        index !== 0
          ? exercise
          : { ...exercise, sets: exercise.sets.map((set) => (set.id === 2 ? { ...set, segments: [{ Weight: weight, Reps: 9 }] } : set)) }
      ),
    });
    expect(draftChanged(withSet2(65))).toBe(true);
    expect(draftChanged(withSet2(650))).toBe(false);
  });
});

describe("history of an edit draft (deriveExerciseHistory's `before`)", () => {
  // Three Bench Press sessions: 2 Nov, the edited 9 Nov (with the typo), and a later 16 Nov.
  const stats = buildStats("Bench Press", [
    { performedAt: START + 7 * DAY, sets: [{ Weight: "70", Reps: "8" }] },
    { performedAt: START, sets: [{ Weight: "650", Reps: "9" }] },
    { performedAt: START - 7 * DAY, sets: [{ Weight: "62.5", Reps: "9" }] },
  ]);
  const entry = { exerciseId: "bench-press", status: "ready" as const, stats, error: null };

  it("compares with the session before the edited workout, and hides the all-time bests", () => {
    const history = deriveExerciseHistory(entry, undefined, START);
    expect(history.lastSession?.performedAt).toBe(START - 7 * DAY);
    expect(history.setAt(1)?.weight).toBe(62.5);
    // The stored bests hold the 650 typo: none shown, and the reason is carried.
    expect(history.best).toEqual([]);
    expect(history.asOf).toEqual({ before: START, earlierNotHeld: false, bestHidden: true });
    // Outside an edit nothing changes.
    expect(deriveExerciseHistory(entry).lastSession?.performedAt).toBe(START + 7 * DAY);
  });

  it("says the earlier sessions are not on the phone, not first time, when a full summary holds none before", () => {
    const full = buildStats(
      "Bench Press",
      Array.from({ length: STATS_RECENT_SESSION_CAP }, (_, i) => ({ performedAt: START + (i + 1) * DAY, sets: [{ Weight: "60", Reps: "8" }] }))
    );
    const notHeld = deriveExerciseHistory({ ...entry, stats: full }, undefined, START);
    expect(resolveGhostTarget(notHeld, 1).kind).toBe("earlierNotHeld");
    // A summary with room to spare and nothing before: the lift really was new then.
    const fewer = buildStats("Bench Press", [{ performedAt: START + DAY, sets: [{ Weight: "60", Reps: "8" }] }]);
    expect(resolveGhostTarget(deriveExerciseHistory({ ...entry, stats: fewer }, undefined, START), 1).kind).toBe("firstTime");
  });
});

describe("draftDiff (what Save rebuilds)", () => {
  const withBench = (change: (sets: ActiveWorkout["exercises"][number]["sets"]) => ActiveWorkout["exercises"][number]["sets"]): ActiveWorkout => {
    const draft = draftOf(storedWorkout());
    return { ...draft, exercises: draft.exercises.map((exercise, index) => (index === 0 ? { ...exercise, sets: change(exercise.sets) } : exercise)) };
  };

  it("names only the lift whose set changed; the other lifts are not touched", () => {
    const fixed = withBench((sets) => sets.map((set) => (set.id === 2 ? { ...set, segments: [{ Weight: 65, Reps: 9 }] } : set)));
    expect(draftDiff(fixed)).toEqual({ touched: ["bench-press"], added: [], removed: [] });
    expect(draftDiff(draftOf(storedWorkout()))).toEqual({ touched: [], added: [], removed: [] });
  });

  it("a mark changed counts, a set added counts; deleting every set of a lift removes the lift, as removing it does", () => {
    const marked = withBench((sets) => sets.map((set) => (set.id === 2 ? { ...set, effort: Effort.Easy } : set)));
    expect(draftDiff(marked).touched).toEqual(["bench-press"]);
    expect(draftDiff(withBench((sets) => [...sets, { id: 4, segments: [{ Weight: 50, Reps: 8 }] }])).touched).toEqual(["bench-press"]);
    expect(draftDiff(withBench(() => []))).toEqual({ touched: [], added: [], removed: ["bench-press"] });
  });

  it("an exercise added is named, and the order of lifts is not a difference", () => {
    const draft = draftOf(storedWorkout());
    const added = { ...draft, exercises: [...draft.exercises, buildExercise("Row", { added: true, sets: [{ id: 1, segments: [{ Weight: 40, Reps: 10 }] }] })] };
    expect(draftDiff(added)).toEqual({ touched: [], added: ["row"], removed: [] });
    expect(draftDiff({ ...draft, exercises: [...draft.exercises].reverse() })).toEqual({ touched: [], added: [], removed: [] });
  });
});

describe("editSaveError", () => {
  it("says a refusal keeps the changes, and reads an unknown code as a plain failure, not a guessed cause", () => {
    expect(editSaveError("unavailable").detail).toMatch(/kept/);
    expect(editSaveError("changed").title).toBe("Changed elsewhere");
    expect(editSaveError("nothing-left").detail).toMatch(/delete the session/);
    expect(editSaveError("something-new")).toEqual({ title: "Could not save", detail: "Your changes are kept. Try again." });
    expect(editSaveError(undefined).title).toBe("Could not save");
  });
});
