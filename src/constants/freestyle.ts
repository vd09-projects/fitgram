// src/constants/freestyle.ts
//
// Freestyle (TICKET-067): a workout started with no plan. No plan doc is
// created; the session is saved with this id and name, so History can list
// every Freestyle as one entry. Every screen reads these, never the literal.

import { WorkoutPlan } from "../types/workoutType";

/**
 * The `workoutId` of every Freestyle session. A constant is safe: plan ids are
 * 20-character Firestore auto-ids, so no plan can carry this one, and every
 * comparison against a plan id (the plan card's Resume, the hub's live tile,
 * Manage's running banner, `buildPlanRows`' join) stays false for it. Session
 * ids are still unique: `buildSessionId(id, startTime)`.
 *
 * Rejected: an archived "Today's Workout" plan, which would mix every Freestyle
 * day into one plan's last done and volume (user, 2026-11-02).
 */
export const FREESTYLE_ID = "freestyle";

/** The `workoutName` it is saved under, and its name in the hub and logger. */
export const FREESTYLE_NAME = "Freestyle";

/**
 * The plan-shaped object `startWorkout` takes: no exercises, so the logger
 * opens empty and they come from ⋯ → Add exercise (TICKET-056). With no
 * exercises, `startWorkout` runs no summaries check for it. A new object per call, so a caller
 * cannot change the next one.
 */
export const freestylePlan = (): WorkoutPlan => ({ id: FREESTYLE_ID, name: FREESTYLE_NAME, exercises: [] });

export const isFreestyle = (workoutId: string | null | undefined) => workoutId === FREESTYLE_ID;
