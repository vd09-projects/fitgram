// src/test/recentWorkouts.ts
//
// Serves sessions to the recent workouts store (TICKET-075) in screen tests.
// The test file must mock `services/db/workoutSessions` with
// `getNewestSessionStamp`, `getPlanSessionsFromServer` and `getChangedSessions`
// as `jest.fn()`: a `jest.mock` factory cannot be shared from here.

import { getChangedSessions, getNewestSessionStamp, getPlanSessionsFromServer } from "../services/db/workoutSessions";
import type { WorkoutSessionDoc } from "../types/workoutSession";
import { compareSessions } from "../utils/workoutsSync";

/**
 * The server holds `sessions`: each plan's query answers its newest, as the
 * index orders them; no session has a stamp (the baseline is null) and the
 * change check finds nothing new.
 */
export function serveRecentWorkouts(sessions: readonly WorkoutSessionDoc[]) {
  jest.mocked(getNewestSessionStamp).mockResolvedValue(null);
  jest.mocked(getChangedSessions).mockResolvedValue([]);
  jest
    .mocked(getPlanSessionsFromServer)
    .mockImplementation(async (_uid, planId, count) =>
      sessions.filter((s) => s.workoutId === planId).sort(compareSessions).slice(0, count)
    );
}

/** Every read of the store fails, as offline. */
export function failRecentWorkouts(error = new Error("offline")) {
  jest.mocked(getNewestSessionStamp).mockRejectedValue(error);
  jest.mocked(getChangedSessions).mockRejectedValue(error);
  jest.mocked(getPlanSessionsFromServer).mockRejectedValue(error);
}
