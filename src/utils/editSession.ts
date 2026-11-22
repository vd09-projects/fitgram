// src/utils/editSession.ts
//
// Edit a past workout in the logging screen (TICKET-102): the stored workout becomes a draft in the workout slot, and
// the draft becomes lifts again through the same builder a Finish uses. Pure: no store, no reads.
// Tests: editSession.test.ts, next to this file.

import type { ActiveWorkout, ExerciseSet, LoggedExercise } from "../types/zustandWorkoutType";
import type { LiftRecord, WorkoutSessionDoc } from "../types/workoutSession";
import { buildSessionDocs } from "./exerciseStats";
import { decodeStoredSets } from "./storedSets";

export type EditableWorkout = { status: "ready"; workout: ActiveWorkout } | { status: "refused"; reason: string };

/**
 * The stored workout as an edit draft: one slot per lift, its sets numbered 1..n, its marks, its fields as logged
 * (units included), and the "Swapped in for X" and "Added" captions. The draft keeps the workout's own id, name and
 * start, so the history before it (`deriveExerciseHistory`'s `before`) and the doc it saves to are the right ones.
 *
 * Refused, with a reason the Session's menu shows, rather than a draft that would lose something on Save:
 * - a deleted workout, or one whose lifts could not be read (`liftsUnreadable`): there is nothing to edit;
 * - a set whose segments could not all be read (`decodeStoredSet`'s `segmentsIncomplete`): the draft would hold
 *   fewer values than the stored set, and saving it would drop the rest (CLAUDE.md 2.4).
 *
 * The plan's exercises that were not done are not slots: the stored workout never had them, and an edit fixes what
 * was logged. Rejected: reading the plan to bring them back, which an edit has no need of and which may have changed.
 */
export function toEditableWorkout(session: WorkoutSessionDoc): EditableWorkout {
  if (session.deleted === true) return { status: "refused", reason: "This workout was deleted." };
  if (session.liftsUnreadable === true || session.lifts.length === 0) {
    return { status: "refused", reason: "Its details could not be read, so it cannot be edited." };
  }

  const exercises: LoggedExercise[] = [];
  for (const lift of session.lifts) {
    const decoded = decodeStoredSets(lift.sets);
    if (decoded.length !== lift.sets.length || decoded.some((set) => set.segmentsIncomplete)) {
      return { status: "refused", reason: `A set of ${lift.name} could not be read, so it cannot be edited.` };
    }
    const sets: ExerciseSet[] = decoded.map((set, index) => ({ id: index + 1, segments: set.segments, effort: set.effort }));
    exercises.push({
      id: lift.id,
      name: lift.name,
      // The name as logged: `buildSessionDocs` writes `nameSnapshot` back as the record's name, so a custom
      // exercise keeps its own and a catalog one keeps the name it had then.
      nameSnapshot: lift.name,
      fields: lift.fields,
      sets,
      ...(lift.swappedFrom ? { swappedFrom: lift.swappedFrom } : {}),
      ...(lift.added ? { added: true as const } : {}),
    });
  }

  const draft: ActiveWorkout = {
    id: session.workoutId,
    name: session.workoutName,
    startTime: session.startedAt,
    exercises,
    currentExerciseIndex: 0,
  };
  return {
    status: "ready",
    workout: { ...draft, editOf: { sessionId: session.sessionId, endedAt: session.endedAt, original: draftLifts(draft) } },
  };
}

/**
 * The lifts a draft stands for, built as a Finish builds them (`buildSessionDocs`): exercises with no sets are
 * left out, and every verdict is `pending` (Save computes them). The end time does not reach the lifts.
 */
export function draftLifts(workout: ActiveWorkout): LiftRecord[] {
  return buildSessionDocs(workout, workout.editOf?.endedAt ?? workout.startTime).session.lifts;
}

/**
 * Whether the draft differs from the workout it edits: what turns Save on and makes Cancel ask first. Compared on
 * what a lift records (exercise, name, fields, sets with their marks, captions), both sides built the same way, so a
 * page or an opened menu is not a change. A mark set and cleared again, or a set deleted and undone, is no change.
 */
export function draftChanged(workout: ActiveWorkout): boolean {
  if (!workout.editOf) return false;
  return JSON.stringify(draftLifts(workout)) !== JSON.stringify(workout.editOf.original);
}
