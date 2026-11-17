// src/utils/finishLanding.ts
//
// Where Finish lands (TICKET-083): the Workout stack becomes hub, History home, Session of the workout just saved,
// so Back from the Session goes to the History home and from there to the hub. One list, used by the logger's
// redirect (`ActiveWorkoutScreen`) and by the navigator test that checks the real stacks follow it.

import { WorkoutRoutes } from "../constants/routes";

export type FinishLanding = { sessionId: string; workoutName: string; startedAt: number };

export const finishLandingRoutes = (landing: FinishLanding) => [
  { name: WorkoutRoutes.WorkoutHome },
  { name: WorkoutRoutes.HistoryHome },
  // `finished`: the Session says "Workout saved" once the workout is on the server.
  { name: WorkoutRoutes.Session, params: { ...landing, finished: true as const } },
];
