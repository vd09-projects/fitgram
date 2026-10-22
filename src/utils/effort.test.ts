// TICKET-034: a set's effort mark survives every hop from the live workout to
// "last time" on the next session, and is never paired with the wrong set.

import { buildExercise, buildWorkout } from "../test/fixtures";
import { Effort, ExerciseSessionDoc } from "../types/workoutSession";
import { lastTimeEffort, zipSetEffort } from "./effort";
import { deriveExerciseHistory } from "./exerciseHistory";
import { buildSessionDocs, rebuildStatsFromSessions } from "./exerciseStats";

const DAY = 24 * 60 * 60 * 1000;

/** A finished Bench Press session whose sets carry the given marks (undefined = never marked). */
function finishedSession(startTime: number, marks: (Effort | null | undefined)[]): ExerciseSessionDoc {
  const workout = buildWorkout([], {
    startTime,
    exercises: [
      buildExercise("Bench Press", {
        sets: marks.map((effort, i) => ({ id: i + 1, fields: { Weight: 60, Reps: 8 }, effort })),
      }),
    ],
  });
  // JSON round trip: what AsyncStorage and the upload queue do to a workout
  // between logging and upload. It drops `effort: undefined` keys.
  const stored = JSON.parse(JSON.stringify(workout));
  return buildSessionDocs(stored, startTime + 3600_000).exerciseSessions[0];
}

// `rebuildStatsFromSessions` folds each doc through `applySessionToStats`, the
// function Finish calls, so this is the live write path, not a separate one.
const historyOf = (docs: ExerciseSessionDoc[]) =>
  deriveExerciseHistory({
    exerciseId: docs[0].exerciseId,
    status: "ready",
    stats: rebuildStatsFromSessions(docs[0].exerciseId, docs),
    fetchedAt: 0,
    error: null,
  });

describe("effort marks, end to end", () => {
  it("survive storage, upload and the rollup rebuild; an unmarked set is null, never undefined", () => {
    const doc = finishedSession(10 * DAY, [undefined, Effort.Easy, null, Effort.Hard]);
    // Firestore rejects undefined; a set logged without a mark must store null.
    expect(doc.setEffort).toEqual([null, Effort.Easy, null, Effort.Hard]);

    const history = historyOf([doc]);
    expect(history.lastSession!.sets.map((s) => s.effort)).toEqual([null, Effort.Easy, null, Effort.Hard]);
    expect(history.lastSession!.effortUnavailable).toBe(false);
  });

  it("'last time' is the last session only: an older mark never stands in for an unmarked set", () => {
    const older = finishedSession(1 * DAY, [Effort.Hard, Effort.Hard]);
    const latest = finishedSession(8 * DAY, [null, Effort.Easy]);
    const history = historyOf([older, latest]);

    expect(lastTimeEffort(history, 1)).toBeNull();
    expect(lastTimeEffort(history, 2)).toEqual({ effort: Effort.Easy, performedAt: 8 * DAY });
    // Not done last time at all.
    expect(lastTimeEffort(history, 3)).toBeNull();
  });
});

describe("zipSetEffort", () => {
  it("reads every mark as unavailable when the stored marks do not line up with the sets", () => {
    expect(zipSetEffort(3, [Effort.Hard, null])).toEqual({ marks: [null, null, null], unavailable: true });
    // Stored, but not marks: unavailable, and never a throw that takes the whole history down.
    expect(zipSetEffort(2, null)).toEqual({ marks: [null, null], unavailable: true });
    // A doc from before marks existed: nothing was marked, which is true.
    expect(zipSetEffort(2, undefined)).toEqual({ marks: [null, null], unavailable: false });
  });
});
