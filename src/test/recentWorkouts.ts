// src/test/recentWorkouts.ts
//
// Serves sessions to the recent workouts store (TICKET-075, TICKET-082) in screen tests.
// The test file must mock `services/db/workoutSessions` with `getNewestSessionStamp`,
// `getWorkoutWindowFromServer`, `getLastWorkoutOfPlan` and `getChangedSessions` as `jest.fn()`:
// a `jest.mock` factory cannot be shared from here.

import {
  getChangedSessions,
  getLastWorkoutOfPlan,
  getNewestSessionStamp,
  getWorkoutWindowFromServer,
} from "../services/db/workoutSessions";
import type { WorkoutSessionDoc } from "../types/workoutSession";
import { compareSessions, secondQueryStart } from "../utils/workoutWindow";

/**
 * The server holds `sessions`: the window's two queries answer as the real ones do (the newest
 * `min`, then the rest of the oldest local month), a plan's lookup answers its newest; no
 * session has a stamp (the baseline is null) and the change check finds nothing new.
 */
export function serveRecentWorkouts(sessions: readonly WorkoutSessionDoc[]) {
  const newestFirst = [...sessions].sort(compareSessions);
  jest.mocked(getNewestSessionStamp).mockResolvedValue(null);
  jest.mocked(getChangedSessions).mockResolvedValue([]);
  jest.mocked(getWorkoutWindowFromServer).mockImplementation(async (_uid, min) => {
    const newest = newestFirst.slice(0, min);
    const from = secondQueryStart(newest, min);
    return { newest, rest: from === null ? null : newestFirst.slice(min).filter((s) => s.startedAt >= from) };
  });
  jest
    .mocked(getLastWorkoutOfPlan)
    .mockImplementation(async (_uid, planId) => newestFirst.find((s) => s.workoutId === planId) ?? null);
}

/** Every read of the store fails, as offline. */
export function failRecentWorkouts(error = new Error("offline")) {
  jest.mocked(getNewestSessionStamp).mockRejectedValue(error);
  jest.mocked(getChangedSessions).mockRejectedValue(error);
  jest.mocked(getWorkoutWindowFromServer).mockRejectedValue(error);
  jest.mocked(getLastWorkoutOfPlan).mockRejectedValue(error);
}
