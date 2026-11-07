// src/utils/freestyleHistory.ts
//
// Freestyle in History (TICKET-067 stage 2). The workout filter lists plans
// and matches `session.workoutId === plan.id`; a Freestyle has no plan, so it
// gets a plan-shaped entry with `FREESTYLE_ID`, and the rest of the filter
// (exercise list, the per-exercise query, the workoutId match) runs unchanged.

import { FREESTYLE_ID, FREESTYLE_NAME, isFreestyle } from "../constants/freestyle";
import { WorkoutSessionDoc } from "../types/workoutSession";
import { Exercise, WorkoutPlan } from "../types/workoutType";

// FREESTYLE_HISTORY_WINDOW: value and reason in src/config/display.ts.

/**
 * The filter's Freestyle entry, or null when there is no Freestyle session
 * (then History lists plans only, as before).
 *
 * **Exercises** = every exercise id in those sessions, most recently done
 * first, each once. A Freestyle stores ids only, so each is the plan's own
 * `Exercise` when some plan has that id (a custom exercise's name lives
 * there), else a bare catalog ref whose name the catalog builds. An id in
 * neither names itself "unknown exercise" through `exerciseDisplayName`,
 * never a guessed name.
 *
 * Sessions that are not Freestyle are skipped, so a caller passing a mixed
 * list cannot list a plan's exercises under Freestyle.
 */
export function freestyleHistoryEntry(sessions: WorkoutSessionDoc[], plans: WorkoutPlan[]): WorkoutPlan | null {
  const freestyle = sessions.filter((session) => isFreestyle(session.workoutId));
  if (freestyle.length === 0) return null;

  const fromPlans = new Map<string, Exercise>();
  for (const plan of plans) {
    for (const exercise of plan.exercises) {
      if (!fromPlans.has(exercise.id)) fromPlans.set(exercise.id, exercise);
    }
  }

  const exercises = new Map<string, Exercise>();
  for (const session of [...freestyle].sort((a, b) => b.startedAt - a.startedAt)) {
    for (const id of session.exerciseIds) {
      if (!exercises.has(id)) exercises.set(id, fromPlans.get(id) ?? { id, name: "", fields: [] });
    }
  }
  return { id: FREESTYLE_ID, name: FREESTYLE_NAME, exercises: [...exercises.values()] };
}
