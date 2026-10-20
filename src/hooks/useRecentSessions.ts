// src/hooks/useRecentSessions.ts
//
// The Start screen's one read: the most recent sessions across every plan, from
// which `buildPlanRows` takes each plan's last-done date. One query however many
// plans there are — never one per plan.

import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { getWorkoutSessions } from "../services/db/workoutSessions";
import { WorkoutSessionDoc } from "../types/workoutSession";
import { RECENT_SESSIONS_WINDOW } from "../utils/startWorkout";

/**
 * `null` until the first query returns, and after a failure with nothing to
 * show — `buildPlanRows` then gives no plan a date rather than a wrong one.
 *
 * Refetched:
 * - on focus, so a workout finished elsewhere appears on return;
 * - when `pendingCount` drops. An upload that lands while the screen is open
 *   removes its pending entry, and without a refetch the row would fall back to
 *   the older uploaded date until the next focus. One query per drained upload.
 *
 * A refetch keeps the previous result on screen until it lands, and a failed
 * refetch keeps it too: the older list is still true, just possibly incomplete.
 */
export function useRecentSessions(
  uid: string | undefined,
  pendingCount: number
): WorkoutSessionDoc[] | null {
  const [sessions, setSessions] = useState<WorkoutSessionDoc[] | null>(null);
  // Guards against a slow response for a previous user landing after a switch.
  const requestedFor = useRef<string | undefined>(undefined);

  const load = useCallback(() => {
    // Another account's sessions are never shown while this one's load.
    if (requestedFor.current !== uid) setSessions(null);
    requestedFor.current = uid;
    if (!uid) return;
    getWorkoutSessions(uid, { pageSize: RECENT_SESSIONS_WINDOW })
      .then(({ sessions: fetched }) => {
        if (requestedFor.current === uid) setSessions(fetched);
      })
      .catch((error) => {
        console.warn("⚠️ Recent sessions unavailable; plans show no last-done date.", error);
      });
  }, [uid]);

  useFocusEffect(load);

  const previousPending = useRef(pendingCount);
  useEffect(() => {
    if (pendingCount < previousPending.current) load();
    previousPending.current = pendingCount;
  }, [pendingCount, load]);

  return sessions;
}
